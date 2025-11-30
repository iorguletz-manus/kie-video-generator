import * as fs from 'fs';
import * as path from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import FormData from 'form-data';

const exec = promisify(execCallback);

// Initialize OpenAI client with explicit API key and base URL
const getOpenAIClient = (userApiKey?: string) => {
  // Priority: user API key > ENV API key
  const apiKey = userApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please add it in Settings.');
  }
  console.log('[OpenAI] Using API key:', apiKey.substring(0, 20) + '...', userApiKey ? '(from user settings)' : '(from ENV)');
  // Use official OpenAI API, not Manus proxy
  return new OpenAI({ 
    apiKey,
    baseURL: 'https://api.openai.com/v1'
  });
};

// FFMPEG API configuration (API key passed as parameter from user settings)
const FFMPEG_API_BASE = 'https://api.ffmpeg-api.com';

// BunnyCDN configuration
const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
const BUNNYCDN_STORAGE_ZONE = 'manus-storage';
const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net';

/**
 * Upload file to BunnyCDN Storage
 */
async function uploadToBunnyCDN(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${fileName}`;
  
  console.log(`[uploadToBunnyCDN] Uploading to:`, storageUrl);
  
  const uploadResponse = await fetch(storageUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
      'Content-Type': contentType,
    },
    body: buffer,
  });
  
  if (!uploadResponse.ok) {
    throw new Error(`BunnyCDN upload failed: ${uploadResponse.statusText}`);
  }
  
  const publicUrl = `${BUNNYCDN_PULL_ZONE_URL}/${fileName}`;
  console.log(`[uploadToBunnyCDN] Upload successful:`, publicUrl);
  
  return publicUrl;
}

// ============================================================================
// TYPES
// ============================================================================

export interface WhisperWord {
  word: string;
  start: number;  // milliseconds (converted from Whisper seconds)
  end: number;    // milliseconds (converted from Whisper seconds)
}

export interface CutPoints {
  startKeep: number;  // milliseconds
  endKeep: number;    // milliseconds
  redPosition: 'START' | 'END';
  confidence: number;
}

export interface EditingDebugInfo {
  status: 'success' | 'warning' | 'error';
  message: string;
  redTextDetected?: {
    found: boolean;
    position?: 'START' | 'END';
    fullText: string;        // Complete red text
    timeRange?: { start: number; end: number };  // In seconds
    matchedWords?: string[]; // Words found in transcript
  };
  whisperTranscript?: string;  // Full transcript text from Whisper
  whisperWordCount?: number;   // Number of words transcribed
  algorithmLogs?: string[];    // Step-by-step algorithm execution logs
  error?: string;
}

export interface ProcessingResult {
  words: WhisperWord[];
  cutPoints: CutPoints | null;
  whisperTranscript: any;
  audioUrl: string;  // Audio download URL
  waveformJson: string;  // Waveform JSON data
  editingDebugInfo: EditingDebugInfo;  // Debug info for Step 8
  cleanvoiceAudioUrl?: string | null;  // CleanVoice processed audio URL (optional)
}

// ============================================================================
// 1. FFMPEG API - UPLOAD VIDEO
// ============================================================================

/**
 * Upload video to FFmpeg API and return file_path
 */
export async function uploadVideoToFFmpegAPI(
  videoUrl: string,
  fileName: string,
  ffmpegApiKey: string,
  dirId?: string  // Optional: directory ID for batch uploads (e.g., "dir_abc123")
): Promise<string> {
  try {
    console.log(`[uploadVideoToFFmpegAPI] Uploading ${fileName}...`);
    
    // Step 1: Get upload URL
    const requestBody = dirId 
      ? { file_name: fileName, dir_id: dirId }  // Use existing directory
      : { file_name: fileName };  // Let FFmpeg API create new directory
    
    const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!fileRes.ok) {
      const errorText = await fileRes.text();
      console.error('[uploadVideoToFFmpegAPI] FFmpeg API error response:', errorText.substring(0, 500));
      throw new Error(`FFmpeg API file creation failed: ${fileRes.statusText}`);
    }
    
    const responseText = await fileRes.text();
    let fileData;
    try {
      fileData = JSON.parse(responseText);
    } catch (e) {
      console.error('[uploadVideoToFFmpegAPI] Invalid JSON response:', responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON (possibly HTML error page)`);
    }
    
    const { file, upload } = fileData;
    
    // Step 2: Download video from Bunny CDN
    console.log(`[uploadVideoToFFmpegAPI] Downloading from ${videoUrl}...`);
    const downloadStartTime = Date.now();
    const videoRes = await fetch(videoUrl);
    const downloadEndTime = Date.now();
    const downloadDuration = downloadEndTime - downloadStartTime;
    console.log(`[uploadVideoToFFmpegAPI] Bunny CDN response status: ${videoRes.status} ${videoRes.statusText}`);
    console.log(`[uploadVideoToFFmpegAPI] Bunny CDN response headers:`, Object.fromEntries(videoRes.headers.entries()));
    
    if (!videoRes.ok) {
      const errorBody = await videoRes.text();
      console.error(`[uploadVideoToFFmpegAPI] Bunny CDN error body:`, errorBody.substring(0, 500));
      throw new Error(`Failed to download video: ${videoRes.status} ${videoRes.statusText} - URL: ${videoUrl}`);
    }
    
    const videoBuffer = await videoRes.arrayBuffer();
    const videoSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(2);
    console.log(`[uploadVideoToFFmpegAPI] Downloaded ${videoBuffer.byteLength} bytes (${videoSizeMB} MB) from Bunny CDN in ${downloadDuration}ms`);
    
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
  outputFileName: string,
  ffmpegApiKey: string
): Promise<string> {
  try {
    console.log(`[extractAudioWithFFmpegAPI] Extracting audio from ${videoFilePath}...`);
    
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
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
      const errorText = await processRes.text();
      console.error('[FFmpeg API] Error response:', errorText.substring(0, 500));
      throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
    }
    
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[FFmpeg API] Invalid JSON response:', responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON (possibly HTML error page)`);
    }
    
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

/**
 * Extract WAV audio from video using FFmpeg API
 * Uses specific parameters: -vn -ac 1 -ar 48000 -sample_fmt s16
 * Returns download URL for the WAV file
 */
async function extractWAVWithFFmpegAPI(
  videoFilePath: string,
  outputFileName: string,
  ffmpegApiKey: string
): Promise<string> {
  try {
    console.log(`[extractWAVWithFFmpegAPI] Extracting WAV audio from ${videoFilePath}...`);
    
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: {
          inputs: [{ file_path: videoFilePath }],
          outputs: [{
            file: outputFileName,
            options: [
              '-vn',              // No video
              '-ac', '1',         // Mono (1 audio channel)
              '-ar', '48000',     // 48kHz sample rate
              '-sample_fmt', 's16' // 16-bit signed integer samples
            ]
          }]
        }
      }),
    });
    
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error('[FFmpeg API] Error response:', errorText.substring(0, 500));
      throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
    }
    
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[FFmpeg API] Invalid JSON response:', responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON`);
    }
    
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
    }
    
    const downloadUrl = result.result[0].download_url;
    console.log(`[extractWAVWithFFmpegAPI] WAV extracted! URL: ${downloadUrl}`);
    
    return downloadUrl;
  } catch (error) {
    console.error('[extractWAVWithFFmpegAPI] Error:', error);
    throw new Error(`Failed to extract WAV: ${error.message}`);
  }
}

// ============================================================================
// 3. WAVEFORM GENERATION
// ============================================================================

/**
 * Generate waveform JSON using audiowaveform CLI
 * Returns the waveform JSON as a string (to be stored in database or uploaded to CDN)
 */
