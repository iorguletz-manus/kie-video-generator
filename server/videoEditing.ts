import { promises as fs } from 'fs';
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
  start: number;  // seconds
  end: number;    // seconds
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
  error?: string;
}

export interface ProcessingResult {
  words: WhisperWord[];
  cutPoints: CutPoints | null;
  whisperTranscript: any;
  audioUrl: string;  // Audio download URL
  waveformJson: string;  // Waveform JSON data
  editingDebugInfo: EditingDebugInfo;  // Debug info for Step 8
}

// ============================================================================
// 1. FFMPEG API - UPLOAD VIDEO
// ============================================================================

/**
 * Upload video to FFmpeg API and return file_path
 */
async function uploadVideoToFFmpegAPI(
  videoUrl: string,
  fileName: string,
  ffmpegApiKey: string
): Promise<string> {
  try {
    console.log(`[uploadVideoToFFmpegAPI] Uploading ${fileName}...`);
    
    // Step 1: Get upload URL
    const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_name: fileName }),
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

// ============================================================================
// 3. WAVEFORM GENERATION
// ============================================================================

/**
 * Generate waveform JSON using audiowaveform CLI
 * Returns the waveform JSON as a string (to be stored in database or uploaded to CDN)
 */
async function generateWaveformData(
  audioDownloadUrl: string,
  videoId: number
): Promise<string> {
  try {
    console.log(`[generateWaveformData] Generating waveform for video ${videoId}...`);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join('/tmp', 'waveforms');
    await fs.mkdir(tempDir, { recursive: true });
    
    const audioPathMp3 = path.join(tempDir, `audio_${videoId}.mp3`);
    const audioPathWav = path.join(tempDir, `audio_${videoId}.wav`);
    const waveformPath = path.join(tempDir, `waveform_${videoId}.json`);
    
    // Download audio file
    console.log(`[generateWaveformData] Downloading audio from ${audioDownloadUrl}...`);
    const audioRes = await fetch(audioDownloadUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio: ${audioRes.statusText}`);
    }
    const audioBuffer = await audioRes.arrayBuffer();
    await fs.writeFile(audioPathMp3, Buffer.from(audioBuffer));
    
    // 🔧 FIX: Convert MP3 → WAV PCM 16-bit (audiowaveform doesn't support MP3 VBR)
    console.log(`[generateWaveformData] Converting MP3 → WAV PCM 16-bit...`);
    const convertCommand = `ffmpeg -y -i "${audioPathMp3}" -ac 1 -ar 48000 -c:a pcm_s16le "${audioPathWav}"`;
    await exec(convertCommand);
    console.log(`[generateWaveformData] Conversion complete`);
    
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
): { cutPoints: CutPoints | null; debugInfo: EditingDebugInfo } {
  try {
    // Split red text into words
    const redWords = redText.split(/\s+/).filter(w => w.length > 0);
    
    // Find red text sequence in timestamps
    const redRange = findSequenceInWords(words, redWords);
    
    if (!redRange) {
      console.error('[calculateCutPoints] Red text not found in timestamps');
      const debugInfo: EditingDebugInfo = {
        status: 'warning',
        message: `⚠️ No red text found in transcript`,
        redTextDetected: {
          found: false,
          fullText: redText,
        },
      };
      return { cutPoints: null, debugInfo };
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
        const debugInfo: EditingDebugInfo = {
          status: 'error',
          message: `❌ No white text before red text - cannot calculate cut points`,
          redTextDetected: {
            found: true,
            position: 'END',
            fullText: redText,
          },
        };
        return { cutPoints: null, debugInfo };
      }

      const lastWhiteWord = words[lastWhiteIdx];
      endKeep = (lastWhiteWord.end + marginS) * 1000;

      redPosition = 'END';
    }

    const confidence = 0.95;

    // Get matched words from transcript
    const matchedWords = words.slice(startIdx, endIdx + 1).map(w => w.word);
    
    // Get time range of red text
    const redStartTime = words[startIdx].start;
    const redEndTime = words[endIdx].end;

    console.log(`[calculateCutPoints] Red text at ${redPosition}`);
    console.log(`[calculateCutPoints] Keep range: ${startKeep}ms → ${endKeep}ms`);
    console.log(`[calculateCutPoints] Red text range: ${redStartTime}s → ${redEndTime}s`);

    const cutPoints: CutPoints = {
      startKeep: Math.round(startKeep),
      endKeep: Math.round(endKeep),
      redPosition,
      confidence,
    };

    const debugInfo: EditingDebugInfo = {
      status: 'success',
      message: `✅ Red text detected at ${redPosition}: "${matchedWords.join(' ')}" (${redStartTime.toFixed(2)}s - ${redEndTime.toFixed(2)}s)`,
      redTextDetected: {
        found: true,
        position: redPosition,
        fullText: matchedWords.join(' '),
        timeRange: { start: redStartTime, end: redEndTime },
        matchedWords,
      },
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
  fullText: string,
  redText: string,
  marginMs: number = 50,
  userApiKey?: string,
  ffmpegApiKey?: string
): Promise<ProcessingResult> {
  try {
    console.log(`[processVideoForEditing] Starting for video ${videoId}...`);
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured. Please set it in Settings.');
    }
    
    // 1. Upload video to FFmpeg API
    const videoFileName = `video_${videoId}.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    
    // 2. Extract audio
    const audioFileName = `audio_${videoId}.mp3`;
    const audioDownloadUrl = await extractAudioWithFFmpegAPI(videoFilePath, audioFileName, ffmpegApiKey!);
    
    // 2.5. Download audio and upload to Bunny.net for permanent storage
    console.log(`[processVideoForEditing] Downloading audio from FFMPEG...`);
    const audioResponse = await fetch(audioDownloadUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    
    console.log(`[processVideoForEditing] Uploading audio to Bunny.net...`);
    const bunnyAudioUrl = await uploadToBunnyCDN(
      audioBuffer,
      `audio-files/${audioFileName}`,
      'audio/mpeg'
    );
    console.log(`[processVideoForEditing] Audio uploaded to Bunny.net: ${bunnyAudioUrl}`);
    
    // 3. Generate waveform JSON (use Bunny URL)
    const waveformJson = await generateWaveformData(bunnyAudioUrl, videoId);
    
    // 4. Transcribe with Whisper
    const { words, fullTranscript } = await transcribeWithWhisper(audioDownloadUrl, 'ro', userApiKey);
    
    // 5. Calculate cut points
    const { cutPoints, debugInfo } = calculateCutPoints(fullText, redText, words, marginMs);
    
    console.log(`[processVideoForEditing] Processing complete for video ${videoId}`);
    console.log(`[processVideoForEditing] Debug info:`, debugInfo.message);
    
    return {
      words,
      cutPoints,
      whisperTranscript: fullTranscript,
      audioUrl: bunnyAudioUrl, // Use permanent Bunny.net URL
      waveformJson,
      editingDebugInfo: debugInfo,
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
// 7. VIDEO CUTTING FUNCTION (STEP 10)
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
  ffmpegApiKey: string
): Promise<string> {
  try {
    console.log(`[cutVideoWithFFmpegAPI] Cutting video ${videoName}: ${startTimeSeconds}s → ${endTimeSeconds}s`);
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured. Please set it in Settings.');
    }
    
    const duration = endTimeSeconds - startTimeSeconds;
    
    // 1. Upload video to FFmpeg API
    const videoFileName = `${videoName}_original.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    
    // 2. Trim video
    const outputFileName = `${videoName}_trimmed_${Date.now()}.mp4`;
    
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: 'POST',
      headers: {
        'Authorization': ffmpegApiKey,
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
    const bunnyFileName = `trimmed-videos/${outputFileName}`;
    const bunnyVideoUrl = await uploadToBunnyCDN(
      videoBuffer,
      bunnyFileName,
      'video/mp4'
    );
    console.log(`[cutVideoWithFFmpegAPI] Video uploaded to Bunny CDN: ${bunnyVideoUrl}`);
    
    return bunnyVideoUrl;
  } catch (error) {
    console.error('[cutVideoWithFFmpegAPI] Error:', error);
    throw new Error(`Failed to cut video: ${error.message}`);
  }
}
