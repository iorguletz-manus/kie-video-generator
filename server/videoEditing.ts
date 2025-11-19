import { promises as fs } from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import FormData from 'form-data';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const FFMPEG_API_KEY = 'Basic QjZlZ3lJd3RrOVNDZUZHT0xabGk6NDFkNjQ1ODBkMzAwM2U5MmZjYTg5OWU3';
const FFMPEG_API_BASE = 'https://api.ffmpeg-api.com';

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

export interface ProcessingResult {
  words: WhisperWord[];
  cutPoints: CutPoints | null;
  whisperTranscript: any;
}

// ============================================================================
// 1. FFMPEG API - UPLOAD VIDEO
// ============================================================================

/**
 * Upload video to FFmpeg API and return file_path
 */
async function uploadVideoToFFmpegAPI(
  videoUrl: string,
  fileName: string
): Promise<string> {
  try {
    console.log(`[uploadVideoToFFmpegAPI] Uploading ${fileName}...`);
    
    // Step 1: Get upload URL
    const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
      method: 'POST',
      headers: {
        'Authorization': FFMPEG_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_name: fileName }),
    });
    
    if (!fileRes.ok) {
      throw new Error(`FFmpeg API file creation failed: ${fileRes.statusText}`);
    }
    
    const { file, upload } = await fileRes.json();
    
    // Step 2: Download video from Bunny CDN
    console.log(`[uploadVideoToFFmpegAPI] Downloading from ${videoUrl}...`);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video: ${videoRes.statusText}`);
    }
    const videoBuffer = await videoRes.arrayBuffer();
    
    // Step 3: Upload to FFmpeg API
    console.log(`[uploadVideoToFFmpegAPI] Uploading to FFmpeg API...`);
    const uploadRes = await fetch(upload.url, {
      method: 'PUT',
      body: videoBuffer,
    });
    
    if (!uploadRes.ok) {
      throw new Error(`FFmpeg API upload failed: ${uploadRes.statusText}`);
    }
    
    console.log(`[uploadVideoToFFmpegAPI] Success! file_path: ${file.file_path}`);
    return file.file_path;
  } catch (error) {
    console.error('[uploadVideoToFFmpegAPI] Error:', error);
    throw new Error(`Failed to upload video to FFmpeg API: ${error.message}`);
  }
}

// ============================================================================
// 2. FFMPEG API - EXTRACT AUDIO
// ============================================================================

/**
 * Extract audio from video using FFmpeg API
 * Returns download URL for the audio file (MP3 format)
 */
async function extractAudioWithFFmpegAPI(
  videoFilePath: string,
  outputFileName: string
): Promise<string> {
  try {
    console.log(`[extractAudioWithFFmpegAPI] Extracting audio from ${videoFilePath}...`);
    
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': FFMPEG_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: {
          inputs: [{ file_path: videoFilePath }],
          outputs: [{
            file: outputFileName,
            options: ['-vn', '-acodec', 'mp3', '-ab', '192k']
          }]
        }
      }),
    });
    
    if (!processRes.ok) {
      throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
    }
    
    const result = await processRes.json();
    
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
    }
    
    const downloadUrl = result.result[0].download_url;
    console.log(`[extractAudioWithFFmpegAPI] Audio extracted! URL: ${downloadUrl}`);
    
    return downloadUrl;
  } catch (error) {
    console.error('[extractAudioWithFFmpegAPI] Error:', error);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

// ============================================================================
// 3. WHISPER TRANSCRIPTION
// ============================================================================

/**
 * Transcribe audio using OpenAI Whisper API with word-level timestamps
 * Downloads audio from URL and sends to Whisper
 */
async function transcribeWithWhisper(
  audioDownloadUrl: string,
  language: string = 'ro'
): Promise<{ words: WhisperWord[]; fullTranscript: any }> {
  try {
    console.log(`[transcribeWithWhisper] Downloading audio from ${audioDownloadUrl}...`);
    
    // Download audio file
    const audioRes = await fetch(audioDownloadUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio: ${audioRes.statusText}`);
    }
    const audioBuffer = await audioRes.arrayBuffer();
    
    console.log(`[transcribeWithWhisper] Sending to Whisper API...`);
    
    // Create FormData for Whisper API
    const formData = new FormData();
    formData.append('file', Buffer.from(audioBuffer), {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });
    
    if (!whisperRes.ok) {
      const errorText = await whisperRes.text();
      throw new Error(`Whisper API failed: ${whisperRes.statusText} - ${errorText}`);
    }
    
    const transcription = await whisperRes.json();
    const words: WhisperWord[] = transcription.words || [];
    
    console.log(`[transcribeWithWhisper] Transcribed ${words.length} words`);
    
    return {
      words,
      fullTranscript: transcription,
    };
  } catch (error) {
    console.error('[transcribeWithWhisper] Error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

// ============================================================================
// 4. RED TEXT DETECTION (Aeneas Algorithm)
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
// 5. CUT POINTS CALCULATION
// ============================================================================

/**
 * Calculate cut points for video trimming
 * Based on Aeneas algorithm from documentation
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
    const redAtStart = startIdx < words.length / 2;

    let startKeep: number;
    let endKeep: number;
    let redPosition: 'START' | 'END';

    if (redAtStart) {
      // RED TEXT AT START → Keep from AFTER red text until END
      const lastRedWord = words[endIdx];
      startKeep = (lastRedWord.end + marginS) * 1000;

      const lastWord = words[words.length - 1];
      endKeep = (lastWord.end + marginS) * 1000;

      redPosition = 'START';
    } else {
      // RED TEXT AT END → Keep from START until BEFORE red text
      const firstWord = words[0];
      startKeep = Math.max(0, (firstWord.start + marginS) * 1000);

      const lastWhiteIdx = startIdx - 1;
      if (lastWhiteIdx < 0) {
        console.error('[calculateCutPoints] No white text before red text');
        return null;
      }

      const lastWhiteWord = words[lastWhiteIdx];
      endKeep = (lastWhiteWord.end + marginS) * 1000;

      redPosition = 'END';
    }

    const confidence = 0.95;

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
// 6. MAIN PROCESSING FUNCTION (STEP 8)
// ============================================================================

/**
 * Process video for editing: upload to FFmpeg API, extract audio, transcribe
 * Returns cut points and Whisper transcript
 */
export async function processVideoForEditing(
  videoUrl: string,
  videoId: number,
  fullText: string,
  redText: string,
  marginMs: number = 50
): Promise<ProcessingResult> {
  try {
    console.log(`[processVideoForEditing] Starting for video ${videoId}...`);
    
    // 1. Upload video to FFmpeg API
    const videoFileName = `video_${videoId}.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName);
    
    // 2. Extract audio
    const audioFileName = `audio_${videoId}.mp3`;
    const audioDownloadUrl = await extractAudioWithFFmpegAPI(videoFilePath, audioFileName);
    
    // 3. Transcribe with Whisper
    const { words, fullTranscript } = await transcribeWithWhisper(audioDownloadUrl, 'ro');
    
    // 4. Calculate cut points
    const cutPoints = calculateCutPoints(fullText, redText, words, marginMs);
    
    console.log(`[processVideoForEditing] Processing complete for video ${videoId}`);
    
    return {
      words,
      cutPoints,
      whisperTranscript: fullTranscript,
    };
  } catch (error) {
    console.error(`[processVideoForEditing] Error for video ${videoId}:`, error);
    throw error;
  }
}

// ============================================================================
// 7. VIDEO CUTTING FUNCTION (STEP 10)
// ============================================================================

/**
 * Cut video using FFmpeg API with start/end timestamps
 * Returns download URL for the trimmed video
 */
export async function cutVideoWithFFmpegAPI(
  videoUrl: string,
  videoId: number,
  startTimeSeconds: number,
  endTimeSeconds: number
): Promise<string> {
  try {
    console.log(`[cutVideoWithFFmpegAPI] Cutting video ${videoId}: ${startTimeSeconds}s → ${endTimeSeconds}s`);
    
    const duration = endTimeSeconds - startTimeSeconds;
    
    // 1. Upload video to FFmpeg API
    const videoFileName = `video_${videoId}_original.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName);
    
    // 2. Trim video
    const outputFileName = `video_${videoId}_trimmed_${Date.now()}.mp4`;
    
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': FFMPEG_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: {
          inputs: [{
            file_path: videoFilePath,
            options: ['-ss', startTimeSeconds.toString(), '-t', duration.toString()]
          }],
          outputs: [{
            file: outputFileName,
            options: ['-c:v', 'libx264', '-crf', '23', '-c:a', 'aac']
          }]
        }
      }),
    });
    
    if (!processRes.ok) {
      throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
    }
    
    const result = await processRes.json();
    
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
    }
    
    const downloadUrl = result.result[0].download_url;
    console.log(`[cutVideoWithFFmpegAPI] Video cut successfully! URL: ${downloadUrl}`);
    
    return downloadUrl;
  } catch (error) {
    console.error('[cutVideoWithFFmpegAPI] Error:', error);
    throw new Error(`Failed to cut video: ${error.message}`);
  }
}