async function generateWaveformData(
  audioDownloadUrl: string,
  videoId: number,
  videoName: string  // Video name for unique file naming
): Promise<string> {
  try {
    console.log(`[generateWaveformData] Generating waveform for video ${videoId}...`);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join('/tmp', 'waveforms');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Use videoName for unique file naming to avoid race conditions
    const sanitizedName = videoName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const audioPathMp3 = path.join(tempDir, `${sanitizedName}.mp3`);
    const audioPathWav = path.join(tempDir, `${sanitizedName}.wav`);
    const waveformPath = path.join(tempDir, `${sanitizedName}.json`);
    
    // Download audio file
    console.log(`[generateWaveformData] Downloading audio from ${audioDownloadUrl}...`);
    const audioRes = await fetch(audioDownloadUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio: ${audioRes.statusText}`);
    }
    const audioBuffer = await audioRes.arrayBuffer();
    
    // Detect if input is WAV or MP3 based on URL or content
    const isWAV = audioDownloadUrl.toLowerCase().endsWith('.wav');
    
    if (isWAV) {
      // Input is already WAV - use directly
      console.log(`[generateWaveformData] Input is WAV - using directly without conversion`);
      await fs.writeFile(audioPathWav, Buffer.from(audioBuffer));
    } else {
      // Input is MP3 - convert to WAV
      await fs.writeFile(audioPathMp3, Buffer.from(audioBuffer));
      console.log(`[generateWaveformData] Converting MP3 → WAV PCM 16-bit...`);
      const convertCommand = `ffmpeg -y -i "${audioPathMp3}" -ac 1 -ar 48000 -c:a pcm_s16le "${audioPathWav}"`;
      await exec(convertCommand);
      console.log(`[generateWaveformData] Conversion complete`);
    }
    
    // Generate waveform JSON with audiowaveform CLI (from WAV, not MP3!)
    console.log(`[generateWaveformData] Running audiowaveform on WAV...`);
    // Use high resolution for short clips to enable zoom in Peaks.js
    // pixels-per-second 1000 gives samples_per_pixel ≈ 48 at 48kHz (vs 960 at pps=50)
    const command = `audiowaveform -i "${audioPathWav}" -o "${waveformPath}" --pixels-per-second 1000 -b 8`;
    const { stdout, stderr } = await exec(command);
    
    if (stderr) {
      console.warn(`[generateWaveformData] audiowaveform stderr:`, stderr);
    }
    
    // Read generated JSON
    const waveformJson = await fs.readFile(waveformPath, 'utf-8');
    
    // ✅ VALIDATION: Check if waveform covers full audio duration
    const waveformData = JSON.parse(waveformJson);
    const { length, samples_per_pixel, sample_rate } = waveformData;
    const waveformDuration = (length * samples_per_pixel) / sample_rate;
    
    console.log(`[generateWaveformData] Waveform validation:`);
    console.log(`  - length: ${length}`);
    console.log(`  - samples_per_pixel: ${samples_per_pixel}`);
    console.log(`  - sample_rate: ${sample_rate}`);
    console.log(`  - calculated duration: ${waveformDuration.toFixed(3)}s`);
    
    // Get actual audio duration using ffprobe (from WAV file)
    const ffprobeCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPathWav}"`;
    const { stdout: durationStr } = await exec(ffprobeCommand);
    const audioDuration = parseFloat(durationStr.trim());
    
    console.log(`  - actual audio duration: ${audioDuration.toFixed(3)}s`);
    console.log(`  - coverage: ${((waveformDuration / audioDuration) * 100).toFixed(2)}%`);
    
    if (waveformDuration < audioDuration - 0.1) {
      console.warn(`[generateWaveformData] ⚠️  WARNING: Waveform is truncated!`);
      console.warn(`  Missing ${(audioDuration - waveformDuration).toFixed(3)}s of audio data`);
    } else {
      console.log(`[generateWaveformData] ✅ Waveform covers full audio duration`);
    }
    
    // Clean up temp files
    await fs.unlink(audioPathMp3).catch(() => {});
    await fs.unlink(audioPathWav).catch(() => {});
    await fs.unlink(waveformPath).catch(() => {});
    
    console.log(`[generateWaveformData] Waveform generated successfully (${waveformJson.length} bytes)`);
    
    return waveformJson;
  } catch (error) {
    console.error('[generateWaveformData] Error:', error);
    throw new Error(`Failed to generate waveform: ${error.message}`);
  }
}

// ============================================================================
// 4. WHISPER TRANSCRIPTION
// ============================================================================

/**
 * Transcribe audio using OpenAI Whisper API with word-level timestamps
 * Downloads audio from URL and sends to Whisper
 */
async function transcribeWithWhisper(
  audioDownloadUrl: string,
  language: string = 'ro',
  userApiKey?: string
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
    
    // Use OpenAI SDK for Whisper transcription (handles multipart form correctly)
    // Create a File-like object from the buffer
    const audioFile = new File([Buffer.from(audioBuffer)], 'audio.mp3', { type: 'audio/mpeg' });
    
    const openai = getOpenAIClient(userApiKey);
    const transcription: any = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });
    
    // Convert Whisper timestamps from seconds to milliseconds
    const words: WhisperWord[] = (transcription.words || []).map((w: any) => ({
      word: w.word,
      start: Math.round(w.start * 1000),  // Convert seconds → milliseconds
      end: Math.round(w.end * 1000)       // Convert seconds → milliseconds
    }));
    
    console.log(`[transcribeWithWhisper] Transcribed ${words.length} words (timestamps in milliseconds)`);
    
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
  redTextPosition: 'START' | 'END',  // Position from database (redStart/redEnd)
  marginMs: number = 50
): { cutPoints: CutPoints | null; debugInfo: EditingDebugInfo } {
  try {
    const marginS = marginMs / 1000.0;
    
    // STEP 1: Use red text position from database (not startsWith/endsWith!)
    const redAtStart = redTextPosition === 'START';
    const redAtEnd = redTextPosition === 'END';
    
    console.log(`[calculateCutPoints] Red text position from database: ${redTextPosition}`);
    console.log(`[calculateCutPoints] fullText: "${fullText}"`);
    console.log(`[calculateCutPoints] redText: "${redText}"`);
    
    // STEP 2: Extract the key word to search for
    const redWords = redText.split(/\s+/).filter(w => w.length > 0);
    let keyWord: string;
    let searchForFirst: boolean; // true = search for first occurrence, false = search for last
    
    if (redAtStart) {
      // Red text at START → search for LAST red word (FIRST occurrence)
      keyWord = redWords[redWords.length - 1];
      searchForFirst = true;
      console.log(`[calculateCutPoints] Red text at START, searching for LAST red word: "${keyWord}" (FIRST occurrence)`);
    } else {
      // Red text at END → search for FIRST red word (LAST occurrence)
      keyWord = redWords[0];
      searchForFirst = false;
      console.log(`[calculateCutPoints] 🔴 NEW CODE: Red text at END, searching for FIRST red word: "${keyWord}" (LAST occurrence)`);
      console.log(`[calculateCutPoints] 🔴 redWords array:`, redWords);
    }
    
    // STEP 3: Find the key word in transcript
    const normalizedKeyWord = normalizeWord(keyWord);
    let keyWordIndex = -1;
    
    if (searchForFirst) {
      // Find FIRST occurrence
      for (let i = 0; i < words.length; i++) {
        if (normalizeWord(words[i].word) === normalizedKeyWord) {
          keyWordIndex = i;
          break;
        }
      }
    } else {
      // Find LAST occurrence
      for (let i = words.length - 1; i >= 0; i--) {
        if (normalizeWord(words[i].word) === normalizedKeyWord) {
          keyWordIndex = i;
          break;
        }
      }
    }
    
    if (keyWordIndex === -1) {
      console.error(`[calculateCutPoints] Key word "${keyWord}" not found in transcript`);
      const debugInfo: EditingDebugInfo = {
        status: 'warning',
        message: `⚠️ Key word "${keyWord}" not found in transcript`,
        redTextDetected: {
          found: false,
          fullText: redText,
        },
        whisperTranscript: words.map(w => w.word).join(' '),
        whisperWordCount: words.length,
      };
      return { cutPoints: null, debugInfo };
    }
    
    console.log(`[calculateCutPoints] Found key word "${keyWord}" at index ${keyWordIndex}, timestamp: ${words[keyWordIndex].start}s - ${words[keyWordIndex].end}s`);

    // STEP 4: Calculate cut points based on position
    let startKeep: number;
    let endKeep: number;
    let redPosition: 'START' | 'END';

    if (redAtStart) {
      // RED TEXT AT START → Keep from AFTER key word until END
      const keyWordTimestamp = words[keyWordIndex];
      startKeep = keyWordTimestamp.end + marginS;

      const lastWord = words[words.length - 1];
      endKeep = lastWord.end + marginS;

      redPosition = 'START';
      console.log(`[calculateCutPoints] RED AT START: Keep ${startKeep}ms (after "${keyWord}") → ${endKeep}ms (end)`);
    } else {
      // RED TEXT AT END → Keep from START until BEFORE key word
      const firstWord = words[0];
      startKeep = Math.max(0, firstWord.start + marginS);

      const keyWordTimestamp = words[keyWordIndex];
      endKeep = keyWordTimestamp.start - marginS;

      if (endKeep <= startKeep) {
        console.error('[calculateCutPoints] No white text before red text');
        const debugInfo: EditingDebugInfo = {
          status: 'error',
          message: `❌ No white text before red text - cannot calculate cut points`,
          redTextDetected: {
            found: true,
            position: 'END',
            fullText: redText,
          },
          whisperTranscript: words.map(w => w.word).join(' '),
          whisperWordCount: words.length,
        };
        return { cutPoints: null, debugInfo };
      }

      redPosition = 'END';
      console.log(`[calculateCutPoints] RED AT END: Keep ${startKeep}ms (start) → ${endKeep}ms (before "${keyWord}")`);
    }

    const confidence = 0.95;

    // Get key word timestamp
    const keyWordTimestamp = words[keyWordIndex];

    const cutPoints: CutPoints = {
      startKeep: Math.round(startKeep),
      endKeep: Math.round(endKeep),
      redPosition,
      confidence,
    };

    const debugInfo: EditingDebugInfo = {
      status: 'success',
      message: `✅ Red text detected at ${redPosition}: "${redText}" (key word: "${keyWord}" at ${keyWordTimestamp.start.toFixed(2)}s - ${keyWordTimestamp.end.toFixed(2)}s)`,
      redTextDetected: {
        found: true,
        position: redPosition,
        fullText: redText,
        timeRange: { start: keyWordTimestamp.start, end: keyWordTimestamp.end },
        matchedWords: [keyWord],
      },
      whisperTranscript: words.map(w => w.word).join(' '),
      whisperWordCount: words.length,
    };

    return { cutPoints, debugInfo };
  } catch (error) {
    console.error('[calculateCutPoints] Error:', error);
    const debugInfo: EditingDebugInfo = {
      status: 'error',
      message: `❌ Error calculating cut points: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
    return { cutPoints: null, debugInfo };
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
  videoName: string,
  fullText: string,
  redText: string,
  redTextPosition: 'START' | 'END' | undefined,
  marginMs: number = 50,
  userApiKey?: string,
  ffmpegApiKey?: string,
  cleanvoiceApiKey?: string,
  userId?: number
): Promise<ProcessingResult> {
  try {
    const startTime = Date.now();
    console.log(`[processVideoForEditing] ⏱️ START ${videoName} at ${new Date().toISOString()}`);
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured');
    }
    
    if (!cleanvoiceApiKey || !userId) {
      throw new Error('CleanVoice API Key not configured');
    }
    
    // STEP 1: Upload video to FFmpeg API
    const uploadStartTime = Date.now();
    console.log(`[processVideoForEditing] 📤 FFMPEG UPLOAD START for ${videoName}`);
    const sanitizedVideoName = videoName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const videoFileName = `video_${sanitizedVideoName}.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`[processVideoForEditing] ✅ FFMPEG UPLOAD DONE in ${uploadDuration}ms`);
    
    // STEP 2: Extract WAV audio with FFmpeg
    const extractStartTime = Date.now();
    console.log(`[processVideoForEditing] 🎵 WAV EXTRACT START for ${videoName}`);
    const timestamp = Date.now();
    const wavFileName = `${sanitizedVideoName}_${timestamp}.wav`;
    const wavDownloadUrl = await extractWAVWithFFmpegAPI(videoFilePath, wavFileName, ffmpegApiKey);
    const extractDuration = Date.now() - extractStartTime;
    console.log(`[processVideoForEditing] ✅ WAV EXTRACT DONE in ${extractDuration}ms`);
    
    // STEP 3: Download WAV and upload to Bunny CDN for permanent storage
    const downloadStartTime = Date.now();
    console.log(`[processVideoForEditing] ⬇️ WAV DOWNLOAD START for ${videoName}`);
    const wavResponse = await fetch(wavDownloadUrl);
    if (!wavResponse.ok) {
      throw new Error(`Failed to download WAV: ${wavResponse.statusText}`);
    }
    const wavBuffer = Buffer.from(await wavResponse.arrayBuffer());
    const downloadDuration = Date.now() - downloadStartTime;
    console.log(`[processVideoForEditing] ✅ WAV DOWNLOAD DONE in ${downloadDuration}ms`);
    
    const bunnyUploadStartTime = Date.now();
    console.log(`[processVideoForEditing] ☁️ BUNNY UPLOAD START for ${videoName}`);
    const wavPath = `user-${userId}/audio/${wavFileName}`;
    const bunnyWavUrl = await uploadToBunnyCDN(wavBuffer, wavPath, 'audio/wav');
    const bunnyUploadDuration = Date.now() - bunnyUploadStartTime;
    console.log(`[processVideoForEditing] ✅ BUNNY UPLOAD DONE in ${bunnyUploadDuration}ms`);
    console.log(`[processVideoForEditing] WAV uploaded to Bunny: ${bunnyWavUrl}`);
    
    // STEP 4: Generate waveform from WAV (for Peaks.js)
    const waveformStartTime = Date.now();
    console.log(`[processVideoForEditing] 🌊 WAVEFORM START for ${videoName}`);
    const waveformData = await generateWaveformData(bunnyWavUrl, videoId, videoName);
    const waveformDuration = Date.now() - waveformStartTime;
    console.log(`[processVideoForEditing] ✅ WAVEFORM DONE in ${waveformDuration}ms`);
    
    // STEP 5: Send same WAV to Whisper + CleanVoice (PARALLEL)
    console.log(`[processVideoForEditing] 🚀 PARALLEL START (Whisper + CleanVoice) for ${videoName}`);
    const parallelStartTime = Date.now();
    
    const { processVideoWithCleanVoice } = await import('./cleanvoice.js');
    
    const [whisperResult, cleanvoiceResult] = await Promise.allSettled([
      // Whisper: Transcribe WAV audio
      transcribeWithWhisper(bunnyWavUrl, 'ro', userApiKey),
      
      // CleanVoice: Process WAV audio (returns cleaned WAV)
      processVideoWithCleanVoice(bunnyWavUrl, videoName, userId, cleanvoiceApiKey),
    ]);
    
    const parallelDuration = Date.now() - parallelStartTime;
    console.log(`[processVideoForEditing] ✅ PARALLEL DONE in ${parallelDuration}ms`);
    
    // Extract results
    if (whisperResult.status === 'rejected') {
      throw new Error(`Whisper failed: ${whisperResult.reason}`);
    }
    const { words, fullTranscript } = whisperResult.value;
    
    if (cleanvoiceResult.status === 'rejected') {
      throw new Error(`CleanVoice failed: ${cleanvoiceResult.reason}`);
    }
    const cleanvoiceAudioUrl = cleanvoiceResult.value;
    
    // STEP 6: Calculate cut points
    const cutPointsStartTime = Date.now();
    const { cutPoints, debugInfo } = calculateCutPointsNew(fullText, redText, words, redTextPosition, marginMs);
    const cutPointsDuration = Date.now() - cutPointsStartTime;
    console.log(`[processVideoForEditing] ✂️ CUT POINTS calculated in ${cutPointsDuration}ms`);
    
    const totalDuration = Date.now() - startTime;
    console.log(`[processVideoForEditing] ✅ TOTAL COMPLETE for ${videoName} in ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    console.log(`[processVideoForEditing] 📊 BREAKDOWN: Upload=${uploadDuration}ms, Extract=${extractDuration}ms, Waveform=${waveformDuration}ms, Parallel=${parallelDuration}ms`);
    
    return {
      words,
      cutPoints,
      whisperTranscript: fullTranscript,
      audioUrl: bunnyWavUrl, // Use FFmpeg WAV URL (not CleanVoice)
      waveformJson: waveformData,
      editingDebugInfo: debugInfo,
      cleanvoiceAudioUrl, // CleanVoice processed audio URL
    };
  } catch (error) {
    console.error(`[processVideoForEditing] Error for video ${videoId}:`, error);
    // Return error debug info instead of throwing
    const errorDebugInfo: EditingDebugInfo = {
      status: 'error',
      message: `❌ Whisper API error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
    throw error; // Still throw to maintain existing error handling
  }
}

// ============================================================================
// 7. STEP 7 PROCESSING FUNCTIONS (SPLIT INTO 2 PARTS)
// ============================================================================

/**
 * STEP 1: Extract WAV from video using FFmpeg API
 * Returns: WAV URL (Bunny CDN) + waveform JSON
 */
export async function extractWAVFromVideo(
  videoUrl: string,
  videoId: number,
  videoName: string,
  ffmpegApiKey: string,
  userId: number
): Promise<{
  wavUrl: string;
  waveformJson: string;
}> {
  try {
    const startTime = Date.now();
    console.log(`[extractWAVFromVideo] ⏱️ START ${videoName}`);
    
    // STEP 1: Upload video to FFmpeg API
    const uploadStartTime = Date.now();
    console.log(`[extractWAVFromVideo] 📤 FFMPEG UPLOAD START for ${videoName}`);
    const sanitizedVideoName = videoName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const videoFileName = `video_${sanitizedVideoName}.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`[extractWAVFromVideo] ✅ FFMPEG UPLOAD DONE in ${uploadDuration}ms`);
    
    // STEP 2: Extract WAV audio with FFmpeg
    const extractStartTime = Date.now();
    console.log(`[extractWAVFromVideo] 🎵 WAV EXTRACT START for ${videoName}`);
    const timestamp = Date.now();
    const wavFileName = `${sanitizedVideoName}_${timestamp}.wav`;
    const wavDownloadUrl = await extractWAVWithFFmpegAPI(videoFilePath, wavFileName, ffmpegApiKey);
    const extractDuration = Date.now() - extractStartTime;
    console.log(`[extractWAVFromVideo] ✅ WAV EXTRACT DONE in ${extractDuration}ms`);
    
    // STEP 3: Download WAV and upload to Bunny CDN
    const downloadStartTime = Date.now();
    console.log(`[extractWAVFromVideo] ⬇️ WAV DOWNLOAD START for ${videoName}`);
    const wavResponse = await fetch(wavDownloadUrl);
    if (!wavResponse.ok) {
      throw new Error(`Failed to download WAV: ${wavResponse.statusText}`);
    }
    const wavBuffer = Buffer.from(await wavResponse.arrayBuffer());
    const downloadDuration = Date.now() - downloadStartTime;
    console.log(`[extractWAVFromVideo] ✅ WAV DOWNLOAD DONE in ${downloadDuration}ms`);
    
    const bunnyUploadStartTime = Date.now();
    console.log(`[extractWAVFromVideo] ☁️ BUNNY UPLOAD START for ${videoName}`);
    const wavPath = `user-${userId}/audio/${wavFileName}`;
    const bunnyWavUrl = await uploadToBunnyCDN(wavBuffer, wavPath, 'audio/wav');
    const bunnyUploadDuration = Date.now() - bunnyUploadStartTime;
    console.log(`[extractWAVFromVideo] ✅ BUNNY UPLOAD DONE in ${bunnyUploadDuration}ms`);
    
    // STEP 4: Generate waveform from WAV
    const waveformStartTime = Date.now();
    console.log(`[extractWAVFromVideo] 🌊 WAVEFORM START for ${videoName}`);
    const waveformData = await generateWaveformData(bunnyWavUrl, videoId, videoName);
    const waveformDuration = Date.now() - waveformStartTime;
    console.log(`[extractWAVFromVideo] ✅ WAVEFORM DONE in ${waveformDuration}ms`);
    
    const totalDuration = Date.now() - startTime;
    console.log(`[extractWAVFromVideo] ✅ COMPLETE for ${videoName} in ${totalDuration}ms`);
    
    return {
      wavUrl: bunnyWavUrl,
      waveformJson: waveformData,
    };
  } catch (error) {
    console.error(`[extractWAVFromVideo] Error for ${videoName}:`, error);
    throw error;
  }
}

/**
 * STEP 2: Process WAV audio with Whisper + CleanVoice
 * Returns: Whisper transcript + CleanVoice audio + cut points
 */
export async function processAudioWithWhisperCleanVoice(
  wavUrl: string,
  videoId: number,
  videoName: string,
  fullText: string,
  redText: string,
  redTextPosition: 'START' | 'END' | undefined,
  marginMs: number = 50,
  userApiKey?: string,
  cleanvoiceApiKey?: string,
  userId?: number
): Promise<{
  words: WhisperWord[];
  cutPoints: CutPoints | null;
  whisperTranscript: any;
  cleanvoiceAudioUrl: string;
  editingDebugInfo: EditingDebugInfo;
}> {
  try {
    const startTime = Date.now();
    console.log(`[processAudioWithWhisperCleanVoice] ⏱️ START ${videoName}`);
    
    if (!cleanvoiceApiKey || !userId) {
      throw new Error('CleanVoice API Key not configured');
    }
    
    // Send WAV to Whisper + CleanVoice (PARALLEL)
    console.log(`[processAudioWithWhisperCleanVoice] 🚀 PARALLEL START for ${videoName}`);
    const parallelStartTime = Date.now();
    
    const { processVideoWithCleanVoice } = await import('./cleanvoice.js');
    
    const [whisperResult, cleanvoiceResult] = await Promise.allSettled([
      transcribeWithWhisper(wavUrl, 'ro', userApiKey),
      processVideoWithCleanVoice(wavUrl, videoName, userId, cleanvoiceApiKey),
    ]);
    
    const parallelDuration = Date.now() - parallelStartTime;
    console.log(`[processAudioWithWhisperCleanVoice] ✅ PARALLEL DONE in ${parallelDuration}ms`);
    
    // Extract results
    if (whisperResult.status === 'rejected') {
      throw new Error(`Whisper failed: ${whisperResult.reason}`);
    }
    const { words, fullTranscript } = whisperResult.value;
    
    if (cleanvoiceResult.status === 'rejected') {
      throw new Error(`CleanVoice failed: ${cleanvoiceResult.reason}`);
    }
    const cleanvoiceAudioUrl = cleanvoiceResult.value;
    
    // Calculate cut points
    const cutPointsStartTime = Date.now();
    const { cutPoints, debugInfo } = calculateCutPointsNew(fullText, redText, words, redTextPosition, marginMs);
    const cutPointsDuration = Date.now() - cutPointsStartTime;
    console.log(`[processAudioWithWhisperCleanVoice] ✂️ CUT POINTS in ${cutPointsDuration}ms`);
    
    const totalDuration = Date.now() - startTime;
    console.log(`[processAudioWithWhisperCleanVoice] ✅ COMPLETE for ${videoName} in ${totalDuration}ms`);
    
    return {
      words,
      cutPoints,
      whisperTranscript: fullTranscript,
      cleanvoiceAudioUrl,
      editingDebugInfo: debugInfo,
    };
  } catch (error) {
    console.error(`[processAudioWithWhisperCleanVoice] Error for ${videoName}:`, error);
    throw error;
  }
}

// ============================================================================
// 8. VIDEO CUTTING FUNCTION (STEP 10)
// ============================================================================

/**
 * Cut video using FFmpeg API with start/end timestamps
 * Returns download URL for the trimmed video
 */
export async function cutVideoWithFFmpegAPI(
  videoUrl: string,
  videoName: string,
  startTimeSeconds: number,
  endTimeSeconds: number,
  ffmpegApiKey: string,
  cleanVoiceAudioUrl?: string,  // Optional CleanVoice audio URL
  userId?: number,  // Optional userId for user-specific folder
  dirId?: string  // Optional: shared directory ID for batch processing
): Promise<string> {
  try {
    console.log(`[cutVideoWithFFmpegAPI] Cutting video ${videoName}: ${startTimeSeconds}s → ${endTimeSeconds}s`);
    console.log(`[cutVideoWithFFmpegAPI] 👤 userId:`, userId, `(type: ${typeof userId})`);
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured. Please set it in Settings.');
    }
    
    const duration = endTimeSeconds - startTimeSeconds;
    
    // 1. Create directory for this trim operation (or reuse existing dirId)
    let finalDirId = dirId;
    
    if (!finalDirId) {
      console.log(`[cutVideoWithFFmpegAPI] Creating new directory...`);
      const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
        method: 'POST',
        headers: {
          'Authorization': ffmpegApiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (!dirRes.ok) {
        throw new Error(`Failed to create directory: ${dirRes.statusText}`);
      }
      
      const dirData = await dirRes.json();
      console.log(`[cutVideoWithFFmpegAPI] Directory API response:`, JSON.stringify(dirData));
      finalDirId = dirData.id || dirData.directory?.id || dirData.dir_id;
      console.log(`[cutVideoWithFFmpegAPI] Created directory: ${finalDirId}`);
      
      if (!finalDirId) {
        throw new Error(`Failed to extract directory ID from response: ${JSON.stringify(dirData)}`);
      }
    } else {
      console.log(`[cutVideoWithFFmpegAPI] Reusing existing directory: ${finalDirId}`);
    }
    
    // 2. Upload video to FFmpeg API (in the same directory)
    const videoFileName = `${videoName}_original.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey, finalDirId);
    
    // 3. Upload CleanVoice audio if provided (in the SAME directory)
    let audioFilePath: string | undefined;
    if (cleanVoiceAudioUrl) {
      console.log(`[cutVideoWithFFmpegAPI] Uploading CleanVoice audio to same directory...`);
      const audioFileName = `${videoName}_cleanvoice.mp3`;
      audioFilePath = await uploadVideoToFFmpegAPI(cleanVoiceAudioUrl, audioFileName, ffmpegApiKey, finalDirId);
      console.log(`[cutVideoWithFFmpegAPI] CleanVoice audio uploaded: ${audioFilePath}`);
    }
    
    // 3. VARIANT 1: Cut BOTH inputs (video + audio) at same start/end for perfect sync
    const outputFileName = `${videoName}_trimmed_${Date.now()}.mp4`;
    
    const task: any = {
      inputs: [
        {
          file_path: videoFilePath,
          options: ['-ss', startTimeSeconds.toString(), '-t', duration.toString()]  // Cut video input
        }
      ],
      outputs: [
        {
          file: outputFileName,
          options: [] as string[]
        }
      ]
    };
    
    // If CleanVoice audio provided, cut it at SAME timestamps as video
    if (audioFilePath) {
      task.inputs.push({
        file_path: audioFilePath,
        options: ['-ss', startTimeSeconds.toString(), '-t', duration.toString()]  // Cut audio input (SAME as video!)
      });
      
      // Output options: Map both cut streams and replace audio
      task.outputs[0].options = [
        '-map', '0:v:0',       // Map video from input 0 (already cut)
        '-map', '1:a:0',       // Map audio from input 1 (already cut at SAME timestamps)
        '-c:v', 'copy',        // Copy video codec (FAST, no re-encoding)
        '-c:a', 'aac',         // AAC audio codec
        '-b:a', '192k',        // 192 kbps audio bitrate
        '-ar', '48000'         // 48 kHz sample rate
      ];
      console.log(`[cutVideoWithFFmpegAPI] ✅ VARIANT 1: Cut both video AND audio at ${startTimeSeconds}s-${endTimeSeconds}s (perfect sync)`);
    } else {
      // No CleanVoice audio, just trim with original audio
      task.outputs[0].options = [
        '-c:v', 'copy',     // Copy video codec (FAST)
        '-c:a', 'copy'      // Copy audio codec (FAST)
      ];
      console.log(`[cutVideoWithFFmpegAPI] Task configured: Trim only (no audio replacement)`);
    }
    
    // 4. Send to FFmpeg API
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task }),
    });
    
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error('[FFmpeg API] Error response:', errorText.substring(0, 500));
      throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
    }
    
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[FFmpeg API] Invalid JSON response:', responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON (possibly HTML error page)`);
    }
    
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
    }
    
    const downloadUrl = result.result[0].download_url;
    console.log(`[cutVideoWithFFmpegAPI] Video cut successfully! Temporary URL: ${downloadUrl}`);
    
    // 3. Download trimmed video from FFMPEG API
    console.log(`[cutVideoWithFFmpegAPI] Downloading trimmed video...`);
    const videoRes = await fetch(downloadUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download trimmed video: ${videoRes.statusText}`);
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    
    // 4. Upload to Bunny CDN for permanent storage
    console.log(`[cutVideoWithFFmpegAPI] Uploading to Bunny CDN...`);
    const trimmedPath = userId ? `user-${userId}/videos/trimmed/${outputFileName}` : `videos/trimmed/${outputFileName}`;
    console.log(`[cutVideoWithFFmpegAPI] 📁 Upload path:`, trimmedPath, `(userId: ${userId})`);
    
    const bunnyVideoUrl = await uploadToBunnyCDN(
      videoBuffer,
      trimmedPath,
      'video/mp4'
    );
    console.log(`[cutVideoWithFFmpegAPI] Video uploaded to Bunny CDN: ${bunnyVideoUrl}`);
    
    return bunnyVideoUrl;
  } catch (error) {
    console.error('[cutVideoWithFFmpegAPI] Error:', error);
    throw new Error(`Failed to cut video: ${error.message}`);
  }
}
// NEW ALGORITHM WITH DETAILED LOGGING
// Based on Scenariu.txt requirements

import { WhisperWord, CutPoints, EditingDebugInfo } from './videoEditing';

/**
 * Normalize text for comparison (remove diacritics, punctuation, lowercase, trim)
 */
function normalizeText(text: string): string {
  return text
    // Remove diacritics (Romanian: ă→a, â→a, î→i, ș→s, ț→t)
    .normalize('NFD')  // Decompose characters with diacritics
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritical marks
    // Remove ALL punctuation (quotes, hyphens, parentheses, etc.)
    .replace(/[^\w\s]/g, '')  // Keep only word characters and spaces
    .toLowerCase()
    .trim();
}

/**
 * Search for a sequence of words in transcript
 * Returns the index range if found, null otherwise
 */
function findSequence(
  words: WhisperWord[],
  searchWords: string[],
  searchFromEnd: boolean = false  // If true, find LAST occurrence instead of first
): { startIdx: number; endIdx: number } | null {
  // Return null if search words is empty
  if (!searchWords || searchWords.length === 0) {
    return null;
  }
  
  const normalizedSearch = searchWords.map(normalizeText);

  // If searchFromEnd, iterate backwards to find LAST occurrence
  if (searchFromEnd) {
    for (let i = words.length - normalizedSearch.length; i >= 0; i--) {
      let match = true;
      
      for (let j = 0; j < normalizedSearch.length; j++) {
        const wordNormalized = normalizeText(words[i + j].word);
        if (wordNormalized !== normalizedSearch[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        return {
          startIdx: i,
          endIdx: i + normalizedSearch.length - 1,
        };
      }
    }
  } else {
    // Default: search from beginning to find FIRST occurrence
    for (let i = 0; i <= words.length - normalizedSearch.length; i++) {
      let match = true;
      
      for (let j = 0; j < normalizedSearch.length; j++) {
        const wordNormalized = normalizeText(words[i + j].word);
        if (wordNormalized !== normalizedSearch[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        return {
          startIdx: i,
          endIdx: i + normalizedSearch.length - 1,
        };
      }
    }
  }

  return null;
}

/**
 * Check if sequence is at the beginning of transcript (within first 20% of words)
 */
function isAtBeginning(startIdx: number, totalWords: number): boolean {
  return startIdx < totalWords * 0.2;
}

/**
 * Check if sequence is at the end of transcript (within last 20% of words)
 */
function isAtEnd(endIdx: number, totalWords: number): boolean {
  return endIdx > totalWords * 0.8;
}

/**
 * NEW ALGORITHM: Calculate cut points with detailed logging
 */
export function calculateCutPointsNew(
  fullText: string,
  redText: string,
  words: WhisperWord[],
  redTextPosition: 'START' | 'END' | undefined,
  marginMs: number = 50
): { cutPoints: CutPoints | null; debugInfo: EditingDebugInfo } {
  const logs: string[] = [];
  const marginS = marginMs / 1000.0;
  
  // Derive white text based on red text position
  let whiteText: string;
  
  // If no red text, white text is the entire full text
  if (!redText || redText.trim().length === 0) {
    whiteText = fullText.trim();
  } else if (redTextPosition === 'START') {
    // Red at start → white text is everything AFTER red text
    whiteText = fullText.substring(redText.length).trim();
  } else {
    // Red at end → white text is everything BEFORE red text
    whiteText = fullText.substring(0, fullText.length - redText.length).trim();
  }
  
  // Preprocess text: replace hyphens, commas, quotes with spaces for better matching
  const preprocessText = (text: string) => text.replace(/[-,."']/g, ' ');
  
  // Normalize and split white text
  const preprocessedWhiteText = preprocessText(whiteText);
  const normalizedWhiteText = normalizeText(preprocessedWhiteText);
  const whiteWords = normalizedWhiteText.split(/\s+/).filter(w => w.length > 0);
  
  // Normalize and split red text
  const preprocessedRedText = preprocessText(redText);
  const normalizedRedText = normalizeText(preprocessedRedText);
  const redWords = normalizedRedText.split(/\s+/).filter(w => w.length > 0);
  
  logs.push(`🔍 Starting search algorithm...`);
  logs.push(`📄 Full text: "${fullText}"`);
  logs.push(`⚪ White text: "${whiteText}" (${whiteWords.length} words)`);
  logs.push(`🔴 Red text: "${redText}" (${redWords.length} words, position: ${redTextPosition})`);
  logs.push(`🎤 Whisper transcript: "${words.map(w => w.word).join(' ')}" (${words.length} words)`);
  logs.push(``);
  
  // STEP 1: Search for entire white text
  logs.push(`🔎 Step 1: Searching for entire white text...`);
  const whiteMatch = findSequence(words, whiteWords);
  
  if (whiteMatch) {
    logs.push(`✅ Searched for entire white text: FOUND at indices ${whiteMatch.startIdx}-${whiteMatch.endIdx}`);
    
    const startWord = words[whiteMatch.startIdx];
    const endWord = words[whiteMatch.endIdx];
    
      const startKeep = Math.max(0, startWord.start - marginS);
    const endKeep = endWord.end + marginS;
    
    logs.push(`✅ Placed START marker before "${startWord.word}" at ${startKeep.toFixed(0)}ms`);
    logs.push(`✅ Placed END marker after "${endWord.word}" at ${endKeep.toFixed(0)}ms`);
    logs.push(`🎯 Algorithm complete!`);
    
    return {
      cutPoints: {
        startKeep: Math.round(startKeep),
        endKeep: Math.round(endKeep),
        redPosition: redTextPosition || 'START',  // Default to START if undefined
        confidence: 0.95,
      },
      debugInfo: {
        status: 'success',
        message: `✅ Found entire white text`,
        whisperTranscript: words.map(w => w.word).join(' '),
        whisperWordCount: words.length,
        redTextDetected: {
          found: !redText || redText.trim().length === 0 ? false : true,
          position: redTextPosition,
          fullText: redText,
        },
        algorithmLogs: logs,
      },
    };
  }
  
  logs.push(`❌ Searched for entire white text: NOT FOUND`);
  logs.push(``);
  
  
  // STEP 3: Search for last 3/2 words of white text
  logs.push(`🔎 Step 2: Searching for last 3 words of white text...`);
  
  for (let n = 3; n >= 2; n--) {
    if (whiteWords.length < n) continue;
    
    const lastNWords = whiteWords.slice(-n);
    logs.push(`🔍 Searching for last ${n} white words: "${lastNWords.join(' ')}"`);
    
    const match = findSequence(words, lastNWords);
    
    if (match) {
      logs.push(`✅ Found last ${n} white words at indices ${match.startIdx}-${match.endIdx}`);
      
      // Check if white text is at beginning of original text
      if (redTextPosition === 'END') {
        // White text is at beginning → place END marker AFTER last word of match
        logs.push(`✅ White text is at beginning → placing END marker AFTER last word`);
        
        const lastMatchWord = words[match.endIdx];
        const startKeep = Math.max(0, words[0].start - marginS);
        const endKeep = lastMatchWord.end + marginS;
        
        logs.push(`✅ Placed START marker at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker after "${lastMatchWord.word}" at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'END',
            confidence: 0.80,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found last ${n} white words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`⚠️ White text is at end → last words don't help us`);
      }
    } else {
      logs.push(`❌ Last ${n} white words: NOT FOUND`);
    }
  }
  
  logs.push(``);
  
  // STEP 4: Search for first 3/2 words of white text
  logs.push(`🔎 Step 3: Searching for first 3 words of white text...`);
  
  for (let n = 3; n >= 2; n--) {
    if (whiteWords.length < n) continue;
    
    const firstNWords = whiteWords.slice(0, n);
    logs.push(`🔍 Searching for first ${n} white words: "${firstNWords.join(' ')}"`);
    
    const match = findSequence(words, firstNWords);
    
    if (match) {
      logs.push(`✅ Found first ${n} white words at indices ${match.startIdx}-${match.endIdx}`);
      
      // Check if white text is at end of original text
      if (redTextPosition === 'START') {
        // White text is at end → place START marker BEFORE first word of match
        logs.push(`✅ White text is at end → placing START marker BEFORE first word`);
        
        const firstMatchWord = words[match.startIdx];
        const startKeep = firstMatchWord.start - marginS;
        const endKeep = words[words.length - 1].end + marginS;
        
        logs.push(`✅ Placed START marker before "${firstMatchWord.word}" at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'START',
            confidence: 0.80,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found first ${n} white words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`⚠️ White text is at beginning → first words don't help us`);
      }
    } else {
      logs.push(`❌ First ${n} white words: NOT FOUND`);
    }
  }
  
  logs.push(``);
  
  // STEP 5: Search for last 3/2 words of red text (if red at START)
  if (redTextPosition === 'START') {
    logs.push(`🔎 Step 4: Red text is at START → searching for last 3 words of red text...`);
    
    for (let n = 3; n >= 2; n--) {
      if (redWords.length < n) continue;
      
      const lastNWords = redWords.slice(-n);
      logs.push(`🔍 Searching for last ${n} red words: "${lastNWords.join(' ')}"`);
      
      const match = findSequence(words, lastNWords);
      
      if (match) {
        logs.push(`✅ Found last ${n} red words at indices ${match.startIdx}-${match.endIdx}`);
        logs.push(`✅ This marks END of red text → placing START marker AFTER last word`);
        
        const lastMatchWord = words[match.endIdx];
        const startKeep = lastMatchWord.end + marginS;
        const endKeep = words[words.length - 1].end + marginS;
        
        logs.push(`✅ Placed START marker after "${lastMatchWord.word}" at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'START',
            confidence: 0.75,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found last ${n} red words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`❌ Last ${n} red words: NOT FOUND`);
      }
    }
  }
  
  // STEP 6: Search for first 3/2 words of red text (if red at END)
  if (redTextPosition === 'END') {
    logs.push(`🔎 Step 5: Red text is at END → searching for first 3 words of red text...`);
    
    for (let n = 3; n >= 2; n--) {
      if (redWords.length < n) continue;
      
      const firstNWords = redWords.slice(0, n);
      logs.push(`🔍 Searching for first ${n} red words: "${firstNWords.join(' ')}"`);
      
      const match = findSequence(words, firstNWords);
      
      if (match) {
        logs.push(`✅ Found first ${n} red words at indices ${match.startIdx}-${match.endIdx}`);
        logs.push(`✅ This marks START of red text → placing END marker BEFORE first word`);
        
        const firstMatchWord = words[match.startIdx];
        const startKeep = Math.max(0, words[0].start - marginS);
        const endKeep = firstMatchWord.start - marginS;
        
        if (endKeep <= startKeep) {
          logs.push(`❌ No white text before red text - cannot calculate cut points`);
          
          return {
            cutPoints: null,
            debugInfo: {
              status: 'error',
              message: `❌ No white text before red text`,
              whisperTranscript: words.map(w => w.word).join(' '),
              whisperWordCount: words.length,
              algorithmLogs: logs,
            },
          };
        }
        
        logs.push(`✅ Placed START marker at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker before "${firstMatchWord.word}" at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'END',
            confidence: 0.75,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found first ${n} red words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`❌ First ${n} red words: NOT FOUND`);
      }
    }
  }
  // STEP 2: Search for entire red text
  logs.push(`🔎 Step 6: Searching for entire red text...`);
  // If redTextPosition is END, search from end to find LAST occurrence
  const searchFromEnd = redTextPosition === 'END';
  const redMatch = findSequence(words, redWords, searchFromEnd);
  
  if (redMatch) {
    logs.push(`✅ Searched for entire red text: FOUND at indices ${redMatch.startIdx}-${redMatch.endIdx}`);
    
    const redAtBeginning = isAtBeginning(redMatch.startIdx, words.length);
    const redAtEnd = isAtEnd(redMatch.endIdx, words.length);
    
    if (redAtEnd) {
      // Red text at END → place END marker BEFORE first red word
      logs.push(`✅ Red text is at END of transcript → placing END marker BEFORE first red word`);
      
      const firstRedWord = words[redMatch.startIdx];
      const startKeep = Math.max(0, words[0].start - marginS);
      const endKeep = firstRedWord.start - marginS;
      
      if (endKeep <= startKeep) {
        logs.push(`❌ No white text before red text - cannot calculate cut points`);
        
        return {
          cutPoints: null,
          debugInfo: {
            status: 'error',
            message: `❌ No white text before red text`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      }
      
      logs.push(`✅ Placed START marker at ${startKeep.toFixed(0)}ms`);
      logs.push(`✅ Placed END marker before "${firstRedWord.word}" at ${endKeep.toFixed(0)}ms`);
      logs.push(`🎯 Algorithm complete!`);
      
      return {
        cutPoints: {
          startKeep: Math.round(startKeep),
          endKeep: Math.round(endKeep),
          redPosition: 'END',
          confidence: 0.90,
        },
        debugInfo: {
          status: 'success',
          message: `✅ Found entire red text at END`,
          whisperTranscript: words.map(w => w.word).join(' '),
          whisperWordCount: words.length,
          redTextDetected: {
            found: true,
            position: 'END',
            fullText: redText,
            timeRange: { start: words[redMatch.startIdx].start, end: words[redMatch.endIdx].end },
          },
          algorithmLogs: logs,
        },
      };
    } else if (redAtBeginning) {
      // Red text at START → place START marker AFTER last red word
      logs.push(`✅ Red text is at BEGINNING of transcript → placing START marker AFTER last red word`);
      
      const lastRedWord = words[redMatch.endIdx];
      const startKeep = lastRedWord.end + marginS;
      const endKeep = words[words.length - 1].end + marginS;
      
      logs.push(`✅ Placed START marker after "${lastRedWord.word}" at ${startKeep.toFixed(0)}ms`);
      logs.push(`✅ Placed END marker at ${endKeep.toFixed(0)}ms`);
      logs.push(`🎯 Algorithm complete!`);
      
      return {
        cutPoints: {
          startKeep: Math.round(startKeep),
          endKeep: Math.round(endKeep),
          redPosition: 'START',
          confidence: 0.90,
        },
        debugInfo: {
          status: 'success',
          message: `✅ Found entire red text at START`,
          whisperTranscript: words.map(w => w.word).join(' '),
          whisperWordCount: words.length,
          redTextDetected: {
            found: true,
            position: 'START',
            fullText: redText,
            timeRange: { start: words[redMatch.startIdx].start, end: words[redMatch.endIdx].end },
          },
          algorithmLogs: logs,
        },
      };
    }
  }
  
  logs.push(`❌ Searched for entire red text: NOT FOUND`);
  logs.push(``);
  
  // FALLBACK: No matches found - return default cutPoints (0 to duration)
  logs.push(``);
  logs.push(`⚠️ Algorithm could not find matching text in transcript`);
  logs.push(`✅ Returning default cutPoints: 0 to ${words[words.length - 1].end.toFixed(0)}ms`);
  
  const startKeep = 0;
  const endKeep = words[words.length - 1].end + marginS;
  
  return {
    cutPoints: {
      startKeep: Math.round(startKeep),
      endKeep: Math.round(endKeep),
      redPosition: redTextPosition || 'START',
      confidence: 0.50,  // Low confidence since we didn't find the text
    },
    debugInfo: {
      status: 'warning',
      message: `⚠️ Could not find matching text - using default cutPoints (0 to duration)`,
      whisperTranscript: words.map(w => w.word).join(' '),
      whisperWordCount: words.length,
      algorithmLogs: logs,
    },
  };
}

// ============================================================================
// 8. VIDEO MERGING FUNCTIONS
// ============================================================================

/**
 * Merge videos using filter_complex (with re-encoding)
 * Used for Step 10 (Merge Final Videos)
 * 
 * Features:
 * - Uses filter_complex with concat filter
 * - Re-encodes video (libx264 CRF 18)
 * - Re-encodes audio (aac)
 * - Optional loudnorm audio normalization
 * 
 * @param videoUrls - Array of video URLs to merge
 * @param outputVideoName - Name for the output video
 * @param ffmpegApiKey - FFmpeg API key
 * @param userId - User ID for CDN upload
 * @param folder - Folder name for CDN upload (default: 'merged-final-videos')
 * @param useLoudnorm - Enable loudnorm audio normalization
 * @returns CDN URL of the merged video
 */
export async function mergeVideosWithFilterComplex(
  videoUrls: string[],
  outputVideoName: string,
  ffmpegApiKey: string,
  userId?: number,
  folder: string = 'merged-final-videos',
  useLoudnorm: boolean = true
): Promise<string> {
  try {
    console.log('\n\n========================================');
    console.log('[mergeVideosWithFilterComplex] 🚀 MERGE STARTED');
    console.log(`[mergeVideosWithFilterComplex] Output name: ${outputVideoName}`);
    console.log(`[mergeVideosWithFilterComplex] Video count: ${videoUrls.length}`);
    console.log(`[mergeVideosWithFilterComplex] Video URLs:`, videoUrls);
    console.log('========================================\n');
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured. Please set it in Settings.');
    }
    
    if (videoUrls.length === 0) {
      throw new Error('No videos provided for merging');
    }
    
    if (videoUrls.length === 1) {
      console.log(`[mergeVideosWithFilterComplex] Only 1 video, returning original URL`);
      return videoUrls[0];
    }
    
    // 1. BATCH PROCESSING: Create directory and register all files first
    console.log(`[mergeVideosWithFilterComplex] 📁 Step 1: Creating directory...`);
    const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!dirRes.ok) {
      throw new Error(`Failed to create directory: ${dirRes.statusText}`);
    }
    
    const dirData = await dirRes.json();
    const dirId = dirData.directory.id;
    console.log(`[mergeVideosWithFilterComplex] ✅ Created directory: ${dirId}`);
    
    // 2. Register ALL files at once (fast, ~100ms each)
    console.log(`[mergeVideosWithFilterComplex] 📝 Step 2: Registering ${videoUrls.length} files...`);
    const batchTimestamp = Date.now();
    
    const fileRegistrations = await Promise.all(
      videoUrls.map(async (videoUrl, i) => {
        const fileName = `merge_input_${i}_${batchTimestamp}.mp4`;
        
        const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
          method: 'POST',
          headers: {
            'Authorization': ffmpegApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file_name: fileName,
            dir_id: dirId
          })
        });
        
        if (!fileRes.ok) {
          throw new Error(`Failed to register file ${i}: ${fileRes.statusText}`);
        }
        
        const fileData = await fileRes.json();
        console.log(`[mergeVideosWithFilterComplex] ✅ Registered ${i + 1}/${videoUrls.length}: ${fileData.file.file_path}`);
        
        return {
          file: fileData.file,
          upload: fileData.upload,
          videoUrl
        };
      })
    );
    
    console.log(`[mergeVideosWithFilterComplex] ✅ All files registered!`);
    
    // 3. Download from Bunny CDN and upload to FFmpeg API (S3) in parallel
    console.log(`[mergeVideosWithFilterComplex] 📤 Step 3: Uploading ${videoUrls.length} videos to FFmpeg API...`);
    
    await Promise.all(
      fileRegistrations.map(async ({ upload, videoUrl, file }, i) => {
        console.log(`[mergeVideosWithFilterComplex] ⬇️ Downloading ${i + 1}/${videoUrls.length} from Bunny CDN...`);
        
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) {
          throw new Error(`Failed to download video ${i}: ${videoRes.status} ${videoRes.statusText}`);
        }
        
        const videoBuffer = await videoRes.arrayBuffer();
        const videoSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(2);
        console.log(`[mergeVideosWithFilterComplex] ✅ Downloaded ${i + 1}/${videoUrls.length}: ${videoSizeMB} MB`);
        
        console.log(`[mergeVideosWithFilterComplex] ⬆️ Uploading ${i + 1}/${videoUrls.length} to FFmpeg API (S3)...`);
        
        // Use headers from /file response if provided
        const uploadHeaders = upload.headers || {};
        
        const uploadRes = await fetch(upload.url, {
          method: 'PUT',
          body: videoBuffer,
          headers: uploadHeaders
        });
        
        if (!uploadRes.ok) {
          throw new Error(`Failed to upload video ${i}: ${uploadRes.statusText}`);
        }
        
        console.log(`[mergeVideosWithFilterComplex] ✅ Uploaded ${i + 1}/${videoUrls.length}: ${file.file_path}`);
      })
    );
    
    console.log(`[mergeVideosWithFilterComplex] ✅ All videos uploaded!`);
    
    // 4. Extract file paths for processing
    const uploadedFilePaths = fileRegistrations.map(({ file }) => file.file_path);
    
    console.log(`\n========================================`);
    console.log(`[mergeVideosWithFilterComplex] 📝 STEP 4: Extracted file paths`);
    console.log(`========================================`);
    console.log(`[mergeVideosWithFilterComplex] Uploaded video file paths:`);
    uploadedFilePaths.forEach((path, i) => {
      console.log(`[mergeVideosWithFilterComplex]   ${i + 1}. ${path}`);
    });
    console.log(`========================================\n`);
    
    // Save to file for debugging
    fs.writeFileSync('/tmp/ffmpeg_file_paths_debug.txt', 
      `Directory ID: ${dirId}\n` +
      `Uploaded video file paths:\n` +
      uploadedFilePaths.map((p, i) => `  ${i + 1}. ${p}`).join('\n') + '\n',
      'utf-8'
    );
    
    // 5. Build filter_complex for concat + loudnorm
    // Build concat filter: [0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a0]
    // Then apply loudnorm: [a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]
    const inputStreams = uploadedFilePaths.map((_, i) => `[${i}:v][${i}:a]`).join('');
    const filterComplex = useLoudnorm
      ? `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a0];[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]`
      : `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a]`;
    
    console.log(`\n========================================`);
    console.log(`[mergeVideosWithFilterComplex] 📝 STEP 5: Building filter_complex`);
    console.log(`========================================`);
    console.log(`[mergeVideosWithFilterComplex] Loudnorm: ${useLoudnorm ? 'ENABLED' : 'DISABLED'}`);
    console.log(`[mergeVideosWithFilterComplex] Filter: ${filterComplex}`);
    console.log(`========================================\n`);
    
    // 6. Prepare task with filter_complex (STEP 9 METHOD)
    const outputFileName = `${outputVideoName}_${Date.now()}.mp4`;
    
    const task: any = {
      inputs: uploadedFilePaths.map(path => ({ file_path: path })),
      filter_complex: filterComplex,
      outputs: [
        {
          file: outputFileName,
          maps: ['[v]', '[a]'],
          options: [
            '-c:v', 'libx264',
            '-crf', '18',  // High quality (18 = visually lossless)
            '-preset', 'medium',
            '-c:a', 'aac',
            '-ar', '48000',
            '-ac', '2'
            // NO -af here! Audio comes from [outa] via maps
          ]
        }
      ]
    };
    
    console.log(`\n========================================`);
    console.log(`[mergeVideosWithFilterComplex] 🎬 STEP 6: Preparing FFmpeg task`);
    console.log(`========================================`);
    console.log(`[mergeVideosWithFilterComplex] Method: filter_complex concat`);
    console.log(`[mergeVideosWithFilterComplex] Inputs: ${uploadedFilePaths.length} videos`);
    console.log(`[mergeVideosWithFilterComplex] Output: ${outputFileName}`);
    console.log(`[mergeVideosWithFilterComplex] Audio normalization: dynaudnorm`);
    console.log(`========================================\n`);
    
    // 7. Send to FFmpeg API
    console.log(`[mergeVideosWithFilterComplex] Sending merge task to FFmpeg API...`);
    console.log(`[mergeVideosWithFilterComplex] 📋 Task details:`, JSON.stringify(task, null, 2));
    console.log(`[mergeVideosWithFilterComplex] 📊 Inputs count: ${task.inputs.length}`);
    console.log(`[mergeVideosWithFilterComplex] 🎯 Output file: ${outputFileName}`);
    
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task }),
    });
    
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error('[FFmpeg API] ❌ HTTP Status:', processRes.status, processRes.statusText);
      console.error('[FFmpeg API] ❌ Error response:', errorText.substring(0, 500));
      console.error('[FFmpeg API] ❌ Task sent:', JSON.stringify(task, null, 2));
      console.error('[FFmpeg API] ❌ Request URL:', `${FFMPEG_API_BASE}/ffmpeg/process`);
      console.error('[FFmpeg API] ❌ Videos count:', videoUrls.length);
      throw new Error(`FFmpeg API merge failed: ${processRes.statusText} - ${errorText.substring(0, 200)}`);
    }
    
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[FFmpeg API] Invalid JSON response:', responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON`);
    }
    
    // FFmpeg API returns: { ok: true, result: [{ download_url, file_name }] }
    if (!result.ok || !result.result || result.result.length === 0) {
      console.error('[FFmpeg API] Merge failed:', result);
      throw new Error(`FFmpeg API merge failed: ${result.message || 'Unknown error'}`);
    }
    
    const mergedFile = result.result[0];
    const downloadUrl = mergedFile.download_url;
    console.log(`[mergeVideosWithFilterComplex] Merge successful: ${mergedFile.file_name}`);
    console.log(`[mergeVideosWithFilterComplex] Download URL: ${downloadUrl}`);
    
    // 8. Download merged video (pre-signed URL, no auth needed)
    console.log(`[mergeVideosWithFilterComplex] Downloading merged video from: ${downloadUrl}`);
    const downloadRes = await fetch(downloadUrl);
    
    if (!downloadRes.ok) {
      throw new Error(`Failed to download merged video: ${downloadRes.statusText}`);
    }
    
    const videoBuffer = Buffer.from(await downloadRes.arrayBuffer());
    console.log(`[mergeVideosWithFilterComplex] Downloaded ${videoBuffer.length} bytes`);
    
    // 9. Upload to Bunny CDN (use same credentials as uploadToBunnyCDN function)
    const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
    const BUNNYCDN_STORAGE_ZONE = 'manus-storage';
    const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net';
    
    const bunnyFileName = `${outputVideoName}.mp4`;
    const targetFolder = folder || 'prepare-for-merge';
    const mergedPath = userId ? `user-${userId}/videos/${targetFolder}/${bunnyFileName}` : `videos/${targetFolder}/${bunnyFileName}`;
    const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${mergedPath}`;
    
    console.log(`[mergeVideosWithFilterComplex] Uploading to Bunny CDN: merged-videos/${bunnyFileName}`);
    
    const uploadResponse = await fetch(storageUrl, {
      method: 'PUT',
      body: videoBuffer,
      headers: {
        'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
        'Content-Type': 'video/mp4',
      },
    });
    
    if (uploadResponse.status !== 201) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload to Bunny CDN: ${uploadResponse.status} - ${errorText}`);
    }
    
    const cdnUrl = `${BUNNYCDN_PULL_ZONE_URL}/${mergedPath}`;
    console.log(`[mergeVideosWithFilterComplex] ✅ Merge complete: ${cdnUrl}`);
    
    return cdnUrl;
  } catch (error) {
    console.error(`[mergeVideosWithFilterComplex] Error:`, error);
    throw error;
  }
}

