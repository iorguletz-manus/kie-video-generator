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
  videoName: string,  // Video name for unique file naming
  fullText: string,
  redText: string,
  redTextPosition: 'START' | 'END' | undefined,  // Position from database (redStart/redEnd), undefined for white-text-only
  marginMs: number = 50,
  userApiKey?: string,
  ffmpegApiKey?: string,
  cleanvoiceApiKey?: string,
  userId?: number
): Promise<ProcessingResult> {
  try {
    const startTime = Date.now();
    console.log(`[processVideoForEditing] ⏱️ START ${videoName} at ${new Date().toISOString()}`);
    console.log(`[processVideoForEditing] Starting for video ${videoId}...`);
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured. Please set it in Settings.');
    }
    
    // 1. Upload video to FFmpeg API
    const uploadStartTime = Date.now();
    console.log(`[processVideoForEditing] 📤 FFMPEG UPLOAD START for ${videoName}`);
    const sanitizedVideoName = videoName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const videoFileName = `video_${sanitizedVideoName}.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`[processVideoForEditing] ✅ FFMPEG UPLOAD DONE for ${videoName} in ${uploadDuration}ms (${(uploadDuration/1000).toFixed(2)}s)`);
    
    // 2. Extract audio
    const extractStartTime = Date.now();
    console.log(`[processVideoForEditing] 🎵 AUDIO EXTRACT START for ${videoName}`);
    const timestamp = Date.now();
    const audioFileName = `${sanitizedVideoName}_${timestamp}.mp3`;
    const audioDownloadUrl = await extractAudioWithFFmpegAPI(videoFilePath, audioFileName, ffmpegApiKey!);
    const extractDuration = Date.now() - extractStartTime;
    console.log(`[processVideoForEditing] ✅ AUDIO EXTRACT DONE for ${videoName} in ${extractDuration}ms (${(extractDuration/1000).toFixed(2)}s)`);
    
    // 2.5. Download audio and upload to Bunny.net for permanent storage
    const downloadStartTime = Date.now();
    console.log(`[processVideoForEditing] ⬇️ AUDIO DOWNLOAD START for ${videoName}`);
    const audioResponse = await fetch(audioDownloadUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const downloadDuration = Date.now() - downloadStartTime;
    console.log(`[processVideoForEditing] ✅ AUDIO DOWNLOAD DONE for ${videoName} in ${downloadDuration}ms (${(downloadDuration/1000).toFixed(2)}s)`);
    
    const bunnyUploadStartTime = Date.now();
    console.log(`[processVideoForEditing] ☁️ BUNNY UPLOAD START for ${videoName}`);
    const audioPath = userId ? `user-${userId}/audio/${audioFileName}` : `audio/${audioFileName}`;
    const bunnyAudioUrl = await uploadToBunnyCDN(
      audioBuffer,
      audioPath,
      'audio/mpeg'
    );
    const bunnyUploadDuration = Date.now() - bunnyUploadStartTime;
    console.log(`[processVideoForEditing] ✅ BUNNY UPLOAD DONE for ${videoName} in ${bunnyUploadDuration}ms (${(bunnyUploadDuration/1000).toFixed(2)}s)`);
    console.log(`[processVideoForEditing] Audio uploaded to Bunny.net: ${bunnyAudioUrl}`);
    
    // 3. Run CleanVoice, Whisper, and Waveform generation in PARALLEL
    const parallelStartTime = Date.now();
    console.log(`[processVideoForEditing] 🚀 PARALLEL START (CleanVoice + Whisper + Waveform) for ${videoName}`);
    
    const [cleanvoiceResult, whisperResult, waveformJson] = await Promise.allSettled([
      // CleanVoice: Process video (only if API key provided)
      cleanvoiceApiKey && userId
        ? (async () => {
            const { processVideoWithCleanVoice } = await import('./cleanvoice.js');
            return await processVideoWithCleanVoice(videoUrl, videoName, userId, cleanvoiceApiKey);
          })()
        : Promise.resolve(null),
      
      // Whisper: Transcribe audio
      transcribeWithWhisper(audioDownloadUrl, 'ro', userApiKey),
      
      // Waveform: Generate waveform data
      generateWaveformData(bunnyAudioUrl, videoId, videoName),
    ]);
    const parallelDuration = Date.now() - parallelStartTime;
    console.log(`[processVideoForEditing] ✅ PARALLEL DONE for ${videoName} in ${parallelDuration}ms (${(parallelDuration/1000).toFixed(2)}s)`);
    
    // Extract results from Promise.allSettled
    const cleanvoiceAudioUrl = cleanvoiceResult.status === 'fulfilled' ? cleanvoiceResult.value : null;
    if (cleanvoiceResult.status === 'rejected') {
      console.error(`[processVideoForEditing] ❌ CleanVoice FAILED for ${videoName}:`, cleanvoiceResult.reason);
      console.error(`[processVideoForEditing] CleanVoice error details:`, JSON.stringify(cleanvoiceResult.reason?.response?.data || cleanvoiceResult.reason, null, 2));
      
      // Write error to file for debugging
      const fs = await import('fs');
      const errorLog = {
        timestamp: new Date().toISOString(),
        videoName,
        videoUrl,
        error: cleanvoiceResult.reason?.message || String(cleanvoiceResult.reason),
        stack: cleanvoiceResult.reason?.stack,
        response: cleanvoiceResult.reason?.response?.data
      };
      await fs.promises.appendFile(
        '/tmp/cleanvoice_errors.log',
        JSON.stringify(errorLog, null, 2) + '\n---\n',
        'utf-8'
      );
    } else if (cleanvoiceAudioUrl) {
      console.log(`[processVideoForEditing] ✅ CleanVoice SUCCESS for ${videoName}: ${cleanvoiceAudioUrl}`);
    } else {
      console.warn(`[processVideoForEditing] ⚠️ CleanVoice returned NULL for ${videoName} (API key missing or not configured)`);
    }
    
    if (whisperResult.status === 'rejected') {
      throw new Error(`Whisper transcription failed: ${whisperResult.reason}`);
    }
    const { words, fullTranscript } = whisperResult.value;
    
    if (waveformJson.status === 'rejected') {
      throw new Error(`Waveform generation failed: ${waveformJson.reason}`);
    }
    const waveformData = waveformJson.value;
    
    // 5. Calculate cut points using NEW ALGORITHM
    const cutPointsStartTime = Date.now();
    const { cutPoints, debugInfo } = calculateCutPointsNew(fullText, redText, words, redTextPosition, marginMs);
    const cutPointsDuration = Date.now() - cutPointsStartTime;
    console.log(`[processVideoForEditing] ✂️ CUT POINTS calculated in ${cutPointsDuration}ms`);
    
    const totalDuration = Date.now() - startTime;
    console.log(`[processVideoForEditing] ✅ TOTAL COMPLETE for ${videoName} in ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    console.log(`[processVideoForEditing] 📈 BREAKDOWN: Upload=${uploadDuration}ms, Extract=${extractDuration}ms, Download=${downloadDuration}ms, Bunny=${bunnyUploadDuration}ms, Parallel=${parallelDuration}ms, CutPoints=${cutPointsDuration}ms`);
    console.log(`[processVideoForEditing] Processing complete for video ${videoId}`);
    console.log(`[processVideoForEditing] Debug info:`, debugInfo.message);
    
    return {
      words,
      cutPoints,
      whisperTranscript: fullTranscript,
      audioUrl: bunnyAudioUrl, // Use permanent Bunny.net URL
      waveformJson: waveformData,
      editingDebugInfo: debugInfo,
      cleanvoiceAudioUrl, // Add CleanVoice processed audio URL
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
  ffmpegApiKey: string,
  cleanVoiceAudioUrl?: string,  // Optional CleanVoice audio URL
  userId?: number  // Optional userId for user-specific folder
): Promise<string> {
  try {
    console.log(`[cutVideoWithFFmpegAPI] Cutting video ${videoName}: ${startTimeSeconds}s → ${endTimeSeconds}s`);
    console.log(`[cutVideoWithFFmpegAPI] 👤 userId:`, userId, `(type: ${typeof userId})`);
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured. Please set it in Settings.');
    }
    
    const duration = endTimeSeconds - startTimeSeconds;
    
    // 1. Upload video to FFmpeg API
    const videoFileName = `${videoName}_original.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    
    // 2. Upload CleanVoice audio if provided
    let audioFilePath: string | undefined;
    if (cleanVoiceAudioUrl) {
      console.log(`[cutVideoWithFFmpegAPI] Uploading CleanVoice audio...`);
      const audioFileName = `${videoName}_cleanvoice.mp3`;
      audioFilePath = await uploadVideoToFFmpegAPI(cleanVoiceAudioUrl, audioFileName, ffmpegApiKey);
      console.log(`[cutVideoWithFFmpegAPI] CleanVoice audio uploaded: ${audioFilePath}`);
    }
    
    // 3. Prepare task: Trim video + Replace audio (if CleanVoice provided)
    const outputFileName = `${videoName}_trimmed_${Date.now()}.mp4`;
    
    const task: any = {
      inputs: [
        {
          file_path: videoFilePath,
          options: ['-ss', startTimeSeconds.toString(), '-t', duration.toString()]
        }
      ],
      outputs: [
        {
          file: outputFileName,
          options: [] as string[]
        }
      ]
    };
    
    // If CleanVoice audio provided, add it as second input and configure audio replacement
    if (audioFilePath) {
      task.inputs.push({
        file_path: audioFilePath
      });
      
      // Output options: Copy video (no re-encoding), replace audio with CleanVoice
      task.outputs[0].options = [
        '-c:v', 'copy',        // Copy video codec (FAST, no re-encoding)
        '-c:a', 'aac',         // AAC audio codec
        '-b:a', '192k',        // 192 kbps audio bitrate
        '-ar', '48000',        // 48 kHz sample rate
        '-map', '0:v:0',       // Map video from input 0 (original video)
        '-map', '1:a:0',       // Map audio from input 1 (CleanVoice audio)
        '-shortest'            // Trim to shortest stream
      ];
      console.log(`[cutVideoWithFFmpegAPI] Task configured: Trim + Replace audio with CleanVoice`);
    } else {
      // No CleanVoice audio, just trim with original audio
      task.outputs[0].options = [
        '-c:v', 'libx264',     // Re-encode video
        '-crf', '23',          // Good quality
        '-c:a', 'aac'          // AAC audio codec
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
// 8. VIDEO MERGING FUNCTION (STEP 10)
// ============================================================================

/**
 * Merge multiple videos using FFmpeg API concat filter
 * Returns download URL for the merged video
 */
export async function mergeVideosWithFFmpegAPI(
  videoUrls: string[],
  outputVideoName: string,
  ffmpegApiKey: string,
  userId?: number  // Optional userId for user-specific folder
): Promise<string> {
  try {
    console.log('\n\n========================================');
    console.log('[mergeVideosWithFFmpegAPI] 🚀 MERGE STARTED');
    console.log(`[mergeVideosWithFFmpegAPI] Output name: ${outputVideoName}`);
    console.log(`[mergeVideosWithFFmpegAPI] Video count: ${videoUrls.length}`);
    console.log(`[mergeVideosWithFFmpegAPI] Video URLs:`, videoUrls);
    console.log('========================================\n');
    
    if (!ffmpegApiKey) {
      throw new Error('FFMPEG API Key not configured. Please set it in Settings.');
    }
    
    if (videoUrls.length === 0) {
      throw new Error('No videos provided for merging');
    }
    
    if (videoUrls.length === 1) {
      console.log(`[mergeVideosWithFFmpegAPI] Only 1 video, returning original URL`);
      return videoUrls[0];
    }
    
    // 1. Upload all videos to FFmpeg API in the SAME directory
    console.log(`[mergeVideosWithFFmpegAPI] Uploading ${videoUrls.length} videos...`);
    const uploadedFilePaths: string[] = [];
    let sharedDirId: string | undefined = undefined;
    
    // Use same timestamp for all uploads
    const batchTimestamp = Date.now();
    
    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i];
      const fileName = `merge_input_${i}_${batchTimestamp}.mp4`;
      
      // First upload creates directory, subsequent uploads use same dirId
      const filePath = await uploadVideoToFFmpegAPI(videoUrl, fileName, ffmpegApiKey, sharedDirId);
      uploadedFilePaths.push(filePath);
      
      // Extract dirId from first upload for subsequent uploads
      if (i === 0 && filePath.includes('/')) {
        // file_path format: "dir_abc123/merge_input_0_1234567890.mp4"
        sharedDirId = filePath.split('/')[0];
        console.log(`[mergeVideosWithFFmpegAPI] Using shared directory: ${sharedDirId}`);
      }
      
      console.log(`[mergeVideosWithFFmpegAPI] Uploaded ${i + 1}/${videoUrls.length}: ${filePath}`);
    }
    
    // 2. Prepare concat filter
    // FFmpeg concat filter: -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[outv][outa]"
    const videoInputs = uploadedFilePaths.map((_, i) => `[${i}:v][${i}:a]`).join('');
    const concatFilter = `${videoInputs}concat=n=${uploadedFilePaths.length}:v=1:a=1[outv][outa]`;
    
    console.log(`[mergeVideosWithFFmpegAPI] Concat filter: ${concatFilter}`);
    
    // 3. Prepare task
    const outputFileName = `${outputVideoName}_${Date.now()}.mp4`;
    
    const task: any = {
      inputs: uploadedFilePaths.map(filePath => ({
        file_path: filePath
      })),
      outputs: [
        {
          file: outputFileName,
          options: [
            '-filter_complex', concatFilter,
            '-map', '[outv]',
            '-map', '[outa]',
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'medium',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ar', '48000'
          ]
        }
      ]
    };
    
    // 4. Send to FFmpeg API
    console.log(`[mergeVideosWithFFmpegAPI] Sending merge task to FFmpeg API...`);
    console.log(`[mergeVideosWithFFmpegAPI] 📋 Task details:`, JSON.stringify(task, null, 2));
    console.log(`[mergeVideosWithFFmpegAPI] 📊 Inputs count: ${task.inputs.length}`);
    console.log(`[mergeVideosWithFFmpegAPI] 🎯 Output file: ${outputFileName}`);
    
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
    console.log(`[mergeVideosWithFFmpegAPI] Merge successful: ${mergedFile.file_name}`);
    console.log(`[mergeVideosWithFFmpegAPI] Download URL: ${downloadUrl}`);
    
    // 5. Download merged video (pre-signed URL, no auth needed)
    console.log(`[mergeVideosWithFFmpegAPI] Downloading merged video from: ${downloadUrl}`);
    const downloadRes = await fetch(downloadUrl);
    
    if (!downloadRes.ok) {
      throw new Error(`Failed to download merged video: ${downloadRes.statusText}`);
    }
    
    const videoBuffer = Buffer.from(await downloadRes.arrayBuffer());
    console.log(`[mergeVideosWithFFmpegAPI] Downloaded ${videoBuffer.length} bytes`);
    
    // 6. Upload to Bunny CDN (use same credentials as uploadToBunnyCDN function)
    const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
    const BUNNYCDN_STORAGE_ZONE = 'manus-storage';
    const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net';
    
    const bunnyFileName = `${outputVideoName}.mp4`;
    const mergedPath = userId ? `user-${userId}/videos/prepare-for-merge/${bunnyFileName}` : `videos/prepare-for-merge/${bunnyFileName}`;
    const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${mergedPath}`;
    
    console.log(`[mergeVideosWithFFmpegAPI] Uploading to Bunny CDN: merged-videos/${bunnyFileName}`);
    
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
    console.log(`[mergeVideosWithFFmpegAPI] ✅ Merge complete: ${cdnUrl}`);
    
    return cdnUrl;
  } catch (error) {
    console.error(`[mergeVideosWithFFmpegAPI] Error:`, error);
    throw error;
  }
}
