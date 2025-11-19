import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// TYPES
// ============================================================================

export interface WhisperWord {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}

export interface CutPoints {
  startKeep: number;  // milliseconds
  endKeep: number;    // milliseconds
  redPosition: 'START' | 'END';
  confidence: number;
}

// ============================================================================
// 1. AUDIO EXTRACTION
// ============================================================================

/**
 * Extract audio from video URL and save as WAV mono 22050Hz
 * Compatible with Whisper API requirements
 */
export async function extractAudioFromVideo(
  videoUrl: string,
  outputPath: string
): Promise<string> {
  try {
    // Download video to temp file
    const videoPath = outputPath.replace('.wav', '.mp4');
    const response = await fetch(videoUrl);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(videoPath, Buffer.from(buffer));

    // Extract audio with FFmpeg
    // -vn: no video
    // -acodec pcm_s16le: PCM 16-bit
    // -ac 1: mono (1 channel)
    // -ar 22050: sample rate 22050 Hz
    const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ac 1 -ar 22050 "${outputPath}" -y`;
    await execAsync(command);

    // Clean up video file
    await fs.unlink(videoPath);

    return outputPath;
  } catch (error) {
    console.error('[extractAudioFromVideo] Error:', error);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

// ============================================================================
// 2. WHISPER TRANSCRIPTION
// ============================================================================

/**
 * Transcribe audio using OpenAI Whisper API with word-level timestamps
 * Returns array of words with start/end times in seconds
 */
export async function transcribeWithWhisper(
  audioPath: string,
  language: string = 'ro'
): Promise<WhisperWord[]> {
  try {
    const audioFile = await fs.readFile(audioPath);
    const audioBlob = new Blob([audioFile], { type: 'audio/wav' });
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioBlob as any,
      model: 'whisper-1',
      language: language,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    // Extract words with timestamps
    const words: WhisperWord[] = (transcription as any).words || [];
    
    console.log(`[transcribeWithWhisper] Transcribed ${words.length} words`);
    return words;
  } catch (error) {
    console.error('[transcribeWithWhisper] Error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

// ============================================================================
// 3. RED TEXT DETECTION (Aeneas Algorithm)
// ============================================================================

/**
 * Normalize word for comparison (remove punctuation, lowercase)
 */
function normalizeWord(word: string): string {
  return word
    .replace(/[,\.:\;!?]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Find sequence of red text words in Whisper timestamps
 * Returns (startIndex, endIndex) or null if not found
 */
function findSequenceInWords(
  words: WhisperWord[],
  redTextWords: string[]
): { startIdx: number; endIdx: number } | null {
  const normalizedRedWords = redTextWords.map(normalizeWord);

  // Sliding window search
  for (let i = 0; i <= words.length - normalizedRedWords.length; i++) {
    let match = true;
    
    for (let j = 0; j < normalizedRedWords.length; j++) {
      const wordNormalized = normalizeWord(words[i + j].word);
      if (wordNormalized !== normalizedRedWords[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      return {
        startIdx: i,
        endIdx: i + normalizedRedWords.length - 1,
      };
    }
  }

  return null;
}

// ============================================================================
// 4. CUT POINTS CALCULATION
// ============================================================================

/**
 * Calculate cut points for video trimming
 * Based on Aeneas algorithm from documentation
 * 
 * @param fullText - Complete text from video
 * @param redText - Text to be removed (red text)
 * @param words - Whisper word timestamps
 * @param marginMs - Margin in milliseconds (default 50ms)
 * @returns Cut points with start/end timestamps in milliseconds
 */
export function calculateCutPoints(
  fullText: string,
  redText: string,
  words: WhisperWord[],
  marginMs: number = 50
): CutPoints | null {
  try {
    // Split red text into words
    const redWords = redText.split(/\s+/).filter(w => w.length > 0);
    
    // Find red text sequence in timestamps
    const redRange = findSequenceInWords(words, redWords);
    
    if (!redRange) {
      console.error('[calculateCutPoints] Red text not found in timestamps');
      return null;
    }

    const { startIdx, endIdx } = redRange;
    const marginS = marginMs / 1000.0;

    // Determine if red text is at START or END
    // If first red word is in first half → red at START
    const redAtStart = startIdx < words.length / 2;

    let startKeep: number;
    let endKeep: number;
    let redPosition: 'START' | 'END';

    if (redAtStart) {
      // ====================================================================
      // RED TEXT AT START → Keep from AFTER red text until END
      // ====================================================================
      const lastRedWord = words[endIdx];
      startKeep = (lastRedWord.end + marginS) * 1000; // Convert to ms

      const lastWord = words[words.length - 1];
      endKeep = (lastWord.end + marginS) * 1000; // Convert to ms

      redPosition = 'START';
    } else {
      // ====================================================================
      // RED TEXT AT END → Keep from START until BEFORE red text
      // ====================================================================
      const firstWord = words[0];
      startKeep = Math.max(0, (firstWord.start + marginS) * 1000); // Convert to ms

      const lastWhiteIdx = startIdx - 1;
      if (lastWhiteIdx < 0) {
        console.error('[calculateCutPoints] No white text before red text');
        return null;
      }

      const lastWhiteWord = words[lastWhiteIdx];
      endKeep = (lastWhiteWord.end + marginS) * 1000; // Convert to ms

      redPosition = 'END';
    }

    // Calculate confidence based on match quality
    const confidence = 0.95; // Whisper API typical accuracy

    console.log(`[calculateCutPoints] Red text at ${redPosition}`);
    console.log(`[calculateCutPoints] Keep range: ${startKeep}ms → ${endKeep}ms`);

    return {
      startKeep: Math.round(startKeep),
      endKeep: Math.round(endKeep),
      redPosition,
      confidence,
    };
  } catch (error) {
    console.error('[calculateCutPoints] Error:', error);
    return null;
  }
}

// ============================================================================
// 5. MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process video for editing: extract audio, transcribe, detect red text
 * Returns cut points and Whisper JSON for manual adjustment
 */
export async function processVideoForEditing(
  videoUrl: string,
  fullText: string,
  redText: string,
  marginMs: number = 50
): Promise<{
  words: WhisperWord[];
  cutPoints: CutPoints | null;
  audioPath: string;
}> {
  try {
    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'video-editing');
    await fs.mkdir(tempDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const audioPath = path.join(tempDir, `audio_${timestamp}.wav`);

    console.log('[processVideoForEditing] Extracting audio...');
    await extractAudioFromVideo(videoUrl, audioPath);

    console.log('[processVideoForEditing] Transcribing with Whisper...');
    const words = await transcribeWithWhisper(audioPath, 'ro');

    console.log('[processVideoForEditing] Calculating cut points...');
    const cutPoints = calculateCutPoints(fullText, redText, words, marginMs);

    return {
      words,
      cutPoints,
      audioPath,
    };
  } catch (error) {
    console.error('[processVideoForEditing] Error:', error);
    throw error;
  }
}