/**
 * Merge videos using concat protocol (lossless, no re-encode)
 * Used for Step 9 (Prepare for Merge)
 * 
 * Requirements:
 * - All videos MUST have identical codecs, resolution, framerate, sample rate
 * - Uses concat protocol: concat:file1.mp4|file2.mp4|file3.mp4
 * - Copy codec (-c copy) for lossless merge
 * - No filter_complex, no loudnorm, no re-encoding
 * 
 * @param videoUrls - Array of video URLs to merge
 * @param outputVideoName - Name for the output video
 * @param ffmpegApiKey - FFmpeg API key
 * @param userId - User ID for CDN upload
 * @param folder - Folder name for CDN upload (default: 'prepare-for-merge')
 * @returns CDN URL of the merged video
 */
export async function mergeVideosSimple(
  videoUrls: string[],
  outputVideoName: string,
  ffmpegApiKey: string,
  userId?: number,
  folder: string = 'prepare-for-merge'
): Promise<string> {
  try {
    console.log(`\n========================================`);
    console.log(`[mergeVideosSimple] 🚀 Starting SIMPLE merge (lossless, no re-encode)`);
    console.log(`========================================`);
    console.log(`[mergeVideosSimple] Videos to merge: ${videoUrls.length}`);
    console.log(`[mergeVideosSimple] Output name: ${outputVideoName}`);
    console.log(`[mergeVideosSimple] Method: concat protocol with -c copy`);
    console.log(`========================================\n`);
    
    if (videoUrls.length === 0) {
      throw new Error('No videos provided');
    }
    
    if (videoUrls.length === 1) {
      console.log(`[mergeVideosSimple] Only 1 video, returning original URL`);
      return videoUrls[0];
    }
    
    // 1. Create directory
    console.log(`[mergeVideosSimple] 📁 Step 1: Creating directory...`);
    const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!dirRes.ok) {
      throw new Error(`Failed to create directory: ${dirRes.statusText}`);
    }
    
    const dirData = await dirRes.json();
    const dirId = dirData.directory.id;
    console.log(`[mergeVideosSimple] ✅ Created directory: ${dirId}`);
    
    // 2. Register ALL video files
    console.log(`[mergeVideosSimple] 📝 Step 2: Registering ${videoUrls.length} video files...`);
    const batchTimestamp = Date.now();
    
    const fileRegistrations = await Promise.all(
      videoUrls.map(async (videoUrl, i) => {
        const fileName = `merge_input_${i}_${batchTimestamp}.mp4`;
        
        const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
          method: 'POST',
          headers: {
            'Authorization': ffmpegApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file_name: fileName,
            dir_id: dirId
          })
        });
        
        if (!fileRes.ok) {
          throw new Error(`Failed to register file ${i}: ${fileRes.statusText}`);
        }
        
        const fileData = await fileRes.json();
        console.log(`[mergeVideosSimple] ✅ Registered ${i + 1}/${videoUrls.length}: ${fileData.file.file_path}`);
        
        return {
          file: fileData.file,
          upload: fileData.upload,
          videoUrl
        };
      })
    );
    
    console.log(`[mergeVideosSimple] ✅ All video files registered!`);
    
    // 3. Upload videos to FFmpeg API
    console.log(`[mergeVideosSimple] 📤 Step 3: Uploading ${videoUrls.length} videos...`);
    
    await Promise.all(
      fileRegistrations.map(async ({ upload, videoUrl, file }, i) => {
        console.log(`[mergeVideosSimple] ⬇️ Downloading ${i + 1}/${videoUrls.length} from CDN...`);
        
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) {
          throw new Error(`Failed to download video ${i}: ${videoRes.statusText}`);
        }
        
        const videoBuffer = await videoRes.arrayBuffer();
        const videoSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(2);
        console.log(`[mergeVideosSimple] ✅ Downloaded ${i + 1}/${videoUrls.length}: ${videoSizeMB} MB`);
        
        console.log(`[mergeVideosSimple] ⬆️ Uploading ${i + 1}/${videoUrls.length} to FFmpeg API...`);
        
        const uploadHeaders = upload.headers || {};
        
        const uploadRes = await fetch(upload.url, {
          method: 'PUT',
          body: videoBuffer,
          headers: uploadHeaders
        });
        
        if (!uploadRes.ok) {
          throw new Error(`Failed to upload video ${i}: ${uploadRes.statusText}`);
        }
        
        console.log(`[mergeVideosSimple] ✅ Uploaded ${i + 1}/${videoUrls.length}: ${file.file_path}`);
      })
    );
    
    console.log(`[mergeVideosSimple] ✅ All videos uploaded!`);
    
    // 4. Build concat protocol string
    const uploadedFilePaths = fileRegistrations.map(({ file }) => file.file_path);
    
    console.log(`\n========================================`);
    console.log(`[mergeVideosSimple] 📝 STEP 4: Building concat protocol string`);
    console.log(`========================================`);
    
    // Build concat protocol: concat:file1.mp4|file2.mp4|file3.mp4
    const concatString = `concat:${uploadedFilePaths.join('|')}`;
    console.log(`[mergeVideosSimple] Concat string: ${concatString}`);
    console.log(`========================================\n`);
    
    // 5. Prepare FFmpeg task with concat protocol
    const outputFileName = `${outputVideoName}_${Date.now()}.mp4`;
    
    const task: any = {
      inputs: [
        {
          file_path: concatString,
          options: []  // No special options needed for concat protocol
        }
      ],
      outputs: [
        {
          file: outputFileName,
          options: ['-c', 'copy']  // Copy both video and audio (lossless)
        }
      ]
    };
    
    console.log(`\n========================================`);
    console.log(`[mergeVideosSimple] 🎬 STEP 5: Preparing FFmpeg task`);
    console.log(`========================================`);
    console.log(`[mergeVideosSimple] Method: concat protocol`);
    console.log(`[mergeVideosSimple] Input: ${concatString}`);
    console.log(`[mergeVideosSimple] Output: ${outputFileName}`);
    console.log(`[mergeVideosSimple] Codec: copy (lossless)`);
    console.log(`========================================\n`);
    
    // 6. Send to FFmpeg API
    console.log(`[mergeVideosSimple] Sending task to FFmpeg API...`);
    console.log(`[mergeVideosSimple] 📋 Task:`, JSON.stringify(task, null, 2));
    
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task }),
    });
    
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error('[mergeVideosSimple] ❌ FFmpeg API error:', errorText.substring(0, 500));
      throw new Error(`FFmpeg API failed: ${processRes.statusText} - ${errorText.substring(0, 200)}`);
    }
    
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[mergeVideosSimple] Invalid JSON:', responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON`);
    }
    
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned no result`);
    }
    
    const downloadUrl = result.result[0].download_url;
    console.log(`[mergeVideosSimple] ✅ FFmpeg processing complete!`);
    console.log(`[mergeVideosSimple] Download URL: ${downloadUrl}`);
    
    // 7. Upload to BunnyCDN
    console.log(`[mergeVideosSimple] 📤 Step 6: Uploading to BunnyCDN...`);
    
    const videoRes = await fetch(downloadUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download from FFmpeg API: ${videoRes.statusText}`);
    }
    
    const videoBuffer = await videoRes.arrayBuffer();
    const videoSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(2);
    console.log(`[mergeVideosSimple] Downloaded merged video: ${videoSizeMB} MB`);
    
    const cdnUrl = await uploadToBunnyCDN(
      Buffer.from(videoBuffer),
      outputFileName,
      userId,
      folder
    );
    
    console.log(`[mergeVideosSimple] ✅ Uploaded to BunnyCDN: ${cdnUrl}`);
    
    console.log(`\n========================================`);
    console.log(`[mergeVideosSimple] 🎉 MERGE COMPLETE!`);
    console.log(`========================================`);
    console.log(`[mergeVideosSimple] Final CDN URL: ${cdnUrl}`);
    console.log(`[mergeVideosSimple] Method: concat protocol (lossless)`);
    console.log(`[mergeVideosSimple] Videos merged: ${videoUrls.length}`);
    console.log(`========================================\n`);
    
    return cdnUrl;
  } catch (error) {
    console.error(`[mergeVideosSimple] ❌ Error:`, error);
    throw error;
  }
}
