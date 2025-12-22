var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/storageHelpers.ts
var storageHelpers_exports = {};
__export(storageHelpers_exports, {
  generateAudioPath: () => generateAudioPath,
  generateCampaignFilePath: () => generateCampaignFilePath,
  generateImageLibraryPath: () => generateImageLibraryPath,
  generateMergedVideoPath: () => generateMergedVideoPath,
  generatePrepareForMergeVideoPath: () => generatePrepareForMergeVideoPath,
  generateProfileImagePath: () => generateProfileImagePath,
  generateScreenshotPath: () => generateScreenshotPath,
  generateTrimmedVideoPath: () => generateTrimmedVideoPath,
  sanitizePathSegment: () => sanitizePathSegment
});
function sanitizePathSegment(str) {
  return str.trim().replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").toLowerCase();
}
function generateImageLibraryPath(userId, characterName, imageName, timestamp2 = Date.now()) {
  const sanitizedCharacter = sanitizePathSegment(characterName);
  const sanitizedImageName = sanitizePathSegment(imageName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `user-${userId}/images/${sanitizedCharacter}/${sanitizedImageName}-${timestamp2}-${randomSuffix}.png`;
}
function generateCampaignFilePath(userId, tamName, coreBeliefName, emotionalAngleName, adName, characterName, fileType, fileName, extension, timestamp2 = Date.now()) {
  const sanitizedTam = sanitizePathSegment(tamName);
  const sanitizedCoreBelief = sanitizePathSegment(coreBeliefName);
  const sanitizedEmotionalAngle = sanitizePathSegment(emotionalAngleName);
  const sanitizedAd = sanitizePathSegment(adName);
  const sanitizedCharacter = sanitizePathSegment(characterName);
  const sanitizedFileName = sanitizePathSegment(fileName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `users/${userId}/campaigns/${sanitizedTam}/${sanitizedCoreBelief}/${sanitizedEmotionalAngle}/${sanitizedAd}/${sanitizedCharacter}/${fileType}/${sanitizedFileName}-${timestamp2}-${randomSuffix}.${extension}`;
}
function generateAudioPath(userId, fileName, timestamp2 = Date.now()) {
  const sanitizedFileName = sanitizePathSegment(fileName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `user-${userId}/audio/${sanitizedFileName}-${timestamp2}-${randomSuffix}.mp3`;
}
function generateTrimmedVideoPath(userId, videoName, timestamp2 = Date.now()) {
  const sanitizedVideoName = sanitizePathSegment(videoName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `user-${userId}/videos/trimmed/${sanitizedVideoName}-${timestamp2}-${randomSuffix}.mp4`;
}
function generateMergedVideoPath(userId, videoName, timestamp2 = Date.now()) {
  const sanitizedVideoName = sanitizePathSegment(videoName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `user-${userId}/videos/merged/${sanitizedVideoName}-${timestamp2}-${randomSuffix}.mp4`;
}
function generatePrepareForMergeVideoPath(userId, videoName, timestamp2 = Date.now()) {
  const sanitizedVideoName = sanitizePathSegment(videoName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `user-${userId}/videos/prepare-for-merge/${sanitizedVideoName}-${timestamp2}-${randomSuffix}.mp4`;
}
function generateScreenshotPath(userId, sessionId, fileName, timestamp2 = Date.now()) {
  const sanitizedFileName = sanitizePathSegment(fileName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `user-${userId}/images/screenshots/${sessionId}/${sanitizedFileName}-${timestamp2}-${randomSuffix}.png`;
}
function generateProfileImagePath(userId, timestamp2 = Date.now()) {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `users/${userId}/profile/avatar-${timestamp2}-${randomSuffix}.png`;
}
var init_storageHelpers = __esm({
  "server/storageHelpers.ts"() {
    "use strict";
  }
});

// server/cleanvoice.ts
var cleanvoice_exports = {};
__export(cleanvoice_exports, {
  downloadAndUploadCleanVoiceAudio: () => downloadAndUploadCleanVoiceAudio,
  getCleanVoiceStatus: () => getCleanVoiceStatus,
  pollCleanVoiceStatus: () => pollCleanVoiceStatus,
  processVideoWithCleanVoice: () => processVideoWithCleanVoice,
  submitToCleanVoice: () => submitToCleanVoice
});
import axios2 from "axios";
async function submitToCleanVoice(videoUrl, apiKey) {
  const config = {
    video: false,
    // Extract audio only (not video)
    export_format: "wav",
    // WAV format for Peaks.js waveform
    breath: "natural",
    // Natural breath sounds
    studio_sound: "true"
    // Apply studio processing (standard)
  };
  console.log(`[CleanVoice] Submitting video: ${videoUrl}`);
  console.log(`[CleanVoice] Config:`, JSON.stringify(config, null, 2));
  const response = await axios2.post(
    `${CLEANVOICE_API_BASE}/edits`,
    {
      input: {
        files: [videoUrl],
        config
        // Config must be inside input object
      }
    },
    {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json"
      }
    }
  );
  console.log(`[CleanVoice] Edit created with ID: ${response.data.id}`);
  return response.data.id;
}
async function getCleanVoiceStatus(editId, apiKey) {
  const response = await axios2.get(
    `${CLEANVOICE_API_BASE}/edits/${editId}`,
    {
      headers: {
        "X-Api-Key": apiKey
      }
    }
  );
  return response.data;
}
async function pollCleanVoiceStatus(editId, apiKey, maxAttempts = 60, intervalMs = 5e3) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getCleanVoiceStatus(editId, apiKey);
    console.log(`[CleanVoice] Edit ${editId} status: ${status.status} (attempt ${i + 1}/${maxAttempts})`);
    if (status.status === "SUCCESS" || status.status === "FAILURE") {
      console.log(`[CleanVoice] FULL RESPONSE:`, JSON.stringify(status, null, 2));
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`CleanVoice processing timed out after ${maxAttempts} attempts`);
}
async function downloadAndUploadCleanVoiceAudio(downloadUrl, videoName, userId) {
  console.log(`[CleanVoice] Downloading audio from: ${downloadUrl}`);
  const response = await axios2.get(downloadUrl, {
    responseType: "arraybuffer"
  });
  const audioBuffer = Buffer.from(response.data);
  const { generateAudioPath: generateAudioPath2 } = await Promise.resolve().then(() => (init_storageHelpers(), storageHelpers_exports));
  const fileName = generateAudioPath2(userId, videoName);
  console.log(`[CleanVoice] Uploading to Bunny CDN: ${fileName}`);
  const BUNNYCDN_STORAGE_PASSWORD2 = "4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b";
  const BUNNYCDN_STORAGE_ZONE2 = "manus-storage";
  const BUNNYCDN_PULL_ZONE_URL2 = "https://manus.b-cdn.net";
  const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${fileName}`;
  const uploadResponse = await axios2.put(storageUrl, audioBuffer, {
    headers: {
      "AccessKey": BUNNYCDN_STORAGE_PASSWORD2,
      "Content-Type": "audio/mpeg"
    }
  });
  if (uploadResponse.status !== 201) {
    throw new Error(`Failed to upload to Bunny CDN: ${uploadResponse.status}`);
  }
  const cdnUrl = `${BUNNYCDN_PULL_ZONE_URL2}/${fileName}`;
  console.log(`[CleanVoice] Audio uploaded successfully: ${cdnUrl}`);
  return cdnUrl;
}
async function processVideoWithCleanVoice(videoUrl, videoName, userId, apiKey) {
  const editId = await submitToCleanVoice(videoUrl, apiKey);
  const result = await pollCleanVoiceStatus(editId, apiKey);
  if (result.status === "FAILURE") {
    throw new Error(`CleanVoice processing failed: ${result.error || "Unknown error"}`);
  }
  if (!result.result?.download_url) {
    throw new Error("CleanVoice processing succeeded but no download URL provided");
  }
  const cleanvoiceAudioUrl = await downloadAndUploadCleanVoiceAudio(
    result.result.download_url,
    videoName,
    userId
  );
  return cleanvoiceAudioUrl;
}
var CLEANVOICE_API_BASE;
var init_cleanvoice = __esm({
  "server/cleanvoice.ts"() {
    "use strict";
    CLEANVOICE_API_BASE = "https://api.cleanvoice.ai/v2";
  }
});

// server/videoEditing.ts
var videoEditing_exports = {};
__export(videoEditing_exports, {
  calculateCutPoints: () => calculateCutPoints,
  calculateCutPointsNew: () => calculateCutPointsNew,
  cutVideoWithFFmpegAPI: () => cutVideoWithFFmpegAPI,
  extractWAVFromVideo: () => extractWAVFromVideo,
  mergeVideosSimple: () => mergeVideosSimple,
  mergeVideosWithFilterComplex: () => mergeVideosWithFilterComplex,
  mergeVideosWithFilterComplexLocal: () => mergeVideosWithFilterComplexLocal,
  processAudioWithWhisperCleanVoice: () => processAudioWithWhisperCleanVoice,
  processVideoForEditing: () => processVideoForEditing,
  uploadVideoToFFmpegAPI: () => uploadVideoToFFmpegAPI
});
import { writeFileSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { exec as execCallback } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
async function uploadToBunnyCDN(buffer, fileName, contentType) {
  const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${fileName}`;
  console.log(`[uploadToBunnyCDN] Uploading to:`, storageUrl);
  const uploadResponse = await fetch(storageUrl, {
    method: "PUT",
    headers: {
      "AccessKey": BUNNYCDN_STORAGE_PASSWORD,
      "Content-Type": contentType
    },
    body: buffer
  });
  if (!uploadResponse.ok) {
    throw new Error(`BunnyCDN upload failed: ${uploadResponse.statusText}`);
  }
  const publicUrl = `${BUNNYCDN_PULL_ZONE_URL}/${fileName}`;
  console.log(`[uploadToBunnyCDN] Upload successful:`, publicUrl);
  return publicUrl;
}
async function uploadVideoToFFmpegAPI(videoUrl, fileName, ffmpegApiKey, dirId) {
  try {
    console.log(`[uploadVideoToFFmpegAPI] Uploading ${fileName}...`);
    const requestBody = dirId ? { file_name: fileName, dir_id: dirId } : { file_name: fileName };
    const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
      method: "POST",
      headers: {
        "Authorization": ffmpegApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    if (!fileRes.ok) {
      const errorText = await fileRes.text();
      console.error("[uploadVideoToFFmpegAPI] FFmpeg API error response:", errorText.substring(0, 500));
      throw new Error(`FFmpeg API file creation failed: ${fileRes.statusText}`);
    }
    const responseText = await fileRes.text();
    let fileData;
    try {
      fileData = JSON.parse(responseText);
    } catch (e) {
      console.error("[uploadVideoToFFmpegAPI] Invalid JSON response:", responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON (possibly HTML error page)`);
    }
    const { file, upload } = fileData;
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
    console.log(`[uploadVideoToFFmpegAPI] Uploading to FFmpeg API...`);
    const uploadRes = await fetch(upload.url, {
      method: "PUT",
      body: videoBuffer
    });
    if (!uploadRes.ok) {
      throw new Error(`FFmpeg API upload failed: ${uploadRes.statusText}`);
    }
    console.log(`[uploadVideoToFFmpegAPI] Success! file_path: ${file.file_path}`);
    return file.file_path;
  } catch (error) {
    console.error("[uploadVideoToFFmpegAPI] Error:", error);
    throw new Error(`Failed to upload video to FFmpeg API: ${error.message}`);
  }
}
async function extractWAVWithFFmpegAPI(videoFilePath, outputFileName, ffmpegApiKey) {
  try {
    console.log(`[extractWAVWithFFmpegAPI] Extracting WAV audio from ${videoFilePath}...`);
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: "POST",
      headers: {
        "Authorization": ffmpegApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        task: {
          inputs: [{ file_path: videoFilePath }],
          outputs: [{
            file: outputFileName,
            options: [
              "-vn",
              // No video
              "-ac",
              "1",
              // Mono (1 audio channel)
              "-ar",
              "48000",
              // 48kHz sample rate
              "-sample_fmt",
              "s16"
              // 16-bit signed integer samples
            ]
          }]
        }
      })
    });
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error("[FFmpeg API] Error response:", errorText.substring(0, 500));
      console.error("[FFmpeg API] Status code:", processRes.status);
      console.error("[FFmpeg API] Status text:", processRes.statusText);
      if (processRes.status === 403) {
        throw new Error(`FFmpeg API Forbidden (403): API key may be invalid or rate limited. Please check your FFmpeg API credentials.`);
      }
      throw new Error(`FFmpeg API processing failed: ${processRes.statusText} (${processRes.status})`);
    }
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("[FFmpeg API] Invalid JSON response:", responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON`);
    }
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
    }
    const downloadUrl = result.result[0].download_url;
    console.log(`[extractWAVWithFFmpegAPI] WAV extracted! URL: ${downloadUrl}`);
    return downloadUrl;
  } catch (error) {
    console.error("[extractWAVWithFFmpegAPI] Error:", error);
    throw new Error(`Failed to extract WAV: ${error.message}`);
  }
}
async function generateWaveformData(audioDownloadUrl, videoId, videoName) {
  try {
    console.log(`[generateWaveformData] Generating waveform for video ${videoId}...`);
    const tempDir = path.join("/tmp", "waveforms");
    await fs.mkdir(tempDir, { recursive: true });
    const sanitizedName = videoName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const audioPathMp3 = path.join(tempDir, `${sanitizedName}.mp3`);
    const audioPathWav = path.join(tempDir, `${sanitizedName}.wav`);
    const waveformPath = path.join(tempDir, `${sanitizedName}.json`);
    console.log(`[generateWaveformData] Downloading audio from ${audioDownloadUrl}...`);
    const audioRes = await fetch(audioDownloadUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio: ${audioRes.statusText}`);
    }
    const audioBuffer = await audioRes.arrayBuffer();
    const isWAV = audioDownloadUrl.toLowerCase().endsWith(".wav");
    if (isWAV) {
      console.log(`[generateWaveformData] Input is WAV - using directly without conversion`);
      await fs.writeFile(audioPathWav, Buffer.from(audioBuffer));
    } else {
      await fs.writeFile(audioPathMp3, Buffer.from(audioBuffer));
      console.log(`[generateWaveformData] Converting MP3 \u2192 WAV PCM 16-bit...`);
      const convertCommand = `ffmpeg -y -i "${audioPathMp3}" -ac 1 -ar 48000 -c:a pcm_s16le "${audioPathWav}"`;
      await exec(convertCommand);
      console.log(`[generateWaveformData] Conversion complete`);
    }
    console.log(`[generateWaveformData] Running audiowaveform on WAV...`);
    const command = `audiowaveform -i "${audioPathWav}" -o "${waveformPath}" --pixels-per-second 1000 -b 8`;
    const { stdout, stderr } = await exec(command);
    if (stderr) {
      console.warn(`[generateWaveformData] audiowaveform stderr:`, stderr);
    }
    const waveformJson = await fs.readFile(waveformPath, "utf-8");
    const waveformData = JSON.parse(waveformJson);
    const { length, samples_per_pixel, sample_rate } = waveformData;
    const waveformDuration = length * samples_per_pixel / sample_rate;
    console.log(`[generateWaveformData] Waveform validation:`);
    console.log(`  - length: ${length}`);
    console.log(`  - samples_per_pixel: ${samples_per_pixel}`);
    console.log(`  - sample_rate: ${sample_rate}`);
    console.log(`  - calculated duration: ${waveformDuration.toFixed(3)}s`);
    const ffprobeCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPathWav}"`;
    const { stdout: durationStr } = await exec(ffprobeCommand);
    const audioDuration = parseFloat(durationStr.trim());
    console.log(`  - actual audio duration: ${audioDuration.toFixed(3)}s`);
    console.log(`  - coverage: ${(waveformDuration / audioDuration * 100).toFixed(2)}%`);
    if (waveformDuration < audioDuration - 0.1) {
      console.warn(`[generateWaveformData] \u26A0\uFE0F  WARNING: Waveform is truncated!`);
      console.warn(`  Missing ${(audioDuration - waveformDuration).toFixed(3)}s of audio data`);
    } else {
      console.log(`[generateWaveformData] \u2705 Waveform covers full audio duration`);
    }
    await fs.unlink(audioPathMp3).catch(() => {
    });
    await fs.unlink(audioPathWav).catch(() => {
    });
    await fs.unlink(waveformPath).catch(() => {
    });
    console.log(`[generateWaveformData] Waveform generated successfully (${waveformJson.length} bytes)`);
    return waveformJson;
  } catch (error) {
    console.error("[generateWaveformData] Error:", error);
    throw new Error(`Failed to generate waveform: ${error.message}`);
  }
}
async function transcribeWithWhisper(audioDownloadUrl, language = "ro", userApiKey) {
  try {
    console.log(`[transcribeWithWhisper] Downloading audio from ${audioDownloadUrl}...`);
    const audioRes = await fetch(audioDownloadUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio: ${audioRes.statusText}`);
    }
    const audioBuffer = await audioRes.arrayBuffer();
    console.log(`[transcribeWithWhisper] Sending to Whisper API...`);
    const audioFile = new File([Buffer.from(audioBuffer)], "audio.mp3", { type: "audio/mpeg" });
    const openai = getOpenAIClient(userApiKey);
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language,
      response_format: "verbose_json",
      timestamp_granularities: ["word"]
    });
    const words = (transcription.words || []).map((w) => ({
      word: w.word,
      start: Math.round(w.start * 1e3),
      // Convert seconds → milliseconds
      end: Math.round(w.end * 1e3)
      // Convert seconds → milliseconds
    }));
    console.log(`[transcribeWithWhisper] Transcribed ${words.length} words (timestamps in milliseconds)`);
    return {
      words,
      fullTranscript: transcription
    };
  } catch (error) {
    console.error("[transcribeWithWhisper] Error:", error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}
function normalizeWord(word) {
  return word.replace(/[,\.:\;!?]/g, "").toLowerCase().trim();
}
function calculateCutPoints(fullText, redText, words, redTextPosition, marginMs = 50) {
  try {
    const marginS = marginMs / 1e3;
    const redAtStart = redTextPosition === "START";
    const redAtEnd = redTextPosition === "END";
    console.log(`[calculateCutPoints] Red text position from database: ${redTextPosition}`);
    console.log(`[calculateCutPoints] fullText: "${fullText}"`);
    console.log(`[calculateCutPoints] redText: "${redText}"`);
    const redWords = redText.split(/\s+/).filter((w) => w.length > 0);
    let keyWord;
    let searchForFirst;
    if (redAtStart) {
      keyWord = redWords[redWords.length - 1];
      searchForFirst = true;
      console.log(`[calculateCutPoints] Red text at START, searching for LAST red word: "${keyWord}" (FIRST occurrence)`);
    } else {
      keyWord = redWords[0];
      searchForFirst = false;
      console.log(`[calculateCutPoints] \u{1F534} NEW CODE: Red text at END, searching for FIRST red word: "${keyWord}" (LAST occurrence)`);
      console.log(`[calculateCutPoints] \u{1F534} redWords array:`, redWords);
    }
    const normalizedKeyWord = normalizeWord(keyWord);
    let keyWordIndex = -1;
    if (searchForFirst) {
      for (let i = 0; i < words.length; i++) {
        if (normalizeWord(words[i].word) === normalizedKeyWord) {
          keyWordIndex = i;
          break;
        }
      }
    } else {
      for (let i = words.length - 1; i >= 0; i--) {
        if (normalizeWord(words[i].word) === normalizedKeyWord) {
          keyWordIndex = i;
          break;
        }
      }
    }
    if (keyWordIndex === -1) {
      console.error(`[calculateCutPoints] Key word "${keyWord}" not found in transcript`);
      const debugInfo2 = {
        status: "warning",
        message: `\u26A0\uFE0F Key word "${keyWord}" not found in transcript`,
        redTextDetected: {
          found: false,
          fullText: redText
        },
        whisperTranscript: words.map((w) => w.word).join(" "),
        whisperWordCount: words.length
      };
      return { cutPoints: null, debugInfo: debugInfo2 };
    }
    console.log(`[calculateCutPoints] Found key word "${keyWord}" at index ${keyWordIndex}, timestamp: ${words[keyWordIndex].start}s - ${words[keyWordIndex].end}s`);
    let startKeep;
    let endKeep;
    let redPosition;
    if (redAtStart) {
      const keyWordTimestamp2 = words[keyWordIndex];
      startKeep = keyWordTimestamp2.end + marginS;
      const lastWord = words[words.length - 1];
      endKeep = lastWord.end + marginS;
      redPosition = "START";
      console.log(`[calculateCutPoints] RED AT START: Keep ${startKeep}ms (after "${keyWord}") \u2192 ${endKeep}ms (end)`);
    } else {
      const firstWord = words[0];
      startKeep = Math.max(0, firstWord.start + marginS);
      const keyWordTimestamp2 = words[keyWordIndex];
      endKeep = keyWordTimestamp2.start - marginS;
      if (endKeep <= startKeep) {
        console.error("[calculateCutPoints] No white text before red text");
        const debugInfo2 = {
          status: "error",
          message: `\u274C No white text before red text - cannot calculate cut points`,
          redTextDetected: {
            found: true,
            position: "END",
            fullText: redText
          },
          whisperTranscript: words.map((w) => w.word).join(" "),
          whisperWordCount: words.length
        };
        return { cutPoints: null, debugInfo: debugInfo2 };
      }
      redPosition = "END";
      console.log(`[calculateCutPoints] RED AT END: Keep ${startKeep}ms (start) \u2192 ${endKeep}ms (before "${keyWord}")`);
    }
    const confidence = 0.95;
    const keyWordTimestamp = words[keyWordIndex];
    const cutPoints = {
      startKeep: Math.round(startKeep),
      endKeep: Math.round(endKeep),
      redPosition,
      confidence
    };
    const debugInfo = {
      status: "success",
      message: `\u2705 Red text detected at ${redPosition}: "${redText}" (key word: "${keyWord}" at ${keyWordTimestamp.start.toFixed(2)}s - ${keyWordTimestamp.end.toFixed(2)}s)`,
      redTextDetected: {
        found: true,
        position: redPosition,
        fullText: redText,
        timeRange: { start: keyWordTimestamp.start, end: keyWordTimestamp.end },
        matchedWords: [keyWord]
      },
      whisperTranscript: words.map((w) => w.word).join(" "),
      whisperWordCount: words.length
    };
    return { cutPoints, debugInfo };
  } catch (error) {
    console.error("[calculateCutPoints] Error:", error);
    const debugInfo = {
      status: "error",
      message: `\u274C Error calculating cut points: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error)
    };
    return { cutPoints: null, debugInfo };
  }
}
async function processVideoForEditing(videoUrl, videoId, videoName, fullText, redText, redTextPosition, marginMs = 50, userApiKey, ffmpegApiKey, cleanvoiceApiKey, userId) {
  try {
    const startTime = Date.now();
    console.log(`[processVideoForEditing] \u23F1\uFE0F START ${videoName} at ${(/* @__PURE__ */ new Date()).toISOString()}`);
    if (!ffmpegApiKey) {
      throw new Error("FFMPEG API Key not configured");
    }
    if (!cleanvoiceApiKey || !userId) {
      throw new Error("CleanVoice API Key not configured");
    }
    const uploadStartTime = Date.now();
    console.log(`[processVideoForEditing] \u{1F4E4} FFMPEG UPLOAD START for ${videoName}`);
    const sanitizedVideoName = videoName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const videoFileName = `video_${sanitizedVideoName}.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`[processVideoForEditing] \u2705 FFMPEG UPLOAD DONE in ${uploadDuration}ms`);
    const extractStartTime = Date.now();
    console.log(`[processVideoForEditing] \u{1F3B5} WAV EXTRACT START for ${videoName}`);
    const timestamp2 = Date.now();
    const wavFileName = `${sanitizedVideoName}_${timestamp2}.wav`;
    const wavDownloadUrl = await extractWAVWithFFmpegAPI(videoFilePath, wavFileName, ffmpegApiKey);
    const extractDuration = Date.now() - extractStartTime;
    console.log(`[processVideoForEditing] \u2705 WAV EXTRACT DONE in ${extractDuration}ms`);
    const downloadStartTime = Date.now();
    console.log(`[processVideoForEditing] \u2B07\uFE0F WAV DOWNLOAD START for ${videoName}`);
    const wavResponse = await fetch(wavDownloadUrl);
    if (!wavResponse.ok) {
      throw new Error(`Failed to download WAV: ${wavResponse.statusText}`);
    }
    const wavBuffer = Buffer.from(await wavResponse.arrayBuffer());
    const downloadDuration = Date.now() - downloadStartTime;
    console.log(`[processVideoForEditing] \u2705 WAV DOWNLOAD DONE in ${downloadDuration}ms`);
    const bunnyUploadStartTime = Date.now();
    console.log(`[processVideoForEditing] \u2601\uFE0F BUNNY UPLOAD START for ${videoName}`);
    const wavPath = `user-${userId}/audio/${wavFileName}`;
    const bunnyWavUrl = await uploadToBunnyCDN(wavBuffer, wavPath, "audio/wav");
    const bunnyUploadDuration = Date.now() - bunnyUploadStartTime;
    console.log(`[processVideoForEditing] \u2705 BUNNY UPLOAD DONE in ${bunnyUploadDuration}ms`);
    console.log(`[processVideoForEditing] WAV uploaded to Bunny: ${bunnyWavUrl}`);
    const waveformStartTime = Date.now();
    console.log(`[processVideoForEditing] \u{1F30A} WAVEFORM START for ${videoName}`);
    const waveformData = await generateWaveformData(bunnyWavUrl, videoId, videoName);
    const waveformDuration = Date.now() - waveformStartTime;
    console.log(`[processVideoForEditing] \u2705 WAVEFORM DONE in ${waveformDuration}ms`);
    console.log(`[processVideoForEditing] \u{1F680} PARALLEL START (Whisper + CleanVoice) for ${videoName}`);
    const parallelStartTime = Date.now();
    const { processVideoWithCleanVoice: processVideoWithCleanVoice2 } = await Promise.resolve().then(() => (init_cleanvoice(), cleanvoice_exports));
    const [whisperResult, cleanvoiceResult] = await Promise.allSettled([
      // Whisper: Transcribe WAV audio
      transcribeWithWhisper(bunnyWavUrl, "ro", userApiKey),
      // CleanVoice: Process WAV audio (returns cleaned WAV)
      processVideoWithCleanVoice2(bunnyWavUrl, videoName, userId, cleanvoiceApiKey)
    ]);
    const parallelDuration = Date.now() - parallelStartTime;
    console.log(`[processVideoForEditing] \u2705 PARALLEL DONE in ${parallelDuration}ms`);
    if (whisperResult.status === "rejected") {
      throw new Error(`Whisper failed: ${whisperResult.reason}`);
    }
    const { words, fullTranscript } = whisperResult.value;
    if (cleanvoiceResult.status === "rejected") {
      throw new Error(`CleanVoice failed: ${cleanvoiceResult.reason}`);
    }
    const cleanvoiceAudioUrl = cleanvoiceResult.value;
    const cutPointsStartTime = Date.now();
    const { cutPoints, debugInfo } = calculateCutPointsNew(fullText, redText, words, redTextPosition, marginMs);
    const cutPointsDuration = Date.now() - cutPointsStartTime;
    console.log(`[processVideoForEditing] \u2702\uFE0F CUT POINTS calculated in ${cutPointsDuration}ms`);
    const totalDuration = Date.now() - startTime;
    console.log(`[processVideoForEditing] \u2705 TOTAL COMPLETE for ${videoName} in ${totalDuration}ms (${(totalDuration / 1e3).toFixed(2)}s)`);
    console.log(`[processVideoForEditing] \u{1F4CA} BREAKDOWN: Upload=${uploadDuration}ms, Extract=${extractDuration}ms, Waveform=${waveformDuration}ms, Parallel=${parallelDuration}ms`);
    return {
      words,
      cutPoints,
      whisperTranscript: fullTranscript,
      audioUrl: bunnyWavUrl,
      // Use FFmpeg WAV URL (not CleanVoice)
      waveformJson: waveformData,
      editingDebugInfo: debugInfo,
      cleanvoiceAudioUrl
      // CleanVoice processed audio URL
    };
  } catch (error) {
    console.error(`[processVideoForEditing] Error for video ${videoId}:`, error);
    const errorDebugInfo = {
      status: "error",
      message: `\u274C Whisper API error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error)
    };
    throw error;
  }
}
async function extractWAVFromVideo(videoUrl, videoId, videoName, ffmpegApiKey, userId) {
  try {
    const startTime = Date.now();
    console.log(`[extractWAVFromVideo] \u23F1\uFE0F START ${videoName}`);
    const uploadStartTime = Date.now();
    console.log(`[extractWAVFromVideo] \u{1F4E4} FFMPEG UPLOAD START for ${videoName}`);
    const sanitizedVideoName = videoName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const videoFileName = `video_${sanitizedVideoName}.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey);
    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`[extractWAVFromVideo] \u2705 FFMPEG UPLOAD DONE in ${uploadDuration}ms`);
    const extractStartTime = Date.now();
    console.log(`[extractWAVFromVideo] \u{1F3B5} WAV EXTRACT START for ${videoName}`);
    const timestamp2 = Date.now();
    const wavFileName = `${sanitizedVideoName}_${timestamp2}.wav`;
    const wavDownloadUrl = await extractWAVWithFFmpegAPI(videoFilePath, wavFileName, ffmpegApiKey);
    const extractDuration = Date.now() - extractStartTime;
    console.log(`[extractWAVFromVideo] \u2705 WAV EXTRACT DONE in ${extractDuration}ms`);
    const downloadStartTime = Date.now();
    console.log(`[extractWAVFromVideo] \u2B07\uFE0F WAV DOWNLOAD START for ${videoName}`);
    const wavResponse = await fetch(wavDownloadUrl);
    if (!wavResponse.ok) {
      throw new Error(`Failed to download WAV: ${wavResponse.statusText}`);
    }
    const wavBuffer = Buffer.from(await wavResponse.arrayBuffer());
    const downloadDuration = Date.now() - downloadStartTime;
    console.log(`[extractWAVFromVideo] \u2705 WAV DOWNLOAD DONE in ${downloadDuration}ms`);
    const bunnyUploadStartTime = Date.now();
    console.log(`[extractWAVFromVideo] \u2601\uFE0F BUNNY UPLOAD START for ${videoName}`);
    const wavPath = `user-${userId}/audio/${wavFileName}`;
    const bunnyWavUrl = await uploadToBunnyCDN(wavBuffer, wavPath, "audio/wav");
    const bunnyUploadDuration = Date.now() - bunnyUploadStartTime;
    console.log(`[extractWAVFromVideo] \u2705 BUNNY UPLOAD DONE in ${bunnyUploadDuration}ms`);
    const waveformStartTime = Date.now();
    console.log(`[extractWAVFromVideo] \u{1F30A} WAVEFORM START for ${videoName}`);
    const waveformData = await generateWaveformData(bunnyWavUrl, videoId, videoName);
    const waveformDuration = Date.now() - waveformStartTime;
    console.log(`[extractWAVFromVideo] \u2705 WAVEFORM DONE in ${waveformDuration}ms`);
    const totalDuration = Date.now() - startTime;
    console.log(`[extractWAVFromVideo] \u2705 COMPLETE for ${videoName} in ${totalDuration}ms`);
    return {
      wavUrl: bunnyWavUrl,
      waveformJson: waveformData
    };
  } catch (error) {
    console.error(`[extractWAVFromVideo] Error for ${videoName}:`, error);
    throw error;
  }
}
async function processAudioWithWhisperCleanVoice(wavUrl, videoId, videoName, fullText, redText, redTextPosition, marginMs = 50, userApiKey, cleanvoiceApiKey, userId) {
  try {
    const startTime = Date.now();
    console.log(`[processAudioWithWhisperCleanVoice] \u23F1\uFE0F START ${videoName}`);
    if (!cleanvoiceApiKey || !userId) {
      throw new Error("CleanVoice API Key not configured");
    }
    console.log(`[processAudioWithWhisperCleanVoice] \u{1F680} PARALLEL START for ${videoName}`);
    const parallelStartTime = Date.now();
    const { processVideoWithCleanVoice: processVideoWithCleanVoice2 } = await Promise.resolve().then(() => (init_cleanvoice(), cleanvoice_exports));
    const [whisperResult, cleanvoiceResult] = await Promise.allSettled([
      transcribeWithWhisper(wavUrl, "ro", userApiKey),
      processVideoWithCleanVoice2(wavUrl, videoName, userId, cleanvoiceApiKey)
    ]);
    const parallelDuration = Date.now() - parallelStartTime;
    console.log(`[processAudioWithWhisperCleanVoice] \u2705 PARALLEL DONE in ${parallelDuration}ms`);
    if (whisperResult.status === "rejected") {
      throw new Error(`Whisper failed: ${whisperResult.reason}`);
    }
    const { words, fullTranscript } = whisperResult.value;
    if (cleanvoiceResult.status === "rejected") {
      throw new Error(`CleanVoice failed: ${cleanvoiceResult.reason}`);
    }
    const cleanvoiceAudioUrl = cleanvoiceResult.value;
    const cutPointsStartTime = Date.now();
    const { cutPoints, debugInfo } = calculateCutPointsNew(fullText, redText, words, redTextPosition, marginMs);
    const cutPointsDuration = Date.now() - cutPointsStartTime;
    console.log(`[processAudioWithWhisperCleanVoice] \u2702\uFE0F CUT POINTS in ${cutPointsDuration}ms`);
    const totalDuration = Date.now() - startTime;
    console.log(`[processAudioWithWhisperCleanVoice] \u2705 COMPLETE for ${videoName} in ${totalDuration}ms`);
    return {
      words,
      cutPoints,
      whisperTranscript: fullTranscript,
      cleanvoiceAudioUrl,
      editingDebugInfo: debugInfo
    };
  } catch (error) {
    console.error(`[processAudioWithWhisperCleanVoice] Error for ${videoName}:`, error);
    throw error;
  }
}
function buildDrawtextFilter(settings) {
  const escapeText = (text2) => {
    return text2.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/\n/g, "\\n");
  };
  const escapeFontFamily = (font) => {
    return font.replace(/,/g, "\\,").replace(/ /g, "\\ ").replace(/'/g, "").trim();
  };
  const hexColor = (color) => color.replace("#", "");
  const lines = settings.text.split("\n");
  const VIDEO_W = settings.videoWidth || 720;
  const VIDEO_H = settings.videoHeight || 1280;
  const xPos = Math.round(settings.x / 100 * VIDEO_W);
  const yPos = Math.round(settings.y / 100 * VIDEO_H);
  const fontWeight = settings.bold ? "Bold" : "";
  const fontStyle = settings.italic ? "Italic" : "";
  const scaleFactor = settings.scaleFactor || 1;
  const scaledFontSize = Math.round(settings.fontSize * scaleFactor);
  const scaledPadding = Math.round(settings.padding * scaleFactor);
  const scaledLineSpacing = Math.round(settings.lineSpacing * scaleFactor);
  console.log(`[buildDrawtextFilter] \u{1F4D0} Scaling factors:`);
  console.log(`  - fontSize: ${settings.fontSize} \u2192 ${scaledFontSize} (\xD7${scaleFactor})`);
  console.log(`  - padding: ${settings.padding} \u2192 ${scaledPadding} (\xD7${scaleFactor})`);
  console.log(`  - lineSpacing: ${settings.lineSpacing} \u2192 ${scaledLineSpacing} (\xD7${scaleFactor})`);
  console.log(`  - position: ${settings.x}%, ${settings.y}% \u2192 ${xPos}px, ${yPos}px (video: ${VIDEO_W}x${VIDEO_H})`);
  console.log(`  - bold: ${settings.bold}, italic: ${settings.italic}`);
  const drawtextFilters = lines.map((line, index) => {
    const escapedLine = escapeText(line || " ");
    const lineYOffset = index * (scaledFontSize + scaledLineSpacing);
    const finalY = yPos + lineYOffset;
    const xExpression = "(w-text_w)/2";
    const params = [
      `text='${escapedLine}'`,
      `fontsize=${scaledFontSize}`,
      `fontcolor=${hexColor(settings.textColor)}`,
      `x=${xExpression}`,
      `y=${finalY}`,
      `text_align=center`,
      // Internal text alignment (required for proper centering)
      `line_align=center`,
      // Multi-line alignment
      `box=1`,
      `boxcolor=${hexColor(settings.backgroundColor)}@${settings.opacity}`,
      `boxborderw=${scaledPadding}`
      // Note: FFmpeg doesn't support border-radius in drawtext, we'll skip it
    ];
    if (settings.fontFamily && settings.fontFamily !== "Arial") {
      const escapedFont = escapeFontFamily(settings.fontFamily);
      const fontModifiers = [fontWeight, fontStyle].filter(Boolean).join("-");
      const fullFont = fontModifiers ? `${escapedFont}-${fontModifiers}` : escapedFont;
      params.push(`font=${fullFont}`);
    }
    return `drawtext=${params.join(":")}`;
  });
  return drawtextFilters.join(",");
}
async function cutVideoWithFFmpegAPI(videoUrl, videoName, startTimeSeconds, endTimeSeconds, ffmpegApiKey, cleanVoiceAudioUrl, userId, dirId, overlaySettings) {
  try {
    console.log(`[cutVideoWithFFmpegAPI] Cutting video ${videoName}: ${startTimeSeconds}s \u2192 ${endTimeSeconds}s`);
    console.log(`[cutVideoWithFFmpegAPI] \u{1F464} userId:`, userId, `(type: ${typeof userId})`);
    if (!ffmpegApiKey) {
      throw new Error("FFMPEG API Key not configured. Please set it in Settings.");
    }
    const duration = endTimeSeconds - startTimeSeconds;
    let finalDirId = dirId;
    if (!finalDirId) {
      console.log(`[cutVideoWithFFmpegAPI] Creating new directory...`);
      const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
        method: "POST",
        headers: {
          "Authorization": ffmpegApiKey,
          "Content-Type": "application/json"
        }
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
    const videoFileName = `${videoName}_original.mp4`;
    const videoFilePath = await uploadVideoToFFmpegAPI(videoUrl, videoFileName, ffmpegApiKey, finalDirId);
    let audioFilePath;
    if (cleanVoiceAudioUrl) {
      console.log(`[cutVideoWithFFmpegAPI] Uploading CleanVoice audio to same directory...`);
      const audioFileName = `${videoName}_cleanvoice.mp3`;
      audioFilePath = await uploadVideoToFFmpegAPI(cleanVoiceAudioUrl, audioFileName, ffmpegApiKey, finalDirId);
      console.log(`[cutVideoWithFFmpegAPI] CleanVoice audio uploaded: ${audioFilePath}`);
    }
    const outputFileName = `${videoName}_trimmed_${Date.now()}.mp4`;
    const task = {
      inputs: [
        {
          file_path: videoFilePath,
          options: ["-ss", startTimeSeconds.toString(), "-t", duration.toString()]
          // Cut video input
        }
      ],
      outputs: [
        {
          file: outputFileName,
          options: []
        }
      ]
    };
    const hasOverlay = OVERLAY_ENABLED && overlaySettings?.enabled && overlaySettings?.text && videoName.toLowerCase().includes("hook");
    if (hasOverlay) {
      console.log(`[cutVideoWithFFmpegAPI] \u{1F3A8} Overlay enabled for HOOK video: ${videoName}`);
    }
    if (audioFilePath) {
      task.inputs.push({
        file_path: audioFilePath,
        options: ["-ss", startTimeSeconds.toString(), "-t", duration.toString()]
        // Cut audio input (SAME as video!)
      });
      task.outputs[0].options = [
        "-map",
        "0:v:0",
        // Map video from input 0 (already cut)
        "-map",
        "1:a:0",
        // Map audio from input 1 (already cut at SAME timestamps)
        hasOverlay ? "-c:v" : "-c:v",
        hasOverlay ? "libx264" : "copy",
        // Re-encode if overlay, copy if not
        "-c:a",
        "aac",
        // AAC audio codec
        "-b:a",
        "192k",
        // 192 kbps audio bitrate
        "-ar",
        "48000"
        // 48 kHz sample rate
      ];
      if (hasOverlay) {
        const drawtextFilter = buildDrawtextFilter(overlaySettings);
        task.outputs[0].options.push("-vf", drawtextFilter);
        console.log(`[cutVideoWithFFmpegAPI] \u{1F3A8} Drawtext filter:`, drawtextFilter);
      }
      console.log(`[cutVideoWithFFmpegAPI] \u2705 VARIANT 1: Cut both video AND audio at ${startTimeSeconds}s-${endTimeSeconds}s (perfect sync)`);
    } else {
      task.outputs[0].options = [
        hasOverlay ? "-c:v" : "-c:v",
        hasOverlay ? "libx264" : "copy",
        // Re-encode if overlay, copy if not
        "-c:a",
        "copy"
        // Copy audio codec (FAST)
      ];
      if (hasOverlay) {
        const drawtextFilter = buildDrawtextFilter(overlaySettings);
        task.outputs[0].options.push("-vf", drawtextFilter);
        console.log(`[cutVideoWithFFmpegAPI] \u{1F3A8} Drawtext filter:`, drawtextFilter);
      }
      console.log(`[cutVideoWithFFmpegAPI] Task configured: Trim only (no audio replacement)`);
    }
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: "POST",
      headers: {
        "Authorization": ffmpegApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ task })
    });
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error("[FFmpeg API] Error response:", errorText.substring(0, 500));
      console.error("[FFmpeg API] Status code:", processRes.status);
      console.error("[FFmpeg API] Status text:", processRes.statusText);
      if (processRes.status === 403) {
        throw new Error(`FFmpeg API Forbidden (403): API key may be invalid or rate limited. Please check your FFmpeg API credentials.`);
      }
      throw new Error(`FFmpeg API processing failed: ${processRes.statusText} (${processRes.status})`);
    }
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("[FFmpeg API] Invalid JSON response:", responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON (possibly HTML error page)`);
    }
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
    }
    const downloadUrl = result.result[0].download_url;
    console.log(`[cutVideoWithFFmpegAPI] Video cut successfully! Temporary URL: ${downloadUrl}`);
    console.log(`[cutVideoWithFFmpegAPI] Downloading trimmed video...`);
    const videoRes = await fetch(downloadUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download trimmed video: ${videoRes.statusText}`);
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    console.log(`[cutVideoWithFFmpegAPI] Uploading to Bunny CDN...`);
    const trimmedPath = userId ? `user-${userId}/videos/trimmed/${outputFileName}` : `videos/trimmed/${outputFileName}`;
    console.log(`[cutVideoWithFFmpegAPI] \u{1F4C1} Upload path:`, trimmedPath, `(userId: ${userId})`);
    const bunnyVideoUrl = await uploadToBunnyCDN(
      videoBuffer,
      trimmedPath,
      "video/mp4"
    );
    console.log(`[cutVideoWithFFmpegAPI] Video uploaded to Bunny CDN: ${bunnyVideoUrl}`);
    return bunnyVideoUrl;
  } catch (error) {
    console.error("[cutVideoWithFFmpegAPI] Error:", error);
    throw new Error(`Failed to cut video: ${error.message}`);
  }
}
function normalizeText(text2) {
  return text2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "").toLowerCase().trim();
}
function findSequence(words, searchWords, searchFromEnd = false) {
  if (!searchWords || searchWords.length === 0) {
    return null;
  }
  const normalizedSearch = searchWords.map(normalizeText);
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
          endIdx: i + normalizedSearch.length - 1
        };
      }
    }
  } else {
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
          endIdx: i + normalizedSearch.length - 1
        };
      }
    }
  }
  return null;
}
function isAtBeginning(startIdx, totalWords) {
  return startIdx < totalWords * 0.2;
}
function isAtEnd(endIdx, totalWords) {
  return endIdx > totalWords * 0.8;
}
function calculateCutPointsNew(fullText, redText, words, redTextPosition, marginMs = 50) {
  const logs = [];
  const marginS = marginMs / 1e3;
  let whiteText;
  if (!redText || redText.trim().length === 0) {
    whiteText = fullText.trim();
  } else if (redTextPosition === "START") {
    whiteText = fullText.substring(redText.length).trim();
  } else {
    whiteText = fullText.substring(0, fullText.length - redText.length).trim();
  }
  const preprocessText = (text2) => text2.replace(/[-,."']/g, " ");
  const preprocessedWhiteText = preprocessText(whiteText);
  const normalizedWhiteText = normalizeText(preprocessedWhiteText);
  const whiteWords = normalizedWhiteText.split(/\s+/).filter((w) => w.length > 0);
  const preprocessedRedText = preprocessText(redText);
  const normalizedRedText = normalizeText(preprocessedRedText);
  const redWords = normalizedRedText.split(/\s+/).filter((w) => w.length > 0);
  logs.push(`\u{1F50D} Starting search algorithm...`);
  logs.push(`\u{1F4C4} Full text: "${fullText}"`);
  logs.push(`\u26AA White text: "${whiteText}" (${whiteWords.length} words)`);
  logs.push(`\u{1F534} Red text: "${redText}" (${redWords.length} words, position: ${redTextPosition})`);
  logs.push(`\u{1F3A4} Whisper transcript: "${words.map((w) => w.word).join(" ")}" (${words.length} words)`);
  logs.push(``);
  logs.push(`\u{1F50E} Step 1: Searching for entire white text...`);
  const whiteMatch = findSequence(words, whiteWords);
  if (whiteMatch) {
    logs.push(`\u2705 Searched for entire white text: FOUND at indices ${whiteMatch.startIdx}-${whiteMatch.endIdx}`);
    const startWord = words[whiteMatch.startIdx];
    const endWord = words[whiteMatch.endIdx];
    const startKeep2 = Math.max(0, startWord.start - marginS);
    const endKeep2 = endWord.end + marginS;
    logs.push(`\u2705 Placed START marker before "${startWord.word}" at ${startKeep2.toFixed(0)}ms`);
    logs.push(`\u2705 Placed END marker after "${endWord.word}" at ${endKeep2.toFixed(0)}ms`);
    logs.push(`\u{1F3AF} Algorithm complete!`);
    return {
      cutPoints: {
        startKeep: Math.round(startKeep2),
        endKeep: Math.round(endKeep2),
        redPosition: redTextPosition || "START",
        // Default to START if undefined
        confidence: 0.95
      },
      debugInfo: {
        status: "success",
        message: `\u2705 Found entire white text`,
        whisperTranscript: words.map((w) => w.word).join(" "),
        whisperWordCount: words.length,
        redTextDetected: {
          found: !redText || redText.trim().length === 0 ? false : true,
          position: redTextPosition,
          fullText: redText
        },
        algorithmLogs: logs
      }
    };
  }
  logs.push(`\u274C Searched for entire white text: NOT FOUND`);
  logs.push(``);
  logs.push(`\u{1F50E} Step 2: Searching for last 3 words of white text...`);
  for (let n = 3; n >= 2; n--) {
    if (whiteWords.length < n) continue;
    const lastNWords = whiteWords.slice(-n);
    logs.push(`\u{1F50D} Searching for last ${n} white words: "${lastNWords.join(" ")}"`);
    const match = findSequence(words, lastNWords);
    if (match) {
      logs.push(`\u2705 Found last ${n} white words at indices ${match.startIdx}-${match.endIdx}`);
      if (redTextPosition === "END") {
        logs.push(`\u2705 White text is at beginning \u2192 placing END marker AFTER last word`);
        const lastMatchWord = words[match.endIdx];
        const startKeep2 = Math.max(0, words[0].start - marginS);
        const endKeep2 = lastMatchWord.end + marginS;
        logs.push(`\u2705 Placed START marker at ${startKeep2.toFixed(0)}ms`);
        logs.push(`\u2705 Placed END marker after "${lastMatchWord.word}" at ${endKeep2.toFixed(0)}ms`);
        logs.push(`\u{1F3AF} Algorithm complete!`);
        return {
          cutPoints: {
            startKeep: Math.round(startKeep2),
            endKeep: Math.round(endKeep2),
            redPosition: "END",
            confidence: 0.8
          },
          debugInfo: {
            status: "success",
            message: `\u2705 Found last ${n} white words`,
            whisperTranscript: words.map((w) => w.word).join(" "),
            whisperWordCount: words.length,
            algorithmLogs: logs
          }
        };
      } else {
        logs.push(`\u26A0\uFE0F White text is at end \u2192 last words don't help us`);
      }
    } else {
      logs.push(`\u274C Last ${n} white words: NOT FOUND`);
    }
  }
  logs.push(``);
  logs.push(`\u{1F50E} Step 3: Searching for first 3 words of white text...`);
  for (let n = 3; n >= 2; n--) {
    if (whiteWords.length < n) continue;
    const firstNWords = whiteWords.slice(0, n);
    logs.push(`\u{1F50D} Searching for first ${n} white words: "${firstNWords.join(" ")}"`);
    const match = findSequence(words, firstNWords);
    if (match) {
      logs.push(`\u2705 Found first ${n} white words at indices ${match.startIdx}-${match.endIdx}`);
      if (redTextPosition === "START") {
        logs.push(`\u2705 White text is at end \u2192 placing START marker BEFORE first word`);
        const firstMatchWord = words[match.startIdx];
        const startKeep2 = firstMatchWord.start - marginS;
        const endKeep2 = words[words.length - 1].end + marginS;
        logs.push(`\u2705 Placed START marker before "${firstMatchWord.word}" at ${startKeep2.toFixed(0)}ms`);
        logs.push(`\u2705 Placed END marker at ${endKeep2.toFixed(0)}ms`);
        logs.push(`\u{1F3AF} Algorithm complete!`);
        return {
          cutPoints: {
            startKeep: Math.round(startKeep2),
            endKeep: Math.round(endKeep2),
            redPosition: "START",
            confidence: 0.8
          },
          debugInfo: {
            status: "success",
            message: `\u2705 Found first ${n} white words`,
            whisperTranscript: words.map((w) => w.word).join(" "),
            whisperWordCount: words.length,
            algorithmLogs: logs
          }
        };
      } else {
        logs.push(`\u26A0\uFE0F White text is at beginning \u2192 first words don't help us`);
      }
    } else {
      logs.push(`\u274C First ${n} white words: NOT FOUND`);
    }
  }
  logs.push(``);
  if (redTextPosition === "START") {
    logs.push(`\u{1F50E} Step 4: Red text is at START \u2192 searching for last 3 words of red text...`);
    for (let n = 3; n >= 2; n--) {
      if (redWords.length < n) continue;
      const lastNWords = redWords.slice(-n);
      logs.push(`\u{1F50D} Searching for last ${n} red words: "${lastNWords.join(" ")}"`);
      const match = findSequence(words, lastNWords);
      if (match) {
        logs.push(`\u2705 Found last ${n} red words at indices ${match.startIdx}-${match.endIdx}`);
        logs.push(`\u2705 This marks END of red text \u2192 placing START marker AFTER last word`);
        const lastMatchWord = words[match.endIdx];
        const startKeep2 = lastMatchWord.end + marginS;
        const endKeep2 = words[words.length - 1].end + marginS;
        logs.push(`\u2705 Placed START marker after "${lastMatchWord.word}" at ${startKeep2.toFixed(0)}ms`);
        logs.push(`\u2705 Placed END marker at ${endKeep2.toFixed(0)}ms`);
        logs.push(`\u{1F3AF} Algorithm complete!`);
        return {
          cutPoints: {
            startKeep: Math.round(startKeep2),
            endKeep: Math.round(endKeep2),
            redPosition: "START",
            confidence: 0.75
          },
          debugInfo: {
            status: "success",
            message: `\u2705 Found last ${n} red words`,
            whisperTranscript: words.map((w) => w.word).join(" "),
            whisperWordCount: words.length,
            algorithmLogs: logs
          }
        };
      } else {
        logs.push(`\u274C Last ${n} red words: NOT FOUND`);
      }
    }
  }
  if (redTextPosition === "END") {
    logs.push(`\u{1F50E} Step 5: Red text is at END \u2192 searching for first 3 words of red text...`);
    for (let n = 3; n >= 2; n--) {
      if (redWords.length < n) continue;
      const firstNWords = redWords.slice(0, n);
      logs.push(`\u{1F50D} Searching for first ${n} red words: "${firstNWords.join(" ")}"`);
      const match = findSequence(words, firstNWords);
      if (match) {
        logs.push(`\u2705 Found first ${n} red words at indices ${match.startIdx}-${match.endIdx}`);
        logs.push(`\u2705 This marks START of red text \u2192 placing END marker BEFORE first word`);
        const firstMatchWord = words[match.startIdx];
        const startKeep2 = Math.max(0, words[0].start - marginS);
        const endKeep2 = firstMatchWord.start - marginS;
        if (endKeep2 <= startKeep2) {
          logs.push(`\u274C No white text before red text - cannot calculate cut points`);
          return {
            cutPoints: null,
            debugInfo: {
              status: "error",
              message: `\u274C No white text before red text`,
              whisperTranscript: words.map((w) => w.word).join(" "),
              whisperWordCount: words.length,
              algorithmLogs: logs
            }
          };
        }
        logs.push(`\u2705 Placed START marker at ${startKeep2.toFixed(0)}ms`);
        logs.push(`\u2705 Placed END marker before "${firstMatchWord.word}" at ${endKeep2.toFixed(0)}ms`);
        logs.push(`\u{1F3AF} Algorithm complete!`);
        return {
          cutPoints: {
            startKeep: Math.round(startKeep2),
            endKeep: Math.round(endKeep2),
            redPosition: "END",
            confidence: 0.75
          },
          debugInfo: {
            status: "success",
            message: `\u2705 Found first ${n} red words`,
            whisperTranscript: words.map((w) => w.word).join(" "),
            whisperWordCount: words.length,
            algorithmLogs: logs
          }
        };
      } else {
        logs.push(`\u274C First ${n} red words: NOT FOUND`);
      }
    }
  }
  logs.push(`\u{1F50E} Step 6: Searching for entire red text...`);
  const searchFromEnd = redTextPosition === "END";
  const redMatch = findSequence(words, redWords, searchFromEnd);
  if (redMatch) {
    logs.push(`\u2705 Searched for entire red text: FOUND at indices ${redMatch.startIdx}-${redMatch.endIdx}`);
    const redAtBeginning = isAtBeginning(redMatch.startIdx, words.length);
    const redAtEnd = isAtEnd(redMatch.endIdx, words.length);
    if (redAtEnd) {
      logs.push(`\u2705 Red text is at END of transcript \u2192 placing END marker BEFORE first red word`);
      const firstRedWord = words[redMatch.startIdx];
      const startKeep2 = Math.max(0, words[0].start - marginS);
      const endKeep2 = firstRedWord.start - marginS;
      if (endKeep2 <= startKeep2) {
        logs.push(`\u274C No white text before red text - cannot calculate cut points`);
        return {
          cutPoints: null,
          debugInfo: {
            status: "error",
            message: `\u274C No white text before red text`,
            whisperTranscript: words.map((w) => w.word).join(" "),
            whisperWordCount: words.length,
            algorithmLogs: logs
          }
        };
      }
      logs.push(`\u2705 Placed START marker at ${startKeep2.toFixed(0)}ms`);
      logs.push(`\u2705 Placed END marker before "${firstRedWord.word}" at ${endKeep2.toFixed(0)}ms`);
      logs.push(`\u{1F3AF} Algorithm complete!`);
      return {
        cutPoints: {
          startKeep: Math.round(startKeep2),
          endKeep: Math.round(endKeep2),
          redPosition: "END",
          confidence: 0.9
        },
        debugInfo: {
          status: "success",
          message: `\u2705 Found entire red text at END`,
          whisperTranscript: words.map((w) => w.word).join(" "),
          whisperWordCount: words.length,
          redTextDetected: {
            found: true,
            position: "END",
            fullText: redText,
            timeRange: { start: words[redMatch.startIdx].start, end: words[redMatch.endIdx].end }
          },
          algorithmLogs: logs
        }
      };
    } else if (redAtBeginning) {
      logs.push(`\u2705 Red text is at BEGINNING of transcript \u2192 placing START marker AFTER last red word`);
      const lastRedWord = words[redMatch.endIdx];
      const startKeep2 = lastRedWord.end + marginS;
      const endKeep2 = words[words.length - 1].end + marginS;
      logs.push(`\u2705 Placed START marker after "${lastRedWord.word}" at ${startKeep2.toFixed(0)}ms`);
      logs.push(`\u2705 Placed END marker at ${endKeep2.toFixed(0)}ms`);
      logs.push(`\u{1F3AF} Algorithm complete!`);
      return {
        cutPoints: {
          startKeep: Math.round(startKeep2),
          endKeep: Math.round(endKeep2),
          redPosition: "START",
          confidence: 0.9
        },
        debugInfo: {
          status: "success",
          message: `\u2705 Found entire red text at START`,
          whisperTranscript: words.map((w) => w.word).join(" "),
          whisperWordCount: words.length,
          redTextDetected: {
            found: true,
            position: "START",
            fullText: redText,
            timeRange: { start: words[redMatch.startIdx].start, end: words[redMatch.endIdx].end }
          },
          algorithmLogs: logs
        }
      };
    }
  }
  logs.push(`\u274C Searched for entire red text: NOT FOUND`);
  logs.push(``);
  logs.push(``);
  logs.push(`\u26A0\uFE0F Algorithm could not find matching text in transcript`);
  logs.push(`\u2705 Returning default cutPoints: 0 to ${words[words.length - 1].end.toFixed(0)}ms`);
  const startKeep = 0;
  const endKeep = words[words.length - 1].end + marginS;
  return {
    cutPoints: {
      startKeep: Math.round(startKeep),
      endKeep: Math.round(endKeep),
      redPosition: redTextPosition || "START",
      confidence: 0.5
      // Low confidence since we didn't find the text
    },
    debugInfo: {
      status: "warning",
      message: `\u26A0\uFE0F Could not find matching text - using default cutPoints (0 to duration)`,
      whisperTranscript: words.map((w) => w.word).join(" "),
      whisperWordCount: words.length,
      algorithmLogs: logs
    }
  };
}
async function mergeVideosWithFilterComplex(videoUrls, outputVideoName, ffmpegApiKey, userId, folder = "merged-final-videos", useLoudnorm = true) {
  try {
    console.log("\n\n========================================");
    console.log("[mergeVideosWithFilterComplex] \u{1F680} MERGE STARTED");
    console.log(`[mergeVideosWithFilterComplex] Output name: ${outputVideoName}`);
    console.log(`[mergeVideosWithFilterComplex] Video count: ${videoUrls.length}`);
    console.log(`[mergeVideosWithFilterComplex] Video URLs:`, videoUrls);
    console.log("========================================\n");
    if (!ffmpegApiKey) {
      throw new Error("FFMPEG API Key not configured. Please set it in Settings.");
    }
    if (videoUrls.length === 0) {
      throw new Error("No videos provided for merging");
    }
    if (videoUrls.length === 1) {
      console.log(`[mergeVideosWithFilterComplex] Only 1 video, returning original URL`);
      return videoUrls[0];
    }
    console.log(`[mergeVideosWithFilterComplex] \u{1F4C1} Step 1: Creating directory...`);
    const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
      method: "POST",
      headers: {
        "Authorization": ffmpegApiKey,
        "Content-Type": "application/json"
      }
    });
    if (!dirRes.ok) {
      throw new Error(`Failed to create directory: ${dirRes.statusText}`);
    }
    const dirData = await dirRes.json();
    const dirId = dirData.directory.id;
    console.log(`[mergeVideosWithFilterComplex] \u2705 Created directory: ${dirId}`);
    console.log(`[mergeVideosWithFilterComplex] \u{1F4DD} Step 2: Registering ${videoUrls.length} files...`);
    const batchTimestamp = Date.now();
    const fileRegistrations = await Promise.all(
      videoUrls.map(async (videoUrl, i) => {
        const fileName = `merge_input_${i}_${batchTimestamp}.mp4`;
        const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
          method: "POST",
          headers: {
            "Authorization": ffmpegApiKey,
            "Content-Type": "application/json"
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
        console.log(`[mergeVideosWithFilterComplex] \u2705 Registered ${i + 1}/${videoUrls.length}: ${fileData.file.file_path}`);
        return {
          file: fileData.file,
          upload: fileData.upload,
          videoUrl
        };
      })
    );
    console.log(`[mergeVideosWithFilterComplex] \u2705 All files registered!`);
    console.log(`[mergeVideosWithFilterComplex] \u{1F4E4} Step 3: Uploading ${videoUrls.length} videos to FFmpeg API...`);
    await Promise.all(
      fileRegistrations.map(async ({ upload, videoUrl, file }, i) => {
        console.log(`[mergeVideosWithFilterComplex] \u2B07\uFE0F Downloading ${i + 1}/${videoUrls.length} from Bunny CDN...`);
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) {
          throw new Error(`Failed to download video ${i}: ${videoRes.status} ${videoRes.statusText}`);
        }
        const videoBuffer2 = await videoRes.arrayBuffer();
        const videoSizeMB = (videoBuffer2.byteLength / (1024 * 1024)).toFixed(2);
        console.log(`[mergeVideosWithFilterComplex] \u2705 Downloaded ${i + 1}/${videoUrls.length}: ${videoSizeMB} MB`);
        console.log(`[mergeVideosWithFilterComplex] \u2B06\uFE0F Uploading ${i + 1}/${videoUrls.length} to FFmpeg API (S3)...`);
        const uploadHeaders = upload.headers || {};
        const uploadRes = await fetch(upload.url, {
          method: "PUT",
          body: videoBuffer2,
          headers: uploadHeaders
        });
        if (!uploadRes.ok) {
          throw new Error(`Failed to upload video ${i}: ${uploadRes.statusText}`);
        }
        console.log(`[mergeVideosWithFilterComplex] \u2705 Uploaded ${i + 1}/${videoUrls.length}: ${file.file_path}`);
      })
    );
    console.log(`[mergeVideosWithFilterComplex] \u2705 All videos uploaded!`);
    const uploadedFilePaths = fileRegistrations.map(({ file }) => file.file_path);
    console.log(`
========================================`);
    console.log(`[mergeVideosWithFilterComplex] \u{1F4DD} STEP 4: Extracted file paths`);
    console.log(`========================================`);
    console.log(`[mergeVideosWithFilterComplex] Uploaded video file paths:`);
    uploadedFilePaths.forEach((path4, i) => {
      console.log(`[mergeVideosWithFilterComplex]   ${i + 1}. ${path4}`);
    });
    console.log(`========================================
`);
    writeFileSync(
      "/tmp/ffmpeg_file_paths_debug.txt",
      `Directory ID: ${dirId}
Uploaded video file paths:
` + uploadedFilePaths.map((p, i) => `  ${i + 1}. ${p}`).join("\n") + "\n",
      "utf-8"
    );
    const inputStreams = uploadedFilePaths.map((_, i) => `[${i}:v][${i}:a]`).join("");
    const filterComplex = useLoudnorm ? `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a0];[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]` : `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a]`;
    console.log(`
========================================`);
    console.log(`[mergeVideosWithFilterComplex] \u{1F4DD} STEP 5: Building filter_complex`);
    console.log(`========================================`);
    console.log(`[mergeVideosWithFilterComplex] Loudnorm: ${useLoudnorm ? "ENABLED" : "DISABLED"}`);
    console.log(`[mergeVideosWithFilterComplex] Filter: ${filterComplex}`);
    console.log(`========================================
`);
    const outputFileName = `${outputVideoName}_${Date.now()}.mp4`;
    const task = {
      inputs: uploadedFilePaths.map((path4) => ({ file_path: path4 })),
      filter_complex: filterComplex,
      outputs: [
        {
          file: outputFileName,
          maps: ["[v]", "[a]"],
          options: [
            "-fflags",
            "+genpts",
            // Regenerate timestamps to fix audio/video sync
            "-c:v",
            "libx264",
            "-crf",
            "18",
            // High quality (18 = visually lossless)
            "-preset",
            "medium",
            // NOTE: -movflags faststart REMOVED - causes video freezing at 4s for complex merges (HOOK+BODY with loudnorm)
            "-c:a",
            "aac",
            "-ar",
            "48000",
            "-ac",
            "1",
            // Keep MONO audio (same as input videos) to prevent sync issues
            "-shortest"
            // End output when shortest stream ends (fixes audio/video duration mismatch)
            // NO -af here! Audio comes from [outa] via maps
          ]
        }
      ]
    };
    console.log(`
========================================`);
    console.log(`[mergeVideosWithFilterComplex] \u{1F3AC} STEP 6: Preparing FFmpeg task`);
    console.log(`========================================`);
    console.log(`[mergeVideosWithFilterComplex] Method: filter_complex concat`);
    console.log(`[mergeVideosWithFilterComplex] Inputs: ${uploadedFilePaths.length} videos`);
    console.log(`[mergeVideosWithFilterComplex] Output: ${outputFileName}`);
    console.log(`[mergeVideosWithFilterComplex] Audio normalization: dynaudnorm`);
    console.log(`========================================
`);
    console.log(`[mergeVideosWithFilterComplex] Sending merge task to FFmpeg API...`);
    console.log(`[mergeVideosWithFilterComplex] \u{1F4CB} Task details:`, JSON.stringify(task, null, 2));
    console.log(`[mergeVideosWithFilterComplex] \u{1F4CA} Inputs count: ${task.inputs.length}`);
    console.log(`[mergeVideosWithFilterComplex] \u{1F3AF} Output file: ${outputFileName}`);
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: "POST",
      headers: {
        "Authorization": ffmpegApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ task })
    });
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error("[FFmpeg API] \u274C HTTP Status:", processRes.status, processRes.statusText);
      console.error("[FFmpeg API] \u274C Error response:", errorText.substring(0, 500));
      console.error("[FFmpeg API] \u274C Task sent:", JSON.stringify(task, null, 2));
      console.error("[FFmpeg API] \u274C Request URL:", `${FFMPEG_API_BASE}/ffmpeg/process`);
      console.error("[FFmpeg API] \u274C Videos count:", videoUrls.length);
      throw new Error(`FFmpeg API merge failed: ${processRes.statusText} - ${errorText.substring(0, 200)}`);
    }
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("[FFmpeg API] Invalid JSON response:", responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON`);
    }
    if (!result.ok || !result.result || result.result.length === 0) {
      console.error("[FFmpeg API] Merge failed:", result);
      throw new Error(`FFmpeg API merge failed: ${result.message || "Unknown error"}`);
    }
    const mergedFile = result.result[0];
    const downloadUrl = mergedFile.download_url;
    console.log(`[mergeVideosWithFilterComplex] Merge successful: ${mergedFile.file_name}`);
    console.log(`[mergeVideosWithFilterComplex] Download URL: ${downloadUrl}`);
    console.log(`[mergeVideosWithFilterComplex] Downloading merged video from: ${downloadUrl}`);
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download merged video: ${downloadRes.statusText}`);
    }
    const videoBuffer = Buffer.from(await downloadRes.arrayBuffer());
    console.log(`[mergeVideosWithFilterComplex] Downloaded ${videoBuffer.length} bytes`);
    const BUNNYCDN_STORAGE_PASSWORD2 = "4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b";
    const BUNNYCDN_STORAGE_ZONE2 = "manus-storage";
    const BUNNYCDN_PULL_ZONE_URL2 = "https://manus.b-cdn.net";
    const bunnyFileName = outputFileName;
    const targetFolder = folder || "prepare-for-merge";
    const mergedPath = userId ? `user-${userId}/videos/${targetFolder}/${bunnyFileName}` : `videos/${targetFolder}/${bunnyFileName}`;
    const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${mergedPath}`;
    console.log(`[mergeVideosWithFilterComplex] Uploading to Bunny CDN: merged-videos/${bunnyFileName}`);
    try {
      const folderPath = userId ? `user-${userId}/videos/${targetFolder}` : `videos/${targetFolder}`;
      const listUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${folderPath}/`;
      console.log(`[mergeVideosWithFilterComplex] \u{1F5D1}\uFE0F Checking for old videos to delete in: ${folderPath}`);
      const listResponse = await fetch(listUrl, {
        method: "GET",
        headers: {
          "AccessKey": BUNNYCDN_STORAGE_PASSWORD2
        }
      });
      if (listResponse.ok) {
        const files = await listResponse.json();
        const baseNameWithoutTimestamp = outputVideoName.replace(/_\d{13}$/, "");
        for (const file of files) {
          if (file.ObjectName && file.ObjectName.startsWith(baseNameWithoutTimestamp) && file.ObjectName !== bunnyFileName) {
            const oldFilePath = `${folderPath}/${file.ObjectName}`;
            const deleteUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${oldFilePath}`;
            console.log(`[mergeVideosWithFilterComplex] \u{1F5D1}\uFE0F Deleting old video: ${file.ObjectName}`);
            const deleteResponse = await fetch(deleteUrl, {
              method: "DELETE",
              headers: {
                "AccessKey": BUNNYCDN_STORAGE_PASSWORD2
              }
            });
            if (deleteResponse.ok || deleteResponse.status === 404) {
              console.log(`[mergeVideosWithFilterComplex] \u2705 Deleted: ${file.ObjectName}`);
            } else {
              console.warn(`[mergeVideosWithFilterComplex] \u26A0\uFE0F Failed to delete ${file.ObjectName}: ${deleteResponse.status}`);
            }
          }
        }
      }
    } catch (cleanupError) {
      console.warn(`[mergeVideosWithFilterComplex] \u26A0\uFE0F Cleanup failed (non-fatal):`, cleanupError);
    }
    const uploadResponse = await fetch(storageUrl, {
      method: "PUT",
      body: videoBuffer,
      headers: {
        "AccessKey": BUNNYCDN_STORAGE_PASSWORD2,
        "Content-Type": "video/mp4"
      }
    });
    if (uploadResponse.status !== 201) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload to Bunny CDN: ${uploadResponse.status} - ${errorText}`);
    }
    const cdnUrl = `${BUNNYCDN_PULL_ZONE_URL2}/${mergedPath}`;
    console.log(`[mergeVideosWithFilterComplex] \u2705 Merge complete: ${cdnUrl}`);
    return cdnUrl;
  } catch (error) {
    console.error(`[mergeVideosWithFilterComplex] Error:`, error);
    throw error;
  }
}
async function mergeVideosSimple(videoUrls, outputVideoName, ffmpegApiKey, userId, folder = "prepare-for-merge") {
  try {
    console.log(`
========================================`);
    console.log(`[mergeVideosSimple] \u{1F680} Starting SIMPLE merge (fast re-encode)`);
    console.log(`========================================`);
    console.log(`[mergeVideosSimple] Videos to merge: ${videoUrls.length}`);
    console.log(`[mergeVideosSimple] Output name: ${outputVideoName}`);
    console.log(`[mergeVideosSimple] Method: concat filter with re-encode (veryfast)`);
    console.log(`========================================
`);
    if (videoUrls.length === 0) {
      throw new Error("No videos provided");
    }
    if (videoUrls.length === 1) {
      console.log(`[mergeVideosSimple] Only 1 video, returning original URL`);
      return videoUrls[0];
    }
    console.log(`[mergeVideosSimple] \u{1F4C1} Step 1: Creating directory...`);
    const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
      method: "POST",
      headers: {
        "Authorization": ffmpegApiKey,
        "Content-Type": "application/json"
      }
    });
    if (!dirRes.ok) {
      throw new Error(`Failed to create directory: ${dirRes.statusText}`);
    }
    const dirData = await dirRes.json();
    const dirId = dirData.directory.id;
    console.log(`[mergeVideosSimple] \u2705 Created directory: ${dirId}`);
    console.log(`[mergeVideosSimple] \u{1F4DD} Step 2: Registering ${videoUrls.length} video files...`);
    const batchTimestamp = Date.now();
    const fileRegistrations = await Promise.all(
      videoUrls.map(async (videoUrl, i) => {
        const fileName = `merge_input_${i}_${batchTimestamp}.mp4`;
        const fileRes = await fetch(`${FFMPEG_API_BASE}/file`, {
          method: "POST",
          headers: {
            "Authorization": ffmpegApiKey,
            "Content-Type": "application/json"
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
        console.log(`[mergeVideosSimple] \u2705 Registered ${i + 1}/${videoUrls.length}: ${fileData.file.file_path}`);
        return {
          file: fileData.file,
          upload: fileData.upload,
          videoUrl
        };
      })
    );
    console.log(`[mergeVideosSimple] \u2705 All video files registered!`);
    console.log(`[mergeVideosSimple] \u{1F4E4} Step 3: Uploading ${videoUrls.length} videos...`);
    await Promise.all(
      fileRegistrations.map(async ({ upload, videoUrl, file }, i) => {
        console.log(`[mergeVideosSimple] \u2B07\uFE0F Downloading ${i + 1}/${videoUrls.length} from CDN...`);
        const videoRes2 = await fetch(videoUrl);
        if (!videoRes2.ok) {
          throw new Error(`Failed to download video ${i}: ${videoRes2.statusText}`);
        }
        const videoBuffer2 = await videoRes2.arrayBuffer();
        const videoSizeMB2 = (videoBuffer2.byteLength / (1024 * 1024)).toFixed(2);
        console.log(`[mergeVideosSimple] \u2705 Downloaded ${i + 1}/${videoUrls.length}: ${videoSizeMB2} MB`);
        console.log(`[mergeVideosSimple] \u2B06\uFE0F Uploading ${i + 1}/${videoUrls.length} to FFmpeg API...`);
        const uploadHeaders = upload.headers || {};
        const uploadRes = await fetch(upload.url, {
          method: "PUT",
          body: videoBuffer2,
          headers: uploadHeaders
        });
        if (!uploadRes.ok) {
          throw new Error(`Failed to upload video ${i}: ${uploadRes.statusText}`);
        }
        console.log(`[mergeVideosSimple] \u2705 Uploaded ${i + 1}/${videoUrls.length}: ${file.file_path}`);
      })
    );
    console.log(`[mergeVideosSimple] \u2705 All videos uploaded!`);
    const uploadedFilePaths = fileRegistrations.map(({ file }) => file.file_path);
    console.log(`
========================================`);
    console.log(`[mergeVideosSimple] \u{1F4DD} STEP 4: Building concat filter`);
    console.log(`========================================`);
    console.log(`[mergeVideosSimple] Uploaded file paths:`);
    uploadedFilePaths.forEach((path4, i) => {
      console.log(`[mergeVideosSimple]   ${i + 1}. ${path4}`);
    });
    const inputStreams = uploadedFilePaths.map((_, i) => `[${i}:v][${i}:a]`).join("");
    const filterComplex = `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a]`;
    console.log(`[mergeVideosSimple] Filter: ${filterComplex}`);
    console.log(`========================================
`);
    const outputFileName = `${outputVideoName}_${Date.now()}.mp4`;
    const task = {
      inputs: uploadedFilePaths.map((path4) => ({ file_path: path4 })),
      filter_complex: filterComplex,
      outputs: [
        {
          file: outputFileName,
          maps: ["[v]", "[a]"],
          options: [
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            // NOTE: -movflags faststart REMOVED - causes video freezing issues
            "-c:a",
            "aac",
            "-b:a",
            "192k"
          ]
        }
      ]
    };
    console.log(`
========================================`);
    console.log(`[mergeVideosSimple] \u{1F3AC} STEP 5: Preparing FFmpeg task`);
    console.log(`========================================`);
    console.log(`[mergeVideosSimple] Method: concat filter with re-encode`);
    console.log(`[mergeVideosSimple] Inputs: ${uploadedFilePaths.length} videos`);
    console.log(`[mergeVideosSimple] Output: ${outputFileName}`);
    console.log(`[mergeVideosSimple] Codec: libx264 veryfast CRF18 + aac 192k`);
    console.log(`========================================
`);
    console.log(`[mergeVideosSimple] Sending task to FFmpeg API...`);
    console.log(`[mergeVideosSimple] \u{1F4CB} Task:`, JSON.stringify(task, null, 2));
    const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
      method: "POST",
      headers: {
        "Authorization": ffmpegApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ task })
    });
    if (!processRes.ok) {
      const errorText = await processRes.text();
      console.error("[mergeVideosSimple] \u274C FFmpeg API error:", errorText.substring(0, 500));
      throw new Error(`FFmpeg API failed: ${processRes.statusText} - ${errorText.substring(0, 200)}`);
    }
    const responseText = await processRes.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("[mergeVideosSimple] Invalid JSON:", responseText.substring(0, 500));
      throw new Error(`FFmpeg API returned invalid JSON`);
    }
    if (!result.ok || !result.result || result.result.length === 0) {
      throw new Error(`FFmpeg API returned no result`);
    }
    const downloadUrl = result.result[0].download_url;
    console.log(`[mergeVideosSimple] \u2705 FFmpeg processing complete!`);
    console.log(`[mergeVideosSimple] Download URL: ${downloadUrl}`);
    console.log(`[mergeVideosSimple] \u{1F4E4} Step 6: Uploading to BunnyCDN...`);
    const videoRes = await fetch(downloadUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download from FFmpeg API: ${videoRes.statusText}`);
    }
    const videoBuffer = await videoRes.arrayBuffer();
    const videoSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(2);
    console.log(`[mergeVideosSimple] Downloaded merged video: ${videoSizeMB} MB`);
    const mergedPath = userId ? `user-${userId}/videos/${folder}/${outputFileName}` : `videos/${folder}/${outputFileName}`;
    console.log(`[mergeVideosSimple] \u{1F4C1} Upload path: ${mergedPath} (userId: ${userId}, folder: ${folder})`);
    try {
      const BUNNYCDN_STORAGE_PASSWORD2 = "4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b";
      const BUNNYCDN_STORAGE_ZONE2 = "manus-storage";
      const folderPath = userId ? `user-${userId}/videos/${folder}` : `videos/${folder}`;
      const listUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${folderPath}/`;
      console.log(`[mergeVideosSimple] \u{1F5D1}\uFE0F Checking for old videos to delete in: ${folderPath}`);
      const listResponse = await fetch(listUrl, {
        method: "GET",
        headers: {
          "AccessKey": BUNNYCDN_STORAGE_PASSWORD2
        }
      });
      if (listResponse.ok) {
        const files = await listResponse.json();
        const baseNameWithoutTimestamp = outputFileName.replace(/_\d{13}\.mp4$/, "");
        for (const file of files) {
          if (file.ObjectName && file.ObjectName.startsWith(baseNameWithoutTimestamp) && file.ObjectName !== outputFileName) {
            const oldFilePath = `${folderPath}/${file.ObjectName}`;
            const deleteUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${oldFilePath}`;
            console.log(`[mergeVideosSimple] \u{1F5D1}\uFE0F Deleting old video: ${file.ObjectName}`);
            const deleteResponse = await fetch(deleteUrl, {
              method: "DELETE",
              headers: {
                "AccessKey": BUNNYCDN_STORAGE_PASSWORD2
              }
            });
            if (deleteResponse.ok || deleteResponse.status === 404) {
              console.log(`[mergeVideosSimple] \u2705 Deleted: ${file.ObjectName}`);
            } else {
              console.warn(`[mergeVideosSimple] \u26A0\uFE0F Failed to delete ${file.ObjectName}: ${deleteResponse.status}`);
            }
          }
        }
      }
    } catch (cleanupError) {
      console.warn(`[mergeVideosSimple] \u26A0\uFE0F Cleanup failed (non-fatal):`, cleanupError);
    }
    const cdnUrl = await uploadToBunnyCDN(
      Buffer.from(videoBuffer),
      mergedPath,
      "video/mp4"
    );
    console.log(`[mergeVideosSimple] \u2705 Uploaded to BunnyCDN: ${cdnUrl}`);
    console.log(`
========================================`);
    console.log(`[mergeVideosSimple] \u{1F389} MERGE COMPLETE!`);
    console.log(`========================================`);
    console.log(`[mergeVideosSimple] Final CDN URL: ${cdnUrl}`);
    console.log(`[mergeVideosSimple] Method: concat filter (fast re-encode)`);
    console.log(`[mergeVideosSimple] Videos merged: ${videoUrls.length}`);
    console.log(`========================================
`);
    return cdnUrl;
  } catch (error) {
    console.error(`[mergeVideosSimple] \u274C Error:`, error);
    throw error;
  }
}
async function mergeVideosWithFilterComplexLocal(videoUrls, outputVideoName, userId, folder = "merged", useLoudnorm = true) {
  try {
    console.log("\n\n========================================");
    console.log("[mergeVideosWithFilterComplexLocal] \u{1F680} LOCAL MERGE STARTED");
    console.log(`[mergeVideosWithFilterComplexLocal] Output name: ${outputVideoName}`);
    console.log(`[mergeVideosWithFilterComplexLocal] Video count: ${videoUrls.length}`);
    console.log(`[mergeVideosWithFilterComplexLocal] Video URLs:`, videoUrls);
    console.log(`[mergeVideosWithFilterComplexLocal] Loudnorm: ${useLoudnorm ? "ENABLED" : "DISABLED"}`);
    console.log("========================================\n");
    if (videoUrls.length === 0) {
      throw new Error("No videos provided for merging");
    }
    if (videoUrls.length === 1) {
      console.log(`[mergeVideosWithFilterComplexLocal] Only 1 video, returning original URL`);
      return videoUrls[0];
    }
    const tempDir = path.join("/tmp", `ffmpeg_merge_${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    console.log(`[mergeVideosWithFilterComplexLocal] Created temp directory: ${tempDir}`);
    try {
      const localPaths = [];
      for (let i = 0; i < videoUrls.length; i++) {
        const url = videoUrls[i];
        const localPath = path.join(tempDir, `input_${i}.mp4`);
        console.log(`[mergeVideosWithFilterComplexLocal] Downloading ${i + 1}/${videoUrls.length}: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download video ${i}: ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.promises.writeFile(localPath, buffer);
        console.log(`[mergeVideosWithFilterComplexLocal] \u2705 Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB to ${localPath}`);
        localPaths.push(localPath);
      }
      const outputPath = path.join(tempDir, "output.mp4");
      const inputArgs = localPaths.map((p) => `-i "${p}"`).join(" ");
      const inputStreams = localPaths.map((_, i) => `[${i}:v][${i}:a]`).join("");
      const filterComplex = useLoudnorm ? `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a0];[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]` : `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a]`;
      const outputOptions = [
        '-map "[v]"',
        '-map "[a]"',
        "-fflags +genpts",
        "-c:v libx264",
        "-preset ultrafast",
        // Fastest encoding, minimal CPU
        "-crf 23",
        // Slightly lower quality but faster
        "-pix_fmt yuv420p",
        "-c:a aac",
        "-ar 48000",
        "-ac 1",
        "-b:a 128k",
        "-shortest",
        "-y"
      ].join(" ");
      const ffmpegCommand = `ffmpeg ${inputArgs} -filter_complex "${filterComplex}" ${outputOptions} "${outputPath}"`;
      console.log(`
========================================`);
      console.log(`[mergeVideosWithFilterComplexLocal] \u{1F3AC} FFmpeg Command:`);
      console.log(`========================================`);
      console.log(ffmpegCommand);
      console.log(`========================================
`);
      console.log(`[mergeVideosWithFilterComplexLocal] Executing FFmpeg...`);
      const startTime = Date.now();
      try {
        const { stdout, stderr } = await exec(ffmpegCommand, {
          maxBuffer: 50 * 1024 * 1024
        });
        const duration = ((Date.now() - startTime) / 1e3).toFixed(2);
        console.log(`[mergeVideosWithFilterComplexLocal] \u2705 FFmpeg completed in ${duration}s`);
        if (stderr) {
          const lines = stderr.split("\n").slice(-50);
          console.log(`[mergeVideosWithFilterComplexLocal] FFmpeg stderr (last 50 lines):`);
          lines.forEach((line) => console.log(`  ${line}`));
        }
      } catch (execError) {
        console.error(`[mergeVideosWithFilterComplexLocal] \u274C FFmpeg failed:`, execError.message);
        if (execError.stderr) {
          console.error(`[mergeVideosWithFilterComplexLocal] \u274C FFmpeg stderr:`, execError.stderr);
        }
        throw new Error(`FFmpeg execution failed: ${execError.message}`);
      }
      let stats;
      try {
        stats = await fs.promises.stat(outputPath);
        console.log(`[mergeVideosWithFilterComplexLocal] \u2705 Output file created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (statError) {
        console.error(`[mergeVideosWithFilterComplexLocal] \u274C Output file NOT created: ${outputPath}`);
        const tempFiles = await fs.promises.readdir(tempDir);
        console.error(`[mergeVideosWithFilterComplexLocal] \u{1F4C1} Temp dir contents:`, tempFiles);
        throw new Error(`FFmpeg did not create output file`);
      }
      const videoBuffer = await fs.promises.readFile(outputPath);
      const BUNNYCDN_STORAGE_PASSWORD2 = "4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b";
      const BUNNYCDN_STORAGE_ZONE2 = "manus-storage";
      const BUNNYCDN_PULL_ZONE_URL2 = "https://manus.b-cdn.net";
      const timestamp2 = Date.now();
      const bunnyFileName = `${outputVideoName}_${timestamp2}.mp4`;
      console.log(`[mergeVideosWithFilterComplexLocal] \u{1F550} Added timestamp to filename: ${bunnyFileName}`);
      const mergedPath = userId ? `user-${userId}/videos/${folder}/${bunnyFileName}` : `videos/${folder}/${bunnyFileName}`;
      const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${mergedPath}`;
      console.log(`[mergeVideosWithFilterComplexLocal] Uploading to Bunny CDN: ${mergedPath}`);
      try {
        const folderPath = userId ? `user-${userId}/videos/${folder}` : `videos/${folder}`;
        const listUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${folderPath}/`;
        console.log(`[mergeVideosWithFilterComplexLocal] \u{1F5D1}\uFE0F Checking for old videos to delete in: ${folderPath}`);
        const listResponse = await fetch(listUrl, {
          method: "GET",
          headers: {
            "AccessKey": BUNNYCDN_STORAGE_PASSWORD2
          }
        });
        if (listResponse.ok) {
          const files = await listResponse.json();
          const baseNameWithoutTimestamp = outputVideoName.replace(/_\d+$/, "");
          for (const file of files) {
            if (file.ObjectName && file.ObjectName.startsWith(baseNameWithoutTimestamp) && file.ObjectName !== bunnyFileName) {
              const oldFilePath = `${folderPath}/${file.ObjectName}`;
              const deleteUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${oldFilePath}`;
              console.log(`[mergeVideosWithFilterComplexLocal] \u{1F5D1}\uFE0F Deleting old video: ${file.ObjectName}`);
              const deleteResponse = await fetch(deleteUrl, {
                method: "DELETE",
                headers: {
                  "AccessKey": BUNNYCDN_STORAGE_PASSWORD2
                }
              });
              if (deleteResponse.ok || deleteResponse.status === 404) {
                console.log(`[mergeVideosWithFilterComplexLocal] \u2705 Deleted: ${file.ObjectName}`);
              } else {
                console.warn(`[mergeVideosWithFilterComplexLocal] \u26A0\uFE0F Failed to delete ${file.ObjectName}: ${deleteResponse.status}`);
              }
            }
          }
        }
      } catch (cleanupError) {
        console.warn(`[mergeVideosWithFilterComplexLocal] \u26A0\uFE0F Cleanup failed (non-fatal):`, cleanupError);
      }
      const uploadResponse = await fetch(storageUrl, {
        method: "PUT",
        headers: {
          "AccessKey": BUNNYCDN_STORAGE_PASSWORD2,
          "Content-Type": "video/mp4"
        },
        body: videoBuffer
      });
      if (!uploadResponse.ok) {
        throw new Error(`BunnyCDN upload failed: ${uploadResponse.statusText}`);
      }
      const publicUrl = `${BUNNYCDN_PULL_ZONE_URL2}/${mergedPath}`;
      console.log(`[mergeVideosWithFilterComplexLocal] \u2705 Upload successful: ${publicUrl}`);
      return publicUrl;
    } finally {
      try {
        console.log(`[mergeVideosWithFilterComplexLocal] Cleaning up temp directory: ${tempDir}`);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log(`[mergeVideosWithFilterComplexLocal] \u2705 Cleanup complete`);
      } catch (cleanupError) {
        console.warn(`[mergeVideosWithFilterComplexLocal] \u26A0\uFE0F Cleanup failed (non-fatal):`, cleanupError);
      }
    }
  } catch (error) {
    console.error("[mergeVideosWithFilterComplexLocal] \u274C Error:", error);
    console.error("[mergeVideosWithFilterComplexLocal] \u274C Stack:", error.stack);
    throw error;
  }
}
var exec, getOpenAIClient, OVERLAY_ENABLED, FFMPEG_API_BASE, BUNNYCDN_STORAGE_PASSWORD, BUNNYCDN_STORAGE_ZONE, BUNNYCDN_PULL_ZONE_URL;
var init_videoEditing = __esm({
  "server/videoEditing.ts"() {
    "use strict";
    exec = promisify(execCallback);
    getOpenAIClient = (userApiKey) => {
      const apiKey = userApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key is not configured. Please add it in Settings.");
      }
      console.log("[OpenAI] Using API key:", apiKey.substring(0, 20) + "...", userApiKey ? "(from user settings)" : "(from ENV)");
      return new OpenAI({
        apiKey,
        baseURL: "https://api.openai.com/v1"
      });
    };
    OVERLAY_ENABLED = false;
    FFMPEG_API_BASE = "https://api.ffmpeg-api.com";
    BUNNYCDN_STORAGE_PASSWORD = "4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b";
    BUNNYCDN_STORAGE_ZONE = "manus-storage";
    BUNNYCDN_PULL_ZONE_URL = "https://manus.b-cdn.net";
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var appUsers = mysqlTable("app_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  password: text("password").notNull(),
  // Plain text per requirement (no hashing)
  profileImageUrl: text("profileImageUrl"),
  // BunnyCDN URL for profile image
  kieApiKey: text("kieApiKey"),
  // Kling AI API key per user
  openaiApiKey: text("openaiApiKey"),
  // OpenAI API key per user
  ffmpegApiKey: text("ffmpegApiKey"),
  // FFMPEG API key per user
  cleanvoiceApiKey: text("cleanvoiceApiKey"),
  // CleanVoice API key per user
  ffmpegBatchSize: int("ffmpegBatchSize").default(15).notNull(),
  // FFmpeg batch size for processing (default: 15)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var appSessions = mysqlTable("app_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  name: text("name").notNull(),
  // Session name with timestamp (ex: "Campanie Black Friday - 14 Nov 2025 14:45")
  data: text("data").notNull(),
  // JSON string containing all session data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var userImages = mysqlTable("user_images", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  characterName: varchar("characterName", { length: 100 }).notNull().default("Unnamed"),
  // Character/avatar name (e.g., "Alina", "Unnamed")
  imageName: varchar("imageName", { length: 255 }).notNull(),
  // User-defined image name (editable)
  imageUrl: text("imageUrl").notNull(),
  // S3/BunnyCDN public URL
  imageKey: text("imageKey").notNull(),
  // S3 key for deletion
  displayOrder: int("displayOrder").default(0).notNull(),
  // Order for display within character (0 = newest/default)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var userPrompts = mysqlTable("user_prompts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  promptName: varchar("promptName", { length: 100 }).notNull(),
  // Prompt name (e.g., "PROMPT_NEUTRAL", "My Custom Prompt")
  promptTemplate: text("promptTemplate").notNull(),
  // Prompt template text
  isDefault: int("isDefault").notNull().default(0),
  // 1 for default prompts (cannot be deleted), 0 for custom
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var tams = mysqlTable("tams", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  name: varchar("name", { length: 255 }).notNull(),
  // TAM name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var coreBeliefs = mysqlTable("core_beliefs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  tamId: int("tamId").notNull(),
  // Foreign key to tams.id
  name: varchar("name", { length: 255 }).notNull(),
  // Core belief name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var emotionalAngles = mysqlTable("emotional_angles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  coreBeliefId: int("coreBeliefId").notNull(),
  // Foreign key to core_beliefs.id
  name: varchar("name", { length: 255 }).notNull(),
  // Emotional angle name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  emotionalAngleId: int("emotionalAngleId").notNull(),
  // Foreign key to emotional_angles.id
  name: varchar("name", { length: 255 }).notNull(),
  // Ad name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var characters = mysqlTable("characters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to app_users.id
  name: varchar("name", { length: 255 }).notNull(),
  // Character name
  thumbnailUrl: text("thumbnailUrl"),
  // Thumbnail image URL (auto-cropped from first image)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var contextSessions = mysqlTable("context_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tamId: int("tamId"),
  // Nullable - may not be set initially
  coreBeliefId: int("coreBeliefId").notNull(),
  emotionalAngleId: int("emotionalAngleId").notNull(),
  adId: int("adId").notNull(),
  characterId: int("characterId").notNull(),
  // Workflow data stored as JSON
  currentStep: int("currentStep").default(1).notNull(),
  rawTextAd: text("rawTextAd"),
  processedTextAd: text("processedTextAd"),
  adLines: json("adLines"),
  // Array of ad lines
  prompts: json("prompts"),
  // Array of prompts
  images: json("images"),
  // Array of images
  combinations: json("combinations"),
  // Array of combinations
  deletedCombinations: json("deletedCombinations"),
  // Array of deleted combinations
  videoResults: json("videoResults"),
  // Array of video results
  reviewHistory: json("reviewHistory"),
  // Array of review history
  hookMergedVideos: json("hookMergedVideos"),
  // Object: { baseName: cdnUrl }
  bodyMergedVideoUrl: text("bodyMergedVideoUrl"),
  // CDN URL for merged body video
  finalVideos: json("finalVideos"),
  // Array of final merged videos (hook + body combinations)
  sampleMergedVideoUrl: text("sampleMergedVideoUrl"),
  // CDN URL for sample merged video (from "Sample Merge All Videos" button)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      await runAutoMigrations(_db);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function runAutoMigrations(db) {
  try {
    console.log("[Database] Running auto-migrations...");
    try {
      const checkResult = await db.execute(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'app_users' 
        AND COLUMN_NAME = 'ffmpegBatchSize'
      `);
      const columnExists = checkResult[0]?.[0]?.count > 0;
      if (!columnExists) {
        await db.execute(`
          ALTER TABLE app_users 
          ADD COLUMN ffmpegBatchSize INT NOT NULL DEFAULT 15
        `);
        console.log("[Database] \u2705 Migration: ffmpegBatchSize column added");
      } else {
        console.log("[Database] \u2705 Migration: ffmpegBatchSize column already exists");
      }
    } catch (error) {
      if (error.message?.includes("Duplicate column")) {
        console.log("[Database] \u2705 Migration: ffmpegBatchSize column already exists");
      } else {
        console.error("[Database] \u26A0\uFE0F Migration failed (ffmpegBatchSize):", error.message);
      }
    }
    console.log("[Database] \u2705 All auto-migrations completed");
  } catch (error) {
    console.error("[Database] \u274C Auto-migrations failed:", error);
  }
}
async function upsertUser(user2) {
  if (!user2.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user2.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user2[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user2.lastSignedIn !== void 0) {
      values.lastSignedIn = user2.lastSignedIn;
      updateSet.lastSignedIn = user2.lastSignedIn;
    }
    if (user2.role !== void 0) {
      values.role = user2.role;
      updateSet.role = user2.role;
    } else if (user2.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createAppUser(user2) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    const result = await db.insert(appUsers).values(user2);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create app user:", error);
    throw error;
  }
}
async function getAppUserByUsername(username) {
  const db = await getDb();
  if (!db) {
    return void 0;
  }
  const result = await db.select().from(appUsers).where(eq(appUsers.username, username)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getAppUserById(id) {
  const db = await getDb();
  if (!db) {
    return void 0;
  }
  const result = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateAppUser(id, data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    await db.update(appUsers).set(data).where(eq(appUsers.id, id));
  } catch (error) {
    console.error("[Database] Failed to update app user:", error);
    throw error;
  }
}
async function createAppSession(session) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    const result = await db.insert(appSessions).values(session);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create app session:", error);
    throw error;
  }
}
async function getAppSessionsByUserId(userId) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const result = await db.select().from(appSessions).where(eq(appSessions.userId, userId));
  return result;
}
async function updateAppSession(id, data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    await db.update(appSessions).set(data).where(eq(appSessions.id, id));
  } catch (error) {
    console.error("[Database] Failed to update app session:", error);
    throw error;
  }
}
async function deleteAppSession(id) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    await db.delete(appSessions).where(eq(appSessions.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete app session:", error);
    throw error;
  }
}
async function createUserImage(image) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    const result = await db.insert(userImages).values(image);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create user image:", error);
    throw error;
  }
}
async function getUserImagesByUserId(userId) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const result = await db.select().from(userImages).where(eq(userImages.userId, userId)).orderBy(userImages.displayOrder, userImages.id);
  return result;
}
async function getUserImagesByCharacter(userId, characterName) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const result = await db.select().from(userImages).where(and(
    eq(userImages.userId, userId),
    eq(userImages.characterName, characterName)
  )).orderBy(userImages.displayOrder, userImages.id);
  return result;
}
async function updateUserImage(id, data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    console.log(`[Database] \u{1F504} Updating user image ${id} with data:`, data);
    const result = await db.update(userImages).set(data).where(eq(userImages.id, id));
    console.log(`[Database] \u2705 User image ${id} updated successfully`);
    return result;
  } catch (error) {
    console.error("[Database] \u274C Failed to update user image:", error);
    throw error;
  }
}
async function deleteUserImage(id) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    await db.delete(userImages).where(eq(userImages.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete user image:", error);
    throw error;
  }
}
async function getUniqueCharacterNames(userId) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const categoryChars = await db.select({ name: characters.name }).from(characters).where(eq(characters.userId, userId));
  const imageChars = await db.select({ characterName: userImages.characterName }).from(userImages).where(eq(userImages.userId, userId)).groupBy(userImages.characterName);
  const categoryCharNames = categoryChars.map((c) => c.name).filter((name) => name != null && name.trim() !== "");
  const imageCharNames = imageChars.map((r) => r.characterName).filter((name) => name != null && name.trim() !== "");
  const allCharNames = [.../* @__PURE__ */ new Set([...categoryCharNames, ...imageCharNames])];
  return allCharNames;
}
async function createUserPrompt(prompt) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    const result = await db.insert(userPrompts).values(prompt);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create user prompt:", error);
    throw error;
  }
}
async function getUserPromptsByUserId(userId) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const result = await db.select().from(userPrompts).where(eq(userPrompts.userId, userId));
  return result;
}
async function getUserPromptById(id) {
  const db = await getDb();
  if (!db) {
    return void 0;
  }
  const result = await db.select().from(userPrompts).where(eq(userPrompts.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateUserPrompt(id, data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    await db.update(userPrompts).set(data).where(eq(userPrompts.id, id));
  } catch (error) {
    console.error("[Database] Failed to update user prompt:", error);
    throw error;
  }
}
async function deleteUserPrompt(id) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  try {
    await db.delete(userPrompts).where(eq(userPrompts.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete user prompt:", error);
    throw error;
  }
}
async function createTam(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tams).values(data);
  return result;
}
async function getTamsByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tams).where(eq(tams.userId, userId));
}
async function updateTam(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tams).set(data).where(eq(tams.id, id));
}
async function deleteTam(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tams).where(eq(tams.id, id));
}
async function createCoreBelief(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(coreBeliefs).values(data);
  return result;
}
async function getCoreBeliefsByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(coreBeliefs).where(eq(coreBeliefs.userId, userId));
}
async function getCoreBeliefsByTamId(tamId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(coreBeliefs).where(eq(coreBeliefs.tamId, tamId));
}
async function updateCoreBelief(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(coreBeliefs).set(data).where(eq(coreBeliefs.id, id));
}
async function deleteCoreBelief(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(coreBeliefs).where(eq(coreBeliefs.id, id));
}
async function createEmotionalAngle(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(emotionalAngles).values(data);
  return result;
}
async function getEmotionalAnglesByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emotionalAngles).where(eq(emotionalAngles.userId, userId));
}
async function getEmotionalAnglesByCoreBeliefId(coreBeliefId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emotionalAngles).where(eq(emotionalAngles.coreBeliefId, coreBeliefId));
}
async function updateEmotionalAngle(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(emotionalAngles).set(data).where(eq(emotionalAngles.id, id));
}
async function deleteEmotionalAngle(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(emotionalAngles).where(eq(emotionalAngles.id, id));
}
async function createAd(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ads).values(data);
  return result;
}
async function getAdsByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ads).where(eq(ads.userId, userId));
}
async function getAdsByEmotionalAngleId(emotionalAngleId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ads).where(eq(ads.emotionalAngleId, emotionalAngleId));
}
async function updateAd(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(ads).set(data).where(eq(ads.id, id));
}
async function deleteAd(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(ads).where(eq(ads.id, id));
}
async function createCharacter(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(characters).values(data);
  const insertId = result[0].insertId;
  const created = await db.select().from(characters).where(eq(characters.id, insertId));
  return created[0];
}
async function getCharactersByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(characters).where(eq(characters.userId, userId));
}
async function updateCharacter(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(characters).set(data).where(eq(characters.id, id));
}
async function deleteCharacter(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(characters).where(eq(characters.id, id));
}
async function getContextSession(params) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [
    eq(contextSessions.userId, params.userId),
    eq(contextSessions.coreBeliefId, params.coreBeliefId),
    eq(contextSessions.emotionalAngleId, params.emotionalAngleId),
    eq(contextSessions.adId, params.adId),
    eq(contextSessions.characterId, params.characterId)
  ];
  if (params.tamId !== void 0 && params.tamId !== null) {
    conditions.push(eq(contextSessions.tamId, params.tamId));
  }
  const result = await db.select().from(contextSessions).where(and(...conditions)).limit(1);
  return result[0] || null;
}
async function upsertContextSession(session) {
  const db = await getDb();
  if (!db) return null;
  if (session.videoResults) {
    const videosWithOverlay = session.videoResults.filter((v) => v.overlaySettings);
    console.log("[DB] \u{1F4BE} upsertContextSession - Videos with overlay settings:", videosWithOverlay.length);
    videosWithOverlay.forEach((v) => {
      console.log(`[DB] \u{1F4DD} ${v.videoName}:`, v.overlaySettings);
    });
  }
  const existing = await getContextSession({
    userId: session.userId,
    tamId: session.tamId,
    // Include tamId for unique identification
    coreBeliefId: session.coreBeliefId,
    emotionalAngleId: session.emotionalAngleId,
    adId: session.adId,
    characterId: session.characterId
  });
  if (existing) {
    await db.update(contextSessions).set(session).where(eq(contextSessions.id, existing.id));
    console.log("[DB] \u2705 Updated existing session ID:", existing.id);
    return { ...existing, ...session };
  } else {
    const result = await db.insert(contextSessions).values(session);
    console.log("[DB] \u2705 Inserted new session ID:", result.insertId);
    return { id: Number(result.insertId), ...session };
  }
}
async function deleteContextSession(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(contextSessions).where(eq(contextSessions.id, id));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user2 = await getUserByOpenId(sessionUserId);
    if (!user2) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user2 = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user2) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user2.openId,
      lastSignedIn: signedInAt
    });
    return user2;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/hardcodedPrompts.ts
var HARDCODED_PROMPTS = {
  PROMPT_NEUTRAL: {
    name: "PROMPT_NEUTRAL",
    fileName: "prompt1_veo_neutralface.docx",
    content: `SUBJECT \u2014 Minimal makeup, natural skin texture visible.

ACTION AND CAMERA MOTION \u2014 The woman blinks naturally, subtly moves her eyebrows, and her lips move perfectly syncing with the Romanian dialogue. Micro head nods and slight posture shifts. 

AUDIO \u2014 Female voice in Romanian, warm tone, age 40s, slightly introspective, clear and natural speech with realistic pauses and mouth shape syncing. Dialogue: "[INSERT TEXT]"

STYLE \u2014 Smooth, precise lip-sync. No smiling, no dramatic gestures, just natural blinking, head nods, and small posture adjustments. 

Facial expression modifiers:Minimal facial expression, neutral face, subtle emotional tone, avoid exaggerated eyebrow or mouth movement, without theatrical or over-acted emotion, controlled micro-expressions only, keep expression calm and introspective, understated emotion, realistic tone, speak naturally, not like a presenter or actor

Lip-sync and speech modifiers:Subtle lip sync only, minimal mouth movement, avoid over-articulated or exaggerated mouth shapes, speech motion should be soft and natural, not over-enunciated, reduce lip-sync exaggeration, focus on authenticity, mouth motion synced but minimal, no overpronunciation or acting emphasis, clear and natural speech with realistic pauses

Gesture and head/body movement modifiers:Very limited gestures, no hand waving, no strong head movements, keep posture steady with only tiny natural shifts, minimal head motion, small micro tilts only, avoid nodding repeatedly, subtle restrained body language, no exaggerated body gestures or hand movement, keep the camera stable, no rhythmic head motion

Overall natural realism style:Authentic iPhone-style realism, behaves like a real person speaking casually, realistic breathing pauses, no acting performance energy, quiet introspective tone, natural tempo and rhythm of real conversation, avoid scripted or formal tone, expression should feel natural grounded and introspective like a real person speaking softly to herself, no acting no performative delivery no reporter tone

Post-speech behavior modifiers:After finishing the dialogue, she keeps looking at the camera naturally, holding eye contact for a few seconds, calm and still, no smile, no movement, just natural breathing and subtle blinking, maintaining emotional continuity, gaze remains steady and present, do not cut or fade immediately after speaking, keep the shot running for a few seconds of quiet presence

High quality, realistic rendering in 4K.

No subtitles. No music.

No smiling. Facial expression shows mild frustration progressing into calm reflection without smiling.`
  },
  PROMPT_SMILING: {
    name: "PROMPT_SMILING",
    fileName: "prompt2_veo_smilingface.docx",
    content: `SUBJECT \u2014 Minimal makeup, natural skin texture visible.

ACTION AND CAMERA MOTION \u2014 The woman blinks naturally, subtly moves her eyebrows, and her lips move perfectly syncing with the Romanian dialogue. Micro head nods and slight posture shifts. 

AUDIO \u2014 Female voice in Romanian, warm tone, age 40s, slightly introspective, clear and natural speech with realistic pauses and mouth shape syncing. Dialogue: "[INSERT TEXT]"

STYLE \u2014 Smooth, precise lip-sync. Smiling, no dramatic gestures, just natural blinking, head nods, and small posture adjustments. 

Facial expression modifiers:Minimal facial expression, smiling, subtle emotional tone, avoid exaggerated eyebrow or mouth movement, without theatrical or over-acted emotion, controlled micro-expressions only, keep expression calm and introspective, understated emotion, realistic tone, speak naturally, not like a presenter or actor

Lip-sync and speech modifiers:Subtle lip sync only, minimal mouth movement, avoid over-articulated or exaggerated mouth shapes, speech motion should be soft and natural, not over-enunciated, reduce lip-sync exaggeration, focus on authenticity, mouth motion synced but minimal, no overpronunciation or acting emphasis, clear and natural speech with realistic pauses

Gesture and head/body movement modifiers:Very limited gestures, no hand waving, no strong head movements, keep posture steady with only tiny natural shifts, minimal head motion, small micro tilts only, avoid nodding repeatedly, subtle restrained body language, no exaggerated body gestures or hand movement, keep the camera stable, no rhythmic head motion

Overall natural realism style:Authentic iPhone-style realism, behaves like a real person speaking casually, realistic breathing pauses, no acting performance energy, quiet introspective tone, natural tempo and rhythm of real conversation, avoid scripted or formal tone, expression should feel natural grounded and introspective like a real person speaking softly to herself, no acting no performative delivery no reporter tone

Post-speech behavior modifiers:After finishing the dialogue, she keeps looking at the camera naturally, holding eye contact for a few seconds, calm and still, no smile, no movement, just natural breathing and subtle blinking, maintaining emotional continuity, gaze remains steady and present, do not cut or fade immediately after speaking, keep the shot running for a few seconds of quiet presence

High quality, realistic rendering in 4K.

No subtitles. No music.

Smiling.`
  },
  PROMPT_CTA: {
    name: "PROMPT_CTA",
    fileName: "prompt2_veo_smiling_cta.docx",
    content: `SUBJECT \u2014 Minimal makeup, natural skin texture visible.

ACTION AND CAMERA MOTION \u2014 The woman blinks naturally, subtly moves her eyebrows, and her lips move perfectly syncing with the Romanian dialogue. Micro head nods and slight posture shifts. 

AUDIO \u2014 Female voice in Romanian, warm tone, age 40s, slightly introspective, clear and natural speech with realistic pauses and mouth shape syncing. Dialogue: "[INSERT TEXT]"

STYLE \u2014 Smooth, precise lip-sync. Smiling, no dramatic gestures, just natural blinking, head nods, and small posture adjustments. 

Facial expression modifiers:Minimal facial expression, smiling, subtle emotional tone, avoid exaggerated eyebrow or mouth movement, without theatrical or over-acted emotion, controlled micro-expressions only, keep expression calm and introspective, understated emotion, realistic tone, speak naturally, not like a presenter or actor

Lip-sync and speech modifiers:Subtle lip sync only, minimal mouth movement, avoid over-articulated or exaggerated mouth shapes, speech motion should be soft and natural, not over-enunciated, reduce lip-sync exaggeration, focus on authenticity, mouth motion synced but minimal, no overpronunciation or acting emphasis, clear and natural speech with realistic pauses

Gesture and head/body movement modifiers:Very limited gestures, no hand waving, no strong head movements, keep posture steady with only tiny natural shifts, minimal head motion, small micro tilts only, avoid nodding repeatedly, subtle restrained body language, no exaggerated body gestures or hand movement, keep the camera stable, no rhythmic head motion

Overall natural realism style:Authentic iPhone-style realism, behaves like a real person speaking casually, realistic breathing pauses, no acting performance energy, quiet introspective tone, natural tempo and rhythm of real conversation, avoid scripted or formal tone, expression should feel natural grounded and introspective like a real person speaking softly to herself, no acting no performative delivery no reporter tone

Post-speech behavior modifiers:After finishing the dialogue, she keeps looking at the camera naturally, holding eye contact for a few seconds, calm and still, no smile, no movement, just natural breathing and subtle blinking, maintaining emotional continuity, gaze remains steady and present, do not cut or fade immediately after speaking, keep the shot running for a few seconds of quiet presence

High quality, realistic rendering in 4K.

No subtitles. No music.

Smiling. 

Make sure the book stays visible on screen throughout the entire video, clearly held in her hands the whole time.`
  }
};

// server/routers.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { exec as exec2 } from "child_process";
import { promisify as promisify2 } from "util";

// server/videoCache.ts
var videoCache = /* @__PURE__ */ new Map();
function saveVideoTask(taskId, prompt, imageUrl) {
  videoCache.set(taskId, {
    taskId,
    prompt,
    imageUrl,
    status: "pending",
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  });
}
function updateVideoTask(taskId, updates) {
  const task = videoCache.get(taskId);
  if (task) {
    videoCache.set(taskId, {
      ...task,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    });
  }
}

// server/routers.ts
init_videoEditing();
init_storageHelpers();

// server/documentParser.ts
import mammoth from "mammoth";
var KEYWORDS_TO_REMOVE = [
  "HOOKS:",
  "MIRROR:",
  "DCS:",
  "TRANSITION:",
  "TRANZITION:",
  // Typo variation
  "TRANZITIE:",
  // Romanian variation
  "NEW_CAUSE:",
  "MECHANISM:",
  "EMOTIONAL_PROOF:",
  "TRANSFORMATION:",
  "CTA:"
];
function isCategoryHeader(line) {
  const upperLine = line.toUpperCase().trim();
  if (/^H\d+:?/.test(upperLine)) {
    return true;
  }
  if (/(MIRROR|DCS|TRANZITION|TRANZITIE|TRANSITION|NEW_CAUSE|MECHANISM|EMOTIONAL_PROOF|TRANSFORMATION|CTA)\d+:?/.test(upperLine)) {
    return true;
  }
  return false;
}
async function parsePromptDocument(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const promptTemplate = result.value;
    if (!promptTemplate.includes("[INSERT TEXT]")) {
      throw new Error("Prompt document does not contain [INSERT TEXT] placeholder");
    }
    return promptTemplate;
  } catch (error) {
    console.error("Error parsing prompt document:", error);
    throw new Error(`Failed to parse prompt document: ${error.message}`);
  }
}
function replaceInsertText(promptTemplate, text2) {
  return promptTemplate.replace("[INSERT TEXT]", text2);
}
function detectSection(line, allLines, lineIndex) {
  const upperLine = line.toUpperCase();
  if (upperLine.includes("CARTE") || upperLine.includes("CARTEA")) {
    return "CTA";
  }
  for (let i = lineIndex; i >= 0; i--) {
    const prevLine = allLines[i].toUpperCase().trim();
    if (prevLine.startsWith("CTA")) return "CTA";
    if (prevLine.startsWith("TRANSFORMATION")) return "TRANSFORMATION";
    if (prevLine.startsWith("EMOTIONAL_PROOF")) return "EMOTIONAL_PROOF";
    if (prevLine.startsWith("MECHANISM")) return "MECHANISM";
    if (prevLine.startsWith("NEW_CAUSE")) return "NEW_CAUSE";
    if (prevLine.startsWith("TRANZITION") || prevLine.startsWith("TRANZITIE") || prevLine.startsWith("TRANSITION")) return "TRANSITION";
    if (prevLine.startsWith("DCS")) return "DCS";
    if (prevLine.startsWith("MIRROR")) return "MIRROR";
    if (prevLine.startsWith("HOOKS") || prevLine.startsWith("H1") || prevLine.startsWith("H2") || prevLine.startsWith("H3")) return "HOOKS";
  }
  return "OTHER";
}
function getPromptForSection(section, text2) {
  if (text2) {
    const lowerText = text2.toLowerCase();
    const ctaKeywords = ["carte", "cartea", "rescrie", "lacrimi"];
    if (ctaKeywords.some((keyword) => lowerText.includes(keyword))) {
      return "PROMPT_CTA";
    }
  }
  switch (section) {
    case "TRANSFORMATION":
    case "CTA":
      return "PROMPT_SMILING";
    default:
      return "PROMPT_NEUTRAL";
  }
}
function extractCategoryNumber(line) {
  const upperLine = line.toUpperCase().trim();
  const hookMatch = upperLine.match(/^H(\d+)/);
  if (hookMatch) {
    return parseInt(hookMatch[1], 10);
  }
  const categoryMatch = upperLine.match(/(MIRROR|DCS|TRANZITION|TRANZITIE|TRANSITION|NEW_CAUSE|MECHANISM|EMOTIONAL_PROOF|TRANSFORMATION|CTA)(\d+)/);
  if (categoryMatch) {
    return parseInt(categoryMatch[2], 10);
  }
  return null;
}
function generateVideoName(section, categoryNumber, lineIndexInCategory = 0) {
  const prefix = "CB1_A1";
  const categoryName = section === "HOOKS" ? "HOOK" : section;
  const suffix = lineIndexInCategory > 0 ? String.fromCharCode(65 + lineIndexInCategory) : "";
  return `${prefix}_${categoryName}${categoryNumber}${suffix}`;
}
async function parseAdDocumentWithSections(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text2 = result.value;
    const lines = text2.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    const allLines = [...lines];
    const processedLines = [];
    let currentCategoryNumber = 1;
    let currentSection = null;
    let lineIndexInCategory = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const categoryNumber = extractCategoryNumber(line);
      if (categoryNumber !== null) {
        currentCategoryNumber = categoryNumber;
        currentSection = null;
        lineIndexInCategory = 0;
        continue;
      }
      const isKeyword = KEYWORDS_TO_REMOVE.some(
        (keyword) => line.toUpperCase().startsWith(keyword.toUpperCase())
      );
      if (isKeyword || isCategoryHeader(line)) {
        continue;
      }
      let cleanedLine = line.replace(/\s*-\s*\d+\s*chars?\s*$/i, "").trim();
      if (cleanedLine.length > 0) {
        const section = detectSection(cleanedLine, allLines, i);
        const promptType = getPromptForSection(section, cleanedLine);
        if (currentSection !== section) {
          currentSection = section;
          lineIndexInCategory = 0;
        }
        const videoName = generateVideoName(section, currentCategoryNumber, lineIndexInCategory);
        processedLines.push({
          text: cleanedLine,
          section,
          promptType,
          videoName,
          categoryNumber: currentCategoryNumber
        });
        lineIndexInCategory++;
      }
    }
    return processedLines;
  } catch (error) {
    console.error("Error parsing ad document with sections:", error);
    throw new Error(`Failed to parse ad document: ${error.message}`);
  }
}

// server/text-processor.ts
var CATEGORY_NAMES = [
  "HOOKS",
  "MIRROR",
  "DCS",
  "TRANZITION",
  "TRANSITION",
  // English variant of TRANZITION
  "NEW CAUSE",
  // Also matches NEW-CAUSE
  "NEW-CAUSE",
  "MECHANISM",
  "EMOTIONAL PROOF",
  // Also matches EMOTIONAL-PROOF
  "EMOTIONAL-PROOF",
  "TRANSFORMATION",
  "CTA"
];
function findCategories(text2) {
  const found = [];
  for (const catName of CATEGORY_NAMES) {
    const pattern = new RegExp(`\\b(${catName})(\\d{1,3})?:?(?=\\s|[A-Z]|$)`, "gi");
    let match;
    while ((match = pattern.exec(text2)) !== null) {
      const fullMatch = match[0];
      const number = match[2];
      if (number) {
        const num = parseInt(number);
        if (num < 1 || num > 100) {
          continue;
        }
      }
      const normalizedCategory = catName.toUpperCase().replace(/\s+/g, "-");
      found.push({
        category: normalizedCategory,
        position: match.index,
        fullMatch
      });
    }
  }
  const hPattern = /\b(H)(\d{1,3}):?(?=\s|[A-Z]|$)/gi;
  let hMatch;
  while ((hMatch = hPattern.exec(text2)) !== null) {
    const num = parseInt(hMatch[2]);
    if (num >= 1 && num <= 100) {
      found.push({
        category: "HOOKS",
        position: hMatch.index,
        fullMatch: `H${num}`
      });
    }
  }
  found.sort((a, b) => a.position - b.position);
  return found;
}
function splitIntoSections(text2) {
  const categories = findCategories(text2);
  const sections = [];
  for (let i = 0; i < categories.length; i++) {
    const current = categories[i];
    const next = categories[i + 1];
    const startPos = current.position + current.fullMatch.length;
    const endPos = next ? next.position : text2.length;
    let content = text2.substring(startPos, endPos).trim();
    content = content.replace(/^:\s*/, "");
    const isHSubcategory = current.fullMatch.match(/^H\d{1,3}$/i);
    sections.push({
      category: current.category,
      subcategory: isHSubcategory ? current.fullMatch.toUpperCase() : null,
      content
    });
  }
  return sections;
}
function splitIntoSentences(text2) {
  const sentences = [];
  let current = [];
  const words = text2.split(/\s+/);
  for (const word of words) {
    current.push(word);
    if (word.match(/[.!?]$/)) {
      sentences.push(current.join(" ").trim());
      current = [];
    }
  }
  if (current.length > 0) {
    sentences.push(current.join(" ").trim());
  }
  return sentences;
}
function processShortText(text2, minC = 118, maxC = 125) {
  const target = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  const needed = target - text2.length;
  if (needed <= 0) {
    return { text: text2, redStart: -1, redEnd: -1, charCount: text2.length };
  }
  const words = text2.split(/\s+/);
  const addedWords = [];
  for (let cycle = 0; cycle < 10; cycle++) {
    for (const word of words) {
      const testText = text2 + " " + [...addedWords, word].join(" ");
      const testLen = testText.length;
      if (testLen <= maxC) {
        addedWords.push(word);
        if (testLen >= minC && testLen >= target) {
          break;
        }
      } else {
        break;
      }
    }
    const currentLen = (text2 + " " + addedWords.join(" ")).length;
    if (currentLen >= minC) {
      break;
    }
  }
  let addedText = addedWords.join(" ");
  let fullText = text2 + " " + addedText;
  while (fullText.length > maxC && addedWords.length > 0) {
    addedWords.pop();
    addedText = addedWords.join(" ");
    fullText = text2 + " " + addedText;
  }
  const redStart = text2.length + 1;
  const redEnd = fullText.length;
  return { text: fullText, redStart, redEnd, charCount: fullText.length };
}
function processLongSentenceWithOverlap(text2, minC = 118, maxC = 125) {
  const results = [];
  const line1TargetLength = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  let line1Full = text2.substring(0, line1TargetLength).trim();
  if (line1Full.includes(" ")) {
    const words = line1Full.split(/\s+/);
    line1Full = words.join(" ");
  }
  const minPartLength = 40;
  let cutPoint = -1;
  const punctuationMarks = [", ", ": ", "; ", "! ", "? "];
  for (const mark of punctuationMarks) {
    const idx = line1Full.lastIndexOf(mark);
    const part1Length = idx + mark.length;
    const part2Length = text2.length - (idx + mark.length);
    if (idx > cutPoint && part1Length >= minPartLength && part2Length >= minPartLength) {
      cutPoint = idx + mark.length;
    }
  }
  if (cutPoint === -1) {
    const transitionWords = [" dar ", " \u0219i ", " iar ", " pentru ", " astfel ", " c\xE2nd ", " dac\u0103 ", " ca ", " c\u0103 ", " pot ", " pot fi "];
    for (const word of transitionWords) {
      const idx = line1Full.lastIndexOf(word);
      const part1Length = idx + word.length;
      const part2Length = text2.length - (idx + word.length);
      if (idx > cutPoint && part1Length >= minPartLength && part2Length >= minPartLength) {
        cutPoint = idx + word.length;
      }
    }
  }
  if (cutPoint === -1) {
    cutPoint = Math.floor(text2.length * 0.5);
    while (cutPoint < text2.length && text2[cutPoint] !== " ") {
      cutPoint++;
    }
    if (cutPoint < text2.length) cutPoint++;
  }
  const line1White = line1Full.substring(0, cutPoint).trim();
  const line1Red = line1Full.substring(cutPoint).trim();
  const line2White = text2.substring(cutPoint).trim();
  const line2TargetLength = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  const line2RedNeeded = line2TargetLength - line2White.length;
  let line2Red = "";
  if (line2RedNeeded > 0) {
    const startIdx = Math.max(0, line1White.length - line2RedNeeded);
    line2Red = line1White.substring(startIdx).trim();
  }
  const line1Final = line1White + (line1Red ? " " + line1Red : "");
  const line2Final = (line2Red ? line2Red + " " : "") + line2White;
  const line1RedStart = line1Red ? line1White.length + 1 : -1;
  const line1RedEnd = line1Red ? line1Final.length : -1;
  const line2RedStart = line2Red ? 0 : -1;
  const line2RedEnd = line2Red ? line2Red.length : -1;
  results.push({
    text: line1Final,
    redStart: line1RedStart,
    redEnd: line1RedEnd,
    charCount: line1Final.length
  });
  results.push({
    text: line2Final,
    redStart: line2RedStart,
    redEnd: line2RedEnd,
    charCount: line2Final.length
  });
  return results;
}
function processText(text2, minC = 118, maxC = 125) {
  text2 = text2.trim();
  if (!text2 || text2.length < 10) {
    return [];
  }
  const length = text2.length;
  if (length >= minC && length <= maxC) {
    return [{ text: text2, redStart: -1, redEnd: -1, charCount: length }];
  }
  if (length < minC) {
    return [processShortText(text2, minC, maxC)];
  }
  const sentences = splitIntoSentences(text2);
  if (sentences.length === 1) {
    return processLongSentenceWithOverlap(text2, minC, maxC);
  }
  const results = [];
  let i = 0;
  while (i < sentences.length) {
    if (i + 2 < sentences.length) {
      const combined3 = sentences.slice(i, i + 3).join(" ");
      if (combined3.length >= minC && combined3.length <= maxC) {
        results.push({ text: combined3, redStart: -1, redEnd: -1, charCount: combined3.length });
        i += 3;
        continue;
      } else if (combined3.length < minC) {
        results.push(processShortText(combined3, minC, maxC));
        i += 3;
        continue;
      }
    }
    if (i + 1 < sentences.length) {
      const combined2 = sentences.slice(i, i + 2).join(" ");
      if (combined2.length >= minC && combined2.length <= maxC) {
        results.push({ text: combined2, redStart: -1, redEnd: -1, charCount: combined2.length });
        i += 2;
        continue;
      } else if (combined2.length < minC) {
        results.push(processShortText(combined2, minC, maxC));
        i += 2;
        continue;
      }
    }
    results.push(...processText(sentences[i], minC, maxC));
    i++;
  }
  return results;
}
function processAdDocument(rawText) {
  let cleanedText = rawText.replace(/\[HEADER\][\s\S]*?\[\/HEADER\]/gi, "");
  const sections = splitIntoSections(cleanedText);
  const outputData = [];
  for (const section of sections) {
    const displayName = section.subcategory || section.category;
    outputData.push({
      type: "label",
      text: displayName,
      category: section.category,
      subcategory: section.subcategory,
      displayName
    });
    if (section.content) {
      const processedLines = processText(section.content);
      for (const line of processedLines) {
        outputData.push({
          type: "text",
          text: line.text,
          category: section.category,
          subcategory: section.subcategory,
          redStart: line.redStart,
          redEnd: line.redEnd,
          charCount: line.charCount
        });
      }
    }
  }
  return outputData;
}
function addRedOnLine1(data) {
  return data;
}

// server/routers.ts
import { eq as eq3, desc } from "drizzle-orm";

// server/seedDefaultPrompts.ts
import { drizzle as drizzle2 } from "drizzle-orm/mysql2";
import { eq as eq2, and as and2 } from "drizzle-orm";
async function seedDefaultPromptsForUser(userId) {
  if (!process.env.DATABASE_URL) {
    console.warn("[Seed] No DATABASE_URL, skipping default prompts seed");
    return;
  }
  const db = drizzle2(process.env.DATABASE_URL);
  try {
    const existingPrompts = await db.select().from(userPrompts).where(and2(eq2(userPrompts.userId, userId), eq2(userPrompts.isDefault, 1)));
    if (existingPrompts.length >= 3) {
      return;
    }
    const defaultPrompts = [
      {
        userId,
        promptName: "PROMPT_NEUTRAL",
        promptTemplate: HARDCODED_PROMPTS.PROMPT_NEUTRAL.content,
        isDefault: 1
      },
      {
        userId,
        promptName: "PROMPT_SMILING",
        promptTemplate: HARDCODED_PROMPTS.PROMPT_SMILING.content,
        isDefault: 1
      },
      {
        userId,
        promptName: "PROMPT_CTA",
        promptTemplate: HARDCODED_PROMPTS.PROMPT_CTA.content,
        isDefault: 1
      }
    ];
    for (const prompt of defaultPrompts) {
      const exists = existingPrompts.find((p) => p.promptName === prompt.promptName);
      if (!exists) {
        await db.insert(userPrompts).values(prompt);
        console.log(`[Seed] Created default prompt ${prompt.promptName} for user ${userId}`);
      }
    }
  } catch (error) {
    console.error("[Seed] Failed to seed default prompts:", error);
  }
}

// server/routers.ts
var execAsync = promisify2(exec2);
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  // App Auth router for simple username/password authentication
  appAuth: router({
    // Register new user
    register: publicProcedure.input(z2.object({
      username: z2.string().min(3).max(64),
      password: z2.string().min(1)
    })).mutation(async ({ input }) => {
      const existingUser = await getAppUserByUsername(input.username);
      if (existingUser) {
        throw new Error("Username already exists");
      }
      const result = await createAppUser({
        username: input.username,
        password: input.password
        // Plain text per requirement
      });
      const user2 = await getAppUserByUsername(input.username);
      if (!user2) {
        throw new Error("Failed to create user");
      }
      await seedDefaultPromptsForUser(user2.id);
      return {
        success: true,
        user: {
          id: user2.id,
          username: user2.username,
          profileImageUrl: user2.profileImageUrl
        }
      };
    }),
    // Login
    login: publicProcedure.input(z2.object({
      username: z2.string(),
      password: z2.string()
    })).mutation(async ({ input }) => {
      const user2 = await getAppUserByUsername(input.username);
      if (!user2 || user2.password !== input.password) {
        throw new Error("Invalid username or password");
      }
      await seedDefaultPromptsForUser(user2.id);
      return {
        success: true,
        user: {
          id: user2.id,
          username: user2.username,
          profileImageUrl: user2.profileImageUrl,
          kieApiKey: user2.kieApiKey,
          openaiApiKey: user2.openaiApiKey,
          ffmpegApiKey: user2.ffmpegApiKey,
          cleanvoiceApiKey: user2.cleanvoiceApiKey,
          ffmpegBatchSize: user2.ffmpegBatchSize
        }
      };
    }),
    // Get current user by ID
    getMe: publicProcedure.input(z2.object({
      userId: z2.number()
    })).query(async ({ input }) => {
      const user2 = await getAppUserById(input.userId);
      if (!user2) {
        return null;
      }
      return {
        id: user2.id,
        username: user2.username,
        profileImageUrl: user2.profileImageUrl,
        kieApiKey: user2.kieApiKey,
        openaiApiKey: user2.openaiApiKey,
        ffmpegApiKey: user2.ffmpegApiKey,
        cleanvoiceApiKey: user2.cleanvoiceApiKey,
        ffmpegBatchSize: user2.ffmpegBatchSize
      };
    }),
    // Update profile (password + profile image)
    updateProfile: publicProcedure.input(z2.object({
      userId: z2.number(),
      password: z2.string().optional(),
      profileImageUrl: z2.string().optional(),
      kieApiKey: z2.string().optional(),
      openaiApiKey: z2.string().optional(),
      ffmpegApiKey: z2.string().optional(),
      cleanvoiceApiKey: z2.string().optional(),
      ffmpegBatchSize: z2.number().optional()
    })).mutation(async ({ input }) => {
      const updateData = {};
      if (input.password) updateData.password = input.password;
      if (input.profileImageUrl !== void 0) updateData.profileImageUrl = input.profileImageUrl;
      if (input.kieApiKey !== void 0) updateData.kieApiKey = input.kieApiKey;
      if (input.openaiApiKey !== void 0) updateData.openaiApiKey = input.openaiApiKey;
      if (input.ffmpegApiKey !== void 0) updateData.ffmpegApiKey = input.ffmpegApiKey;
      if (input.cleanvoiceApiKey !== void 0) updateData.cleanvoiceApiKey = input.cleanvoiceApiKey;
      if (input.ffmpegBatchSize !== void 0) updateData.ffmpegBatchSize = input.ffmpegBatchSize;
      await updateAppUser(input.userId, updateData);
      const user2 = await getAppUserById(input.userId);
      return {
        success: true,
        user: user2 ? {
          id: user2.id,
          username: user2.username,
          profileImageUrl: user2.profileImageUrl,
          kieApiKey: user2.kieApiKey,
          openaiApiKey: user2.openaiApiKey,
          ffmpegApiKey: user2.ffmpegApiKey,
          cleanvoiceApiKey: user2.cleanvoiceApiKey,
          ffmpegBatchSize: user2.ffmpegBatchSize
        } : null
      };
    })
  }),
  // App Session router for managing user sessions
  appSession: router({
    // Create new session
    create: publicProcedure.input(z2.object({
      userId: z2.number(),
      name: z2.string(),
      data: z2.string()
      // JSON string
    })).mutation(async ({ input }) => {
      await createAppSession({
        userId: input.userId,
        name: input.name,
        data: input.data
      });
      return { success: true };
    }),
    // Get all sessions for a user
    getByUserId: publicProcedure.input(z2.object({
      userId: z2.number()
    })).query(async ({ input }) => {
      const sessions = await getAppSessionsByUserId(input.userId);
      return sessions;
    }),
    // Update session
    update: publicProcedure.input(z2.object({
      sessionId: z2.number(),
      name: z2.string().optional(),
      data: z2.string().optional()
      // JSON string
    })).mutation(async ({ input }) => {
      const updateData = {};
      if (input.name) updateData.name = input.name;
      if (input.data) updateData.data = input.data;
      await updateAppSession(input.sessionId, updateData);
      return { success: true };
    }),
    // Delete session
    delete: publicProcedure.input(z2.object({
      sessionId: z2.number()
    })).mutation(async ({ input }) => {
      await deleteAppSession(input.sessionId);
      return { success: true };
    })
  }),
  prompt: router({
    // Get hardcoded prompt text
    getHardcodedPrompt: publicProcedure.input(z2.object({
      promptType: z2.enum(["PROMPT_NEUTRAL", "PROMPT_SMILING", "PROMPT_CTA"])
    })).query(({ input }) => {
      const promptText = HARDCODED_PROMPTS[input.promptType];
      if (!promptText) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: `Prompt ${input.promptType} nu exist\u0103`
        });
      }
      return { promptText };
    })
  }),
  video: router({
    // Upload imagine pe Manus CDN
    uploadImage: publicProcedure.input(z2.object({
      imageData: z2.string(),
      fileName: z2.string(),
      userId: z2.number().optional(),
      // Optional userId pentru organizare per user
      sessionId: z2.string().optional()
      // Optional sessionId pentru organizare per sesiune
    })).mutation(async ({ input }) => {
      try {
        const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const timestamp2 = Date.now();
        const fileName = input.userId ? generateScreenshotPath(input.userId, input.sessionId || "default", "screenshot", timestamp2) : `default/${input.sessionId || "default"}/screenshot-${timestamp2}.png`;
        const BUNNYCDN_STORAGE_PASSWORD2 = "4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b";
        const BUNNYCDN_STORAGE_ZONE2 = "manus-storage";
        const BUNNYCDN_PULL_ZONE_URL2 = "https://manus.b-cdn.net";
        console.log("[Upload] Starting BunnyCDN upload for:", fileName);
        const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${fileName}`;
        const uploadResponse = await fetch(storageUrl, {
          method: "PUT",
          headers: {
            "AccessKey": BUNNYCDN_STORAGE_PASSWORD2,
            "Content-Type": "image/png"
          },
          body: buffer
        });
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("[Upload] BunnyCDN upload failed:", errorText);
          throw new Error(`BunnyCDN upload failed: ${uploadResponse.status} ${errorText}`);
        }
        const imageUrl = `${BUNNYCDN_PULL_ZONE_URL2}/${fileName}`;
        console.log("[Upload] BunnyCDN upload successful:", imageUrl);
        if (!imageUrl || !imageUrl.startsWith("http")) {
          throw new Error("Invalid URL returned from upload");
        }
        return { success: true, imageUrl };
      } catch (error) {
        console.error("Error uploading image:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to upload image: ${error.message || "Unknown error"}`
        });
      }
    }),
    // Generare video cu Kie.ai
    generateVideo: publicProcedure.input(z2.object({
      userId: z2.number(),
      prompt: z2.string(),
      imageUrl: z2.string()
    })).mutation(async ({ input }) => {
      try {
        const user2 = await getAppUserById(input.userId);
        if (!user2?.kieApiKey) {
          throw new Error("Kie API Key not configured. Please set it in Settings.");
        }
        const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${user2.kieApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: input.prompt,
            imageUrls: [input.imageUrl],
            model: "veo3_fast",
            generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
            aspectRatio: "9:16"
          })
        });
        const data = await response.json();
        if (!response.ok) {
          let errorMessage = "Failed to generate video";
          if (response.status === 402) {
            errorMessage = "Insufficient credits on Kie.ai account. Please add credits to continue.";
          } else if (response.status === 401) {
            errorMessage = "Invalid API key. Please check your Kie.ai API key.";
          } else if (response.status === 403) {
            errorMessage = "You do not have access permissions. This may be due to: insufficient credits, invalid API key, or account restrictions. Please check your Kie.ai account.";
          } else if (response.status === 429) {
            errorMessage = "Rate limit exceeded. Please try again later.";
          } else if (response.status === 400) {
            errorMessage = `Bad request: ${data.msg || "Invalid parameters"}`;
          } else if (response.status === 422) {
            errorMessage = `Validation error: ${data.msg || "Invalid input data"}`;
          } else if (data.msg) {
            errorMessage = `Kie.ai API error: ${data.msg}`;
          }
          throw new TRPCError3({
            code: response.status === 402 ? "PAYMENT_REQUIRED" : "BAD_REQUEST",
            message: errorMessage
          });
        }
        if (data.code === 200 && data.data?.taskId) {
          saveVideoTask(data.data.taskId, input.prompt, input.imageUrl);
          return {
            success: true,
            taskId: data.data.taskId,
            message: "Video generation started successfully"
          };
        } else {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: data.msg || "Failed to generate video - no taskId received"
          });
        }
      } catch (error) {
        console.error("Error generating video:", error);
        if (error instanceof TRPCError3) {
          throw error;
        }
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Network error: ${error.message || "Failed to connect to Kie.ai API"}`
        });
      }
    }),
    // Verificare status video
    checkVideoStatus: publicProcedure.input(z2.object({
      userId: z2.number(),
      taskId: z2.string()
    })).mutation(async ({ input }) => {
      try {
        const user2 = await getAppUserById(input.userId);
        if (!user2?.kieApiKey) {
          throw new Error("Kie API Key not configured. Please set it in Settings.");
        }
        const response = await fetch(
          `https://api.kie.ai/api/v1/veo/record-info?taskId=${input.taskId}`,
          {
            headers: {
              "Authorization": `Bearer ${user2.kieApiKey}`
            }
          }
        );
        const data = await response.json();
        if (!response.ok) {
          let errorMessage = "Failed to check video status";
          if (response.status === 401) {
            errorMessage = "Invalid API key";
          } else if (response.status === 404) {
            errorMessage = "Video task not found. The taskId may be invalid.";
          } else if (data.msg) {
            errorMessage = `Kie.ai API error: ${data.msg}`;
          }
          throw new TRPCError3({
            code: "BAD_REQUEST",
            message: errorMessage
          });
        }
        if (data.code === 200 && data.data) {
          const responseData = data.data.response;
          const successFlag = data.data.successFlag;
          let status;
          let videoUrl = void 0;
          if (successFlag === 1) {
            status = "success";
            if (responseData?.resultUrls && responseData.resultUrls.length > 0) {
              videoUrl = responseData.resultUrls[0];
            }
          } else if (successFlag === 0) {
            status = "pending";
          } else if (successFlag === -1) {
            status = "failed";
          } else {
            status = "pending";
          }
          updateVideoTask(input.taskId, {
            status,
            videoUrl
          });
          return {
            success: true,
            status,
            videoUrl,
            errorMessage: data.data.errorMessage || null
          };
        } else {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: data.msg || "Failed to retrieve video status"
          });
        }
      } catch (error) {
        console.error("Error checking video status:", error);
        if (error instanceof TRPCError3) {
          throw error;
        }
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Network error: ${error.message || "Failed to connect to Kie.ai API"}`
        });
      }
    }),
    // Process text ad (STEP 1 - Prepare Text Ad)
    processTextAd: publicProcedure.input(z2.object({
      rawText: z2.string(),
      applyDiacritics: z2.boolean().optional()
    })).mutation(async ({ input }) => {
      try {
        const outputData = processAdDocument(input.rawText);
        const finalData = addRedOnLine1(outputData);
        return {
          success: true,
          processedLines: finalData
        };
      } catch (error) {
        console.error("Error processing text ad:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process text ad: ${error.message || "Unknown error"}`
        });
      }
    }),
    // Parsare document ad cu detectare secțiuni
    parseAdDocument: publicProcedure.input(z2.object({
      documentData: z2.string()
      // base64
    })).mutation(async ({ input }) => {
      try {
        const base64Data = input.documentData.replace(/^data:application\/[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const linesWithSections = await parseAdDocumentWithSections(buffer);
        return {
          success: true,
          lines: linesWithSections
        };
      } catch (error) {
        console.error("Error parsing ad document:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse ad document: ${error.message || "Unknown error"}`
        });
      }
    }),
    // Parsare document prompt
    parsePromptDocument: publicProcedure.input(z2.object({
      documentData: z2.string()
      // base64
    })).mutation(async ({ input }) => {
      try {
        const base64Data = input.documentData.replace(/^data:application\/[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const promptTemplate = await parsePromptDocument(buffer);
        return {
          success: true,
          promptTemplate
        };
      } catch (error) {
        console.error("Error parsing prompt document:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse prompt document: ${error.message || "Unknown error"}`
        });
      }
    }),
    // Generare batch videouri
    generateBatchVideos: publicProcedure.input(z2.object({
      userId: z2.number(),
      promptTemplate: z2.string(),
      combinations: z2.array(z2.object({
        text: z2.string(),
        imageUrl: z2.string()
      }))
    })).mutation(async ({ input }) => {
      try {
        const user2 = await getAppUserById(input.userId);
        if (!user2?.kieApiKey) {
          throw new Error("Kie API Key not configured. Please set it in Settings.");
        }
        const results = [];
        const promises2 = input.combinations.map(async (combo) => {
          try {
            let promptTemplate = input.promptTemplate;
            if (promptTemplate.startsWith("HARDCODED_")) {
              const promptType = promptTemplate.replace("HARDCODED_", "");
              if (HARDCODED_PROMPTS[promptType]) {
                promptTemplate = HARDCODED_PROMPTS[promptType].content;
              }
            }
            const finalPrompt = replaceInsertText(promptTemplate, combo.text);
            const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${user2.kieApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                prompt: finalPrompt,
                imageUrls: [combo.imageUrl],
                model: "veo3_fast",
                generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
                aspectRatio: "9:16"
              })
            });
            const data = await response.json();
            if (!response.ok || data.code !== 200 || !data.data?.taskId) {
              return {
                success: false,
                text: combo.text,
                imageUrl: combo.imageUrl,
                error: data.msg || "Failed to generate video"
              };
            }
            saveVideoTask(data.data.taskId, combo.text, combo.imageUrl);
            return {
              success: true,
              taskId: data.data.taskId,
              text: combo.text,
              imageUrl: combo.imageUrl
            };
          } catch (error) {
            return {
              success: false,
              text: combo.text,
              imageUrl: combo.imageUrl,
              error: error.message || "Network error"
            };
          }
        });
        const settled = await Promise.allSettled(promises2);
        settled.forEach((result) => {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              text: "",
              imageUrl: "",
              error: result.reason?.message || "Unknown error"
            });
          }
        });
        return {
          success: true,
          results,
          totalGenerated: results.filter((r) => r.success).length,
          totalFailed: results.filter((r) => !r.success).length
        };
      } catch (error) {
        console.error("Error generating batch videos:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate batch videos: ${error.message || "Unknown error"}`
        });
      }
    }),
    // Generare multiple variante pentru un singur video
    generateMultipleVariants: publicProcedure.input(z2.object({
      variants: z2.array(z2.object({
        promptType: z2.string(),
        // 'PROMPT_NEUTRAL', 'PROMPT_SMILING', 'PROMPT_CTA', 'PROMPT_CUSTOM', sau custom prompt name
        promptText: z2.string().optional(),
        // Custom prompt text (override hardcoded)
        dialogueText: z2.string(),
        // Text pentru [INSERT TEXT]
        imageUrl: z2.string()
      }))
    })).mutation(async ({ input }) => {
      try {
        const results = [];
        const promises2 = input.variants.map(async (variant) => {
          try {
            let promptTemplate = "";
            if (variant.promptText && variant.promptText.trim().length > 0) {
              promptTemplate = variant.promptText;
            } else {
              if (variant.promptType.startsWith("HARDCODED_") || variant.promptType === "PROMPT_NEUTRAL" || variant.promptType === "PROMPT_SMILING" || variant.promptType === "PROMPT_CTA") {
                let promptKey = variant.promptType;
                if (!promptKey.startsWith("HARDCODED_")) {
                  promptKey = `HARDCODED_${promptKey}`;
                }
                const hardcodedKey = promptKey.replace("HARDCODED_", "");
                if (HARDCODED_PROMPTS[hardcodedKey]) {
                  promptTemplate = HARDCODED_PROMPTS[hardcodedKey].content;
                }
              } else {
                throw new Error(`Custom prompt type "${variant.promptType}" requires promptText`);
              }
            }
            if (!promptTemplate) {
              throw new Error(`No prompt template found for type: ${variant.promptType}`);
            }
            const finalPrompt = replaceInsertText(promptTemplate, variant.dialogueText);
            const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${user.kieApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                prompt: finalPrompt,
                imageUrls: [variant.imageUrl],
                model: "veo3_fast",
                generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
                aspectRatio: "9:16"
              })
            });
            const data = await response.json();
            if (!response.ok || data.code !== 200 || !data.data?.taskId) {
              return {
                success: false,
                dialogueText: variant.dialogueText,
                imageUrl: variant.imageUrl,
                promptType: variant.promptType,
                error: data.msg || "Failed to generate video"
              };
            }
            saveVideoTask(data.data.taskId, variant.dialogueText, variant.imageUrl);
            return {
              success: true,
              taskId: data.data.taskId,
              dialogueText: variant.dialogueText,
              imageUrl: variant.imageUrl,
              promptType: variant.promptType
            };
          } catch (error) {
            return {
              success: false,
              dialogueText: variant.dialogueText,
              imageUrl: variant.imageUrl,
              promptType: variant.promptType,
              error: error.message || "Network error"
            };
          }
        });
        const settled = await Promise.allSettled(promises2);
        settled.forEach((result) => {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              dialogueText: "",
              imageUrl: "",
              promptType: "",
              error: result.reason?.message || "Unknown error"
            });
          }
        });
        return {
          success: true,
          results,
          totalGenerated: results.filter((r) => r.success).length,
          totalFailed: results.filter((r) => !r.success).length
        };
      } catch (error) {
        console.error("Error generating multiple variants:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate multiple variants: ${error.message || "Unknown error"}`
        });
      }
    })
  }),
  // Images Library router
  imageLibrary: router({
    // Upload single image
    upload: publicProcedure.input(z2.object({
      userId: z2.number(),
      characterName: z2.string().default("No Character"),
      imageName: z2.string(),
      imageData: z2.string()
      // base64
    })).mutation(async ({ input }) => {
      try {
        const normalizedCharacterName = (input.characterName || "").trim() || "No Character";
        console.log("[imageLibrary.upload] Starting upload for user:", input.userId, "character:", normalizedCharacterName, "imageName:", input.imageName);
        const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        console.log("[imageLibrary.upload] Buffer size:", buffer.length);
        const { generateImageLibraryPath: generateImageLibraryPath2 } = await Promise.resolve().then(() => (init_storageHelpers(), storageHelpers_exports));
        const fileName = generateImageLibraryPath2(
          input.userId,
          normalizedCharacterName,
          input.imageName
        );
        const BUNNYCDN_STORAGE_PASSWORD2 = "4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b";
        const BUNNYCDN_STORAGE_ZONE2 = "manus-storage";
        const BUNNYCDN_PULL_ZONE_URL2 = "https://manus.b-cdn.net";
        const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE2}/${fileName}`;
        console.log("[imageLibrary.upload] Uploading to BunnyCDN:", storageUrl);
        const uploadResponse = await fetch(storageUrl, {
          method: "PUT",
          headers: {
            "AccessKey": BUNNYCDN_STORAGE_PASSWORD2,
            "Content-Type": "image/png"
          },
          body: buffer
        });
        console.log("[imageLibrary.upload] BunnyCDN response status:", uploadResponse.status);
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("[imageLibrary.upload] BunnyCDN upload failed:", uploadResponse.status, errorText);
          throw new Error(`BunnyCDN upload failed: ${uploadResponse.status} ${errorText}`);
        }
        const imageUrl = `${BUNNYCDN_PULL_ZONE_URL2}/${fileName}`;
        console.log("[imageLibrary.upload] Saving to database:", imageUrl);
        await createUserImage({
          userId: input.userId,
          characterName: normalizedCharacterName,
          // Use normalized name
          imageName: input.imageName,
          imageUrl,
          imageKey: fileName
        });
        const existingImages = await getUserImagesByCharacter(input.userId, normalizedCharacterName);
        if (existingImages.length === 1) {
          console.log("[imageLibrary.upload] First image for character, creating/updating character");
          const characters2 = await getCharactersByUserId(input.userId);
          let character = characters2.find((c) => c.name === normalizedCharacterName);
          if (!character) {
            console.log("[imageLibrary.upload] Character not found, creating new categoryCharacter:", normalizedCharacterName);
            character = await createCharacter({
              userId: input.userId,
              name: normalizedCharacterName,
              thumbnailUrl: imageUrl
            });
            console.log("[imageLibrary.upload] Character created:", character.id);
          } else {
            await updateCharacter(character.id, {
              thumbnailUrl: imageUrl
            });
            console.log("[imageLibrary.upload] Character thumbnail updated:", character.id);
          }
        }
        console.log("[imageLibrary.upload] Upload successful!");
        return { success: true, imageUrl };
      } catch (error) {
        console.error("[imageLibrary.upload] Error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to upload image: ${error.message}`
        });
      }
    }),
    // List all images for user
    list: publicProcedure.input(z2.object({
      userId: z2.number(),
      characterName: z2.string().optional()
    })).query(async ({ input }) => {
      try {
        if (input.characterName) {
          return await getUserImagesByCharacter(input.userId, input.characterName);
        }
        return await getUserImagesByUserId(input.userId);
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list images: ${error.message}`
        });
      }
    }),
    // Sync characters from Images Library to categoryCharacters
    syncCharacters: publicProcedure.input(z2.object({
      userId: z2.number()
    })).mutation(async ({ input }) => {
      try {
        console.log("[imageLibrary.syncCharacters] Starting sync for user:", input.userId);
        const allImages = await getUserImagesByUserId(input.userId);
        const uniqueCharacterNames = [...new Set(allImages.map((img) => img.characterName))];
        console.log("[imageLibrary.syncCharacters] Found", uniqueCharacterNames.length, "unique characters in Images Library");
        const existingCharacters = await getCharactersByUserId(input.userId);
        const existingNames = new Set(existingCharacters.map((c) => c.name));
        let created = 0;
        for (const characterName of uniqueCharacterNames) {
          if (!existingNames.has(characterName)) {
            const characterImages = await getUserImagesByCharacter(input.userId, characterName);
            const thumbnailUrl = characterImages[0]?.imageUrl || null;
            await createCharacter({
              userId: input.userId,
              name: characterName,
              thumbnailUrl
            });
            console.log("[imageLibrary.syncCharacters] Created character:", characterName);
            created++;
          }
        }
        console.log("[imageLibrary.syncCharacters] Sync complete! Created", created, "characters");
        return { success: true, created };
      } catch (error) {
        console.error("[imageLibrary.syncCharacters] Error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to sync characters: ${error.message}`
        });
      }
    }),
    // Get unique character names
    getCharacters: publicProcedure.input(z2.object({
      userId: z2.number()
    })).query(async ({ input }) => {
      try {
        return await getUniqueCharacterNames(input.userId);
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get characters: ${error.message}`
        });
      }
    }),
    // Update image name or character
    updateName: publicProcedure.input(z2.object({
      id: z2.number(),
      imageName: z2.string().optional(),
      characterName: z2.string().optional()
    })).mutation(async ({ input }) => {
      try {
        const updateData = {};
        if (input.imageName) updateData.imageName = input.imageName;
        if (input.characterName) updateData.characterName = input.characterName;
        await updateUserImage(input.id, updateData);
        return { success: true };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update image: ${error.message}`
        });
      }
    }),
    // Delete image
    delete: publicProcedure.input(z2.object({
      id: z2.number()
    })).mutation(async ({ input }) => {
      try {
        await deleteUserImage(input.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete image: ${error.message}`
        });
      }
    }),
    // Batch delete images
    batchDelete: publicProcedure.input(z2.object({
      ids: z2.array(z2.number())
    })).mutation(async ({ input }) => {
      try {
        console.log("[imageLibrary.batchDelete] Deleting images:", input.ids);
        let deletedCount = 0;
        for (const id of input.ids) {
          try {
            await deleteUserImage(id);
            deletedCount++;
          } catch (error) {
            console.error(`[imageLibrary.batchDelete] Failed to delete image ${id}:`, error);
          }
        }
        console.log("[imageLibrary.batchDelete] Deleted", deletedCount, "images");
        return { success: true, count: deletedCount };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to batch delete images: ${error.message}`
        });
      }
    }),
    // Update display order for images
    updateOrder: publicProcedure.input(z2.object({
      imageOrders: z2.array(z2.object({
        id: z2.number(),
        displayOrder: z2.number()
      }))
    })).mutation(async ({ input }) => {
      try {
        console.log("[imageLibrary.updateOrder] \u{1F4E5} Received request to update order for", input.imageOrders.length, "images");
        console.log("[imageLibrary.updateOrder] \u{1F4E6} Image orders to update:", JSON.stringify(input.imageOrders, null, 2));
        for (const { id, displayOrder } of input.imageOrders) {
          console.log(`[imageLibrary.updateOrder] \u{1F504} Updating image ${id} to displayOrder ${displayOrder}`);
          const result = await updateUserImage(id, { displayOrder });
          console.log(`[imageLibrary.updateOrder] \u2705 Image ${id} updated successfully:`, result);
        }
        console.log("[imageLibrary.updateOrder] \u2705 All images order updated successfully");
        return { success: true };
      } catch (error) {
        console.error("[imageLibrary.updateOrder] \u274C Error updating order:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update order: ${error.message}`
        });
      }
    })
  }),
  // Prompts Library router
  promptLibrary: router({
    // List all prompts for user (default + custom)
    list: publicProcedure.input(z2.object({
      userId: z2.number()
    })).query(async ({ input }) => {
      try {
        return await getUserPromptsByUserId(input.userId);
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list prompts: ${error.message}`
        });
      }
    }),
    // Create new custom prompt
    create: publicProcedure.input(z2.object({
      userId: z2.number(),
      promptName: z2.string().min(1).max(100),
      promptTemplate: z2.string().min(1)
    })).mutation(async ({ input }) => {
      try {
        await createUserPrompt({
          userId: input.userId,
          promptName: input.promptName,
          promptTemplate: input.promptTemplate,
          isDefault: 0
          // Custom prompts are never default
        });
        return { success: true };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create prompt: ${error.message}`
        });
      }
    }),
    // Update prompt (with protection for default prompts)
    update: publicProcedure.input(z2.object({
      id: z2.number(),
      promptName: z2.string().optional(),
      promptTemplate: z2.string().optional()
    })).mutation(async ({ input }) => {
      try {
        const updateData = {};
        if (input.promptName) updateData.promptName = input.promptName;
        if (input.promptTemplate) updateData.promptTemplate = input.promptTemplate;
        await updateUserPrompt(input.id, updateData);
        return { success: true };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update prompt: ${error.message}`
        });
      }
    }),
    // Duplicate prompt
    duplicate: publicProcedure.input(z2.object({
      id: z2.number(),
      userId: z2.number()
    })).mutation(async ({ input }) => {
      try {
        const original = await getUserPromptById(input.id);
        if (!original) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "Prompt not found"
          });
        }
        await createUserPrompt({
          userId: input.userId,
          promptName: `${original.promptName} - Copy`,
          promptTemplate: original.promptTemplate,
          isDefault: 0
          // Duplicates are never default
        });
        return { success: true };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to duplicate prompt: ${error.message}`
        });
      }
    }),
    // Delete prompt (with protection for default prompts)
    delete: publicProcedure.input(z2.object({
      id: z2.number()
    })).mutation(async ({ input }) => {
      try {
        const prompt = await getUserPromptById(input.id);
        if (!prompt) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "Prompt not found"
          });
        }
        if (prompt.isDefault === 1) {
          throw new TRPCError3({
            code: "BAD_REQUEST",
            message: "Cannot delete default prompts"
          });
        }
        await deleteUserPrompt(input.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete prompt: ${error.message}`
        });
      }
    })
  }),
  // TAMs router
  tams: router({
    list: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      return await getTamsByUserId(input.userId);
    }),
    create: publicProcedure.input(z2.object({
      userId: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      const result = await createTam({
        userId: input.userId,
        name: input.name
      });
      return { success: true, id: result[0].insertId };
    }),
    update: publicProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      await updateTam(input.id, { name: input.name });
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      const coreBeliefs2 = await getCoreBeliefsByTamId(input.id);
      if (coreBeliefs2.length > 0) {
        throw new TRPCError3({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete TAM: It has ${coreBeliefs2.length} Core Belief(s). Delete all Core Beliefs first.`
        });
      }
      await deleteTam(input.id);
      return { success: true };
    })
  }),
  // Core Beliefs router
  coreBeliefs: router({
    list: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      return await getCoreBeliefsByUserId(input.userId);
    }),
    listByTamId: publicProcedure.input(z2.object({ tamId: z2.number() })).query(async ({ input }) => {
      return await getCoreBeliefsByTamId(input.tamId);
    }),
    create: publicProcedure.input(z2.object({
      userId: z2.number(),
      tamId: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      const result = await createCoreBelief({
        userId: input.userId,
        tamId: input.tamId,
        name: input.name
      });
      return { success: true, id: result[0].insertId };
    }),
    update: publicProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      await updateCoreBelief(input.id, { name: input.name });
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      const emotionalAngles2 = await getEmotionalAnglesByCoreBeliefId(input.id);
      if (emotionalAngles2.length > 0) {
        throw new TRPCError3({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete Core Belief: It has ${emotionalAngles2.length} Emotional Angle(s). Delete all Emotional Angles first.`
        });
      }
      await deleteCoreBelief(input.id);
      return { success: true };
    })
  }),
  // Emotional Angles router
  emotionalAngles: router({
    list: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      return await getEmotionalAnglesByUserId(input.userId);
    }),
    listByCoreBeliefId: publicProcedure.input(z2.object({ coreBeliefId: z2.number() })).query(async ({ input }) => {
      return await getEmotionalAnglesByCoreBeliefId(input.coreBeliefId);
    }),
    create: publicProcedure.input(z2.object({
      userId: z2.number(),
      coreBeliefId: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      const result = await createEmotionalAngle({
        userId: input.userId,
        coreBeliefId: input.coreBeliefId,
        name: input.name
      });
      return { success: true, id: result[0].insertId };
    }),
    update: publicProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      await updateEmotionalAngle(input.id, { name: input.name });
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      const ads2 = await getAdsByEmotionalAngleId(input.id);
      if (ads2.length > 0) {
        throw new TRPCError3({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete Emotional Angle: It has ${ads2.length} AD(s). Delete all ADs first.`
        });
      }
      await deleteEmotionalAngle(input.id);
      return { success: true };
    })
  }),
  // Ads router
  ads: router({
    list: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      return await getAdsByUserId(input.userId);
    }),
    listByEmotionalAngleId: publicProcedure.input(z2.object({ emotionalAngleId: z2.number() })).query(async ({ input }) => {
      return await getAdsByEmotionalAngleId(input.emotionalAngleId);
    }),
    create: publicProcedure.input(z2.object({
      userId: z2.number(),
      emotionalAngleId: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      const result = await createAd({
        userId: input.userId,
        emotionalAngleId: input.emotionalAngleId,
        name: input.name
      });
      return { success: true, id: result[0].insertId };
    }),
    update: publicProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      await updateAd(input.id, { name: input.name });
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteAd(input.id);
      return { success: true };
    })
  }),
  // Characters router
  categoryCharacters: router({
    list: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      return await getCharactersByUserId(input.userId);
    }),
    create: publicProcedure.input(z2.object({
      userId: z2.number(),
      name: z2.string().min(1).max(255)
    })).mutation(async ({ input }) => {
      const character = await createCharacter({
        userId: input.userId,
        name: input.name,
        thumbnailUrl: null
        // Explicitly set to null instead of omitting
      });
      return { success: true, id: character.id };
    }),
    update: publicProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().min(1).max(255).optional(),
      thumbnailUrl: z2.string().nullable().optional()
    })).mutation(async ({ input }) => {
      const updateData = {};
      if (input.name !== void 0) updateData.name = input.name;
      if (input.thumbnailUrl !== void 0) updateData.thumbnailUrl = input.thumbnailUrl;
      await updateCharacter(input.id, updateData);
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteCharacter(input.id);
      return { success: true };
    })
  }),
  // Context Sessions
  contextSessions: router({
    listByUser: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      try {
        console.log("[Backend listByUser] \u{1F50D} Query started with userId:", input.userId);
        const db = await getDb();
        if (!db) {
          console.log("[Backend listByUser] \u274C Database not available");
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available"
          });
        }
        console.log("[Backend listByUser] \u{1F4BE} Database connection OK, executing query...");
        const results = await db.select({
          id: contextSessions.id,
          userId: contextSessions.userId,
          tamId: contextSessions.tamId,
          coreBeliefId: contextSessions.coreBeliefId,
          emotionalAngleId: contextSessions.emotionalAngleId,
          adId: contextSessions.adId,
          characterId: contextSessions.characterId,
          videoResults: contextSessions.videoResults,
          updatedAt: contextSessions.updatedAt
        }).from(contextSessions).where(eq3(contextSessions.userId, input.userId));
        console.log("[Backend listByUser] \u{1F4CA} Query completed! Found", results.length, "sessions for userId", input.userId);
        if (results.length > 0) {
          results.forEach((s) => {
            console.log(`  - Session ${s.id}: userId=${s.userId}, tamId=${s.tamId}, adId=${s.adId}, characterId=${s.characterId}, hasVideoResults=${!!s.videoResults}, videoResultsType=${typeof s.videoResults}`);
          });
        } else {
          console.log("[Backend listByUser] \u26A0\uFE0F No sessions found for userId", input.userId);
        }
        console.log("[Backend listByUser] \u2705 Returning", results.length, "results to frontend");
        return results;
      } catch (error) {
        console.error("[Backend listByUser] \u274C ERROR:", error);
        console.error("[Backend listByUser] \u274C Error message:", error.message);
        console.error("[Backend listByUser] \u274C Error stack:", error.stack);
        if (error.sql) {
          console.error("[Backend listByUser] \u274C SQL:", error.sql);
        }
        throw error;
      }
    }),
    // Get the most recent context session for a user (sorted by updatedAt)
    getLastContext: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available"
        });
      }
      const results = await db.select().from(contextSessions).where(eq3(contextSessions.userId, input.userId));
      results.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      return results[0] || null;
    }),
    get: publicProcedure.input(z2.object({
      userId: z2.number(),
      tamId: z2.number().optional().nullable(),
      // Optional tamId for unique identification
      coreBeliefId: z2.number(),
      emotionalAngleId: z2.number(),
      adId: z2.number(),
      characterId: z2.number()
    })).query(async ({ input }) => {
      return await getContextSession(input);
    }),
    getLatest: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available"
        });
      }
      const sessions = await db.select({
        id: contextSessions.id,
        userId: contextSessions.userId,
        tamId: contextSessions.tamId,
        coreBeliefId: contextSessions.coreBeliefId,
        emotionalAngleId: contextSessions.emotionalAngleId,
        adId: contextSessions.adId,
        characterId: contextSessions.characterId,
        updatedAt: contextSessions.updatedAt
      }).from(contextSessions).where(eq3(contextSessions.userId, input.userId)).orderBy(desc(contextSessions.updatedAt)).limit(1);
      return sessions[0] || null;
    }),
    getCharactersWithContextInAd: publicProcedure.input(z2.object({
      userId: z2.number(),
      adId: z2.number(),
      excludeCharacterId: z2.number().optional()
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available"
        });
      }
      const sessions = await db.select().from(contextSessions).where(eq3(contextSessions.adId, input.adId));
      const charactersWithContext = sessions.filter((session) => {
        if (input.excludeCharacterId && session.characterId === input.excludeCharacterId) {
          return false;
        }
        if (!session.adLines) return false;
        const adLines = typeof session.adLines === "string" ? JSON.parse(session.adLines) : session.adLines;
        return Array.isArray(adLines) && adLines.length > 0;
      }).map((session) => ({
        characterId: session.characterId,
        adLines: session.adLines
      }));
      return charactersWithContext;
    }),
    upsert: publicProcedure.input(z2.object({
      userId: z2.number(),
      tamId: z2.number(),
      coreBeliefId: z2.number(),
      emotionalAngleId: z2.number(),
      adId: z2.number(),
      characterId: z2.number(),
      currentStep: z2.number().optional(),
      rawTextAd: z2.string().optional(),
      processedTextAd: z2.string().optional(),
      adLines: z2.any().optional(),
      prompts: z2.any().optional(),
      images: z2.any().optional(),
      combinations: z2.any().optional(),
      deletedCombinations: z2.any().optional(),
      videoResults: z2.any().optional(),
      reviewHistory: z2.any().optional(),
      hookMergedVideos: z2.any().optional(),
      bodyMergedVideoUrl: z2.string().nullable().optional(),
      finalVideos: z2.any().optional(),
      sampleMergedVideoUrl: z2.string().nullable().optional()
    })).mutation(async ({ input }) => {
      return await upsertContextSession(input);
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteContextSession(input.id);
      return { success: true };
    }),
    // TEMPORARY: Delete OTHER video cards from all sessions
    deleteOtherVideos: publicProcedure.input(z2.object({ userId: z2.number() })).mutation(async ({ input }) => {
      try {
        const db = await getDb();
        const sessions = await db.select().from(contextSessions).where(eq3(contextSessions.userId, input.userId));
        let totalDeleted = 0;
        for (const session of sessions) {
          if (!session.videoResults) continue;
          const videoResults = typeof session.videoResults === "string" ? JSON.parse(session.videoResults) : session.videoResults;
          const originalCount = videoResults.length;
          const filteredVideos = videoResults.filter(
            (v) => !v.videoName?.includes("OTHER")
          );
          const deletedCount = originalCount - filteredVideos.length;
          totalDeleted += deletedCount;
          if (deletedCount > 0) {
            await db.update(contextSessions).set({ videoResults: JSON.stringify(filteredVideos) }).where(eq3(contextSessions.id, session.id));
            console.log(`[deleteOtherVideos] Session ${session.id}: Deleted ${deletedCount} OTHER videos`);
          }
        }
        return { success: true, deletedCount: totalDeleted };
      } catch (error) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete OTHER videos: ${error.message}`
        });
      }
    })
  }),
  // Video Editing router for Step 8 (batch processing) and Step 10 (cutting)
  videoEditing: router({
    // Create FFmpeg directory for batch processing
    createDirectory: publicProcedure.input(z2.object({
      ffmpegApiKey: z2.string()
    })).mutation(async ({ input }) => {
      try {
        const FFMPEG_API_BASE2 = "https://api.ffmpeg-api.com";
        const dirRes = await fetch(`${FFMPEG_API_BASE2}/directory`, {
          method: "POST",
          headers: {
            "Authorization": input.ffmpegApiKey,
            "Content-Type": "application/json"
          }
        });
        if (!dirRes.ok) {
          throw new Error(`Failed to create directory: ${dirRes.statusText}`);
        }
        const dirData = await dirRes.json();
        const dirId = dirData.id || dirData.directory?.id || dirData.dir_id;
        if (!dirId) {
          throw new Error(`Failed to extract directory ID from response`);
        }
        console.log(`[createDirectory] Created directory: ${dirId}`);
        return { dirId };
      } catch (error) {
        console.error("[createDirectory] Error:", error);
        throw new Error(`Failed to create directory: ${error.message}`);
      }
    }),
    // Process single video for editing (Step 8 batch processing)
    processVideoForEditing: publicProcedure.input(z2.object({
      videoUrl: z2.string(),
      videoId: z2.number(),
      videoName: z2.string(),
      // Video name for unique file naming
      fullText: z2.string(),
      redText: z2.string().optional().default(""),
      // Optional - can be empty for white-text-only videos
      redTextPosition: z2.enum(["START", "END"]).optional(),
      // Optional - not used for white-text-only videos
      marginMs: z2.number().optional().default(50),
      userApiKey: z2.string().optional(),
      ffmpegApiKey: z2.string().optional(),
      cleanvoiceApiKey: z2.string().optional(),
      userId: z2.number().optional()
    })).mutation(async ({ input }) => {
      try {
        console.log(`[videoEditing.processVideoForEditing] \u{1F4E5} Received request for video ${input.videoId} (${input.videoName})`);
        console.log(`[videoEditing.processVideoForEditing] \u{1F4CB} Input:`, {
          videoUrl: input.videoUrl?.substring(0, 50) + "...",
          videoId: input.videoId,
          videoName: input.videoName,
          fullText: input.fullText?.substring(0, 50) + "...",
          redText: input.redText,
          redTextPosition: input.redTextPosition,
          hasUserApiKey: !!input.userApiKey,
          hasFFmpegApiKey: !!input.ffmpegApiKey
        });
        const result = await processVideoForEditing(
          input.videoUrl,
          input.videoId,
          input.videoName,
          input.fullText,
          input.redText,
          input.redTextPosition,
          input.marginMs,
          input.userApiKey,
          input.ffmpegApiKey,
          input.cleanvoiceApiKey,
          input.userId
        );
        console.log(`[videoEditing.processVideoForEditing] \u2705 Processing complete for ${input.videoName}`);
        console.log(`[videoEditing.processVideoForEditing] \u{1F4E4} Returning result:`, {
          audioUrl: result.audioUrl,
          cutPoints: result.cutPoints,
          whisperTranscript: typeof result.whisperTranscript === "string" ? result.whisperTranscript.substring(0, 50) + "..." : JSON.stringify(result.whisperTranscript).substring(0, 50) + "..."
        });
        return {
          success: true,
          words: result.words,
          cutPoints: result.cutPoints,
          whisperTranscript: result.whisperTranscript,
          audioUrl: result.audioUrl,
          waveformJson: result.waveformJson,
          editingDebugInfo: result.editingDebugInfo,
          cleanvoiceAudioUrl: result.cleanvoiceAudioUrl
        };
      } catch (error) {
        console.error(`[videoEditing.processVideoForEditing] Error for video ${input.videoId}:`, error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process video: ${error.message}`
        });
      }
    }),
    // STEP 7 PART 1: Extract WAV from video (FFmpeg only)
    extractWAVFromVideo: publicProcedure.input(z2.object({
      videoUrl: z2.string(),
      videoId: z2.number(),
      videoName: z2.string(),
      ffmpegApiKey: z2.string(),
      userId: z2.number()
    })).mutation(async ({ input }) => {
      try {
        console.log(`[extractWAVFromVideo] Request for ${input.videoName}`);
        const result = await extractWAVFromVideo(
          input.videoUrl,
          input.videoId,
          input.videoName,
          input.ffmpegApiKey,
          input.userId
        );
        console.log(`[extractWAVFromVideo] Complete for ${input.videoName}`);
        return {
          success: true,
          wavUrl: result.wavUrl,
          waveformJson: result.waveformJson
        };
      } catch (error) {
        console.error(`[extractWAVFromVideo] Error for ${input.videoName}:`, error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to extract WAV: ${error.message}`
        });
      }
    }),
    // STEP 7 PART 2: Process WAV with Whisper + CleanVoice
    processAudioWithWhisperCleanVoice: publicProcedure.input(z2.object({
      wavUrl: z2.string(),
      videoId: z2.number(),
      videoName: z2.string(),
      fullText: z2.string(),
      redText: z2.string().optional().default(""),
      redTextPosition: z2.enum(["START", "END"]).optional(),
      marginMs: z2.number().optional().default(50),
      userApiKey: z2.string().optional(),
      cleanvoiceApiKey: z2.string().optional(),
      userId: z2.number().optional()
    })).mutation(async ({ input }) => {
      try {
        console.log(`[processAudioWithWhisperCleanVoice] Request for ${input.videoName}`);
        const result = await processAudioWithWhisperCleanVoice(
          input.wavUrl,
          input.videoId,
          input.videoName,
          input.fullText,
          input.redText,
          input.redTextPosition,
          input.marginMs,
          input.userApiKey,
          input.cleanvoiceApiKey,
          input.userId
        );
        console.log(`[processAudioWithWhisperCleanVoice] Complete for ${input.videoName}`);
        return {
          success: true,
          words: result.words,
          cutPoints: result.cutPoints,
          whisperTranscript: result.whisperTranscript,
          cleanvoiceAudioUrl: result.cleanvoiceAudioUrl,
          editingDebugInfo: result.editingDebugInfo
        };
      } catch (error) {
        console.error(`[processAudioWithWhisperCleanVoice] Error for ${input.videoName}:`, error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process audio: ${error.message}`
        });
      }
    }),
    // Cut video with timestamps (Step 10)
    cutVideo: publicProcedure.input(z2.object({
      userId: z2.number(),
      videoUrl: z2.string(),
      videoName: z2.string(),
      startTimeMs: z2.number(),
      // milliseconds
      endTimeMs: z2.number(),
      // milliseconds
      ffmpegApiKey: z2.string().optional(),
      cleanVoiceAudioUrl: z2.string().nullable().optional(),
      // CleanVoice audio URL (can be null or undefined)
      dirId: z2.string().optional(),
      // Optional: shared directory ID for batch processing
      overlaySettings: z2.object({
        enabled: z2.boolean(),
        text: z2.string(),
        x: z2.number(),
        y: z2.number(),
        fontFamily: z2.string(),
        fontSize: z2.number(),
        bold: z2.boolean(),
        italic: z2.boolean(),
        textColor: z2.string(),
        backgroundColor: z2.string(),
        opacity: z2.number(),
        padding: z2.number(),
        cornerRadius: z2.number(),
        lineSpacing: z2.number(),
        videoWidth: z2.number().optional(),
        // Native video width
        videoHeight: z2.number().optional(),
        // Native video height
        scaleFactor: z2.number().optional()
        // Scale factor for fontSize (videoWidth / playerWidth)
      }).optional()
      // Optional: overlay settings for HOOK videos
    })).mutation(async ({ input }) => {
      try {
        const startTimeSeconds = (input.startTimeMs / 1e3).toFixed(3);
        const endTimeSeconds = (input.endTimeMs / 1e3).toFixed(3);
        console.log(`[videoEditing.cutVideo] Cutting video ${input.videoName}: ${startTimeSeconds}s \u2192 ${endTimeSeconds}s (from ${input.startTimeMs}ms \u2192 ${input.endTimeMs}ms)`);
        const finalVideoUrl = await cutVideoWithFFmpegAPI(
          input.videoUrl,
          input.videoName,
          parseFloat(startTimeSeconds),
          parseFloat(endTimeSeconds),
          input.ffmpegApiKey,
          input.cleanVoiceAudioUrl,
          // Pass CleanVoice audio URL
          input.userId,
          // Pass userId for user-specific folder
          input.dirId,
          // Pass dirId for batch processing optimization
          input.overlaySettings
          // Pass overlay settings for HOOK videos
        );
        console.log(`[videoEditing.cutVideo] Video cut and uploaded successfully:`, finalVideoUrl);
        return {
          success: true,
          downloadUrl: finalVideoUrl
          // Return Bunny CDN URL instead of temporary FFmpeg URL
        };
      } catch (error) {
        console.error(`[videoEditing.cutVideo] Error for video ${input.videoId}:`, error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to cut video: ${error.message}`
        });
      }
    }),
    // Cut & Merge two consecutive videos (test mode - no DB save)
    cutAndMergeVideos: publicProcedure.input(z2.object({
      video1Url: z2.string(),
      video1Name: z2.string(),
      video1StartMs: z2.number(),
      video1EndMs: z2.number(),
      video2Url: z2.string(),
      video2Name: z2.string(),
      video2StartMs: z2.number(),
      video2EndMs: z2.number(),
      ffmpegApiKey: z2.string()
    })).mutation(async ({ input }) => {
      try {
        console.log("[cutAndMergeVideos] Starting cut & merge process...");
        const video1Start = (input.video1StartMs / 1e3).toFixed(3);
        const video1End = (input.video1EndMs / 1e3).toFixed(3);
        const video2Start = (input.video2StartMs / 1e3).toFixed(3);
        const video2End = (input.video2EndMs / 1e3).toFixed(3);
        const duration1 = parseFloat(video1End) - parseFloat(video1Start);
        const duration2 = parseFloat(video2End) - parseFloat(video2Start);
        console.log(`[cutAndMergeVideos] Video 1: ${input.video1Name} (${video1Start}s \u2192 ${video1End}s, duration: ${duration1}s)`);
        console.log(`[cutAndMergeVideos] Video 2: ${input.video2Name} (${video2Start}s \u2192 ${video2End}s, duration: ${duration2}s)`);
        const FFMPEG_API_BASE2 = "https://api.ffmpeg-api.com";
        console.log("[cutAndMergeVideos] Creating directory...");
        const dirRes = await fetch(`${FFMPEG_API_BASE2}/directory`, {
          method: "POST",
          headers: {
            "Authorization": input.ffmpegApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });
        if (!dirRes.ok) {
          throw new Error(`Failed to create directory: ${dirRes.statusText}`);
        }
        const dirData = await dirRes.json();
        const dirId = dirData.directory.id;
        console.log(`[cutAndMergeVideos] Created directory: ${dirId}`);
        const { uploadVideoToFFmpegAPI: uploadVideoToFFmpegAPI2 } = await Promise.resolve().then(() => (init_videoEditing(), videoEditing_exports));
        const video1Path = await uploadVideoToFFmpegAPI2(input.video1Url, `${input.video1Name}_original.mp4`, input.ffmpegApiKey, dirId);
        const video2Path = await uploadVideoToFFmpegAPI2(input.video2Url, `${input.video2Name}_original.mp4`, input.ffmpegApiKey, dirId);
        console.log(`[cutAndMergeVideos] Uploaded: ${video1Path}, ${video2Path}`);
        console.log("[cutAndMergeVideos] Videos uploaded to FFmpeg API");
        const outputFileName = `merged_${Date.now()}.mp4`;
        const escapedName1 = input.video1Name.replace(/'/g, "\\\\\\'");
        const escapedName2 = input.video2Name.replace(/'/g, "\\\\\\'");
        const drawtext1 = `drawtext=text='${escapedName1}':x=(w-text_w)/2:y=20:fontsize=32:fontcolor=red:font=Arial-Bold:box=1:boxcolor=black@0.7:boxborderw=5`;
        const drawtext2 = `drawtext=text='${escapedName2}':x=(w-text_w)/2:y=20:fontsize=32:fontcolor=red:font=Arial-Bold:box=1:boxcolor=black@0.7:boxborderw=5`;
        const filterComplex = `[0:v]trim=start=${video1Start}:end=${video1End},setpts=PTS-STARTPTS,${drawtext1}[v1];[0:a]atrim=start=${video1Start}:end=${video1End},asetpts=PTS-STARTPTS[a1];[1:v]trim=start=${video2Start}:end=${video2End},setpts=PTS-STARTPTS,${drawtext2}[v2];[1:a]atrim=start=${video2Start}:end=${video2End},asetpts=PTS-STARTPTS[a2];[v1][a1][v2][a2]concat=n=2:v=1:a=1[outv][outa]`;
        console.log("[cutAndMergeVideos] Filter complex:", filterComplex);
        const requestBody = {
          task: {
            inputs: [
              { file_path: video1Path },
              { file_path: video2Path }
            ],
            filter_complex: filterComplex,
            outputs: [{
              file: outputFileName,
              options: [
                "-c:v",
                "libx264",
                "-crf",
                "23",
                "-c:a",
                "aac"
              ],
              maps: ["[outv]", "[outa]"]
            }]
          }
        };
        console.log("[cutAndMergeVideos] FFmpeg API request:", JSON.stringify(requestBody, null, 2));
        const processRes = await fetch(`${FFMPEG_API_BASE2}/ffmpeg/process`, {
          method: "POST",
          headers: {
            "Authorization": input.ffmpegApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        });
        if (!processRes.ok) {
          const errorText = await processRes.text();
          console.error("[FFmpeg API] Error response:", errorText);
          throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
        }
        const result = await processRes.json();
        if (!result.ok || !result.result || result.result.length === 0) {
          throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
        }
        const downloadUrl = result.result[0].download_url;
        console.log(`[cutAndMergeVideos] Merge successful! Temporary URL: ${downloadUrl}`);
        return {
          success: true,
          downloadUrl
          // Return temporary FFmpeg URL (no Bunny upload for test)
        };
      } catch (error) {
        console.error("[cutAndMergeVideos] Error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to cut and merge videos: ${error.message}`
        });
      }
    }),
    // Cut & Merge all videos (sample merge - no DB save)
    cutAndMergeAllVideos: publicProcedure.input(z2.object({
      videos: z2.array(z2.object({
        url: z2.string(),
        name: z2.string(),
        startMs: z2.number(),
        endMs: z2.number(),
        cleanVoiceAudioUrl: z2.string().nullable().optional()
        // Optional CleanVoice audio URL
      })),
      ffmpegApiKey: z2.string()
    })).mutation(async ({ input }) => {
      try {
        console.log(`[cutAndMergeAllVideos] Starting sample merge of ${input.videos.length} videos...`);
        const FFMPEG_API_BASE2 = "https://api.ffmpeg-api.com";
        console.log("[cutAndMergeAllVideos] Creating directory...");
        const dirRes = await fetch(`${FFMPEG_API_BASE2}/directory`, {
          method: "POST",
          headers: {
            "Authorization": input.ffmpegApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });
        if (!dirRes.ok) {
          throw new Error(`Failed to create directory: ${dirRes.statusText}`);
        }
        const dirData = await dirRes.json();
        const dirId = dirData.directory.id;
        console.log(`[cutAndMergeAllVideos] Created directory: ${dirId}`);
        const { uploadVideoToFFmpegAPI: uploadVideoToFFmpegAPI2 } = await Promise.resolve().then(() => (init_videoEditing(), videoEditing_exports));
        const uploadedPaths = [];
        const uploadedAudioPaths = [];
        for (const video of input.videos) {
          const filePath = await uploadVideoToFFmpegAPI2(video.url, `${video.name}_original.mp4`, input.ffmpegApiKey, dirId);
          uploadedPaths.push(filePath);
          console.log(`[cutAndMergeAllVideos] Uploaded: ${video.name} \u2192 ${filePath}`);
          if (video.cleanVoiceAudioUrl) {
            console.log(`[cutAndMergeAllVideos] Uploading cleanVoice audio for ${video.name}...`);
            const audioPath = await uploadVideoToFFmpegAPI2(video.cleanVoiceAudioUrl, `${video.name}_cleanvoice.mp3`, input.ffmpegApiKey, dirId);
            uploadedAudioPaths.push(audioPath);
            console.log(`[cutAndMergeAllVideos] CleanVoice audio uploaded: ${audioPath}`);
          } else {
            uploadedAudioPaths.push(null);
          }
        }
        console.log("[cutAndMergeAllVideos] All videos uploaded to FFmpeg API");
        console.log("[cutAndMergeAllVideos] Building filter_complex...");
        const trimFilters = [];
        const concatInputs = [];
        const audioStartIndex = input.videos.length;
        const videoToAudioInputMap = /* @__PURE__ */ new Map();
        let currentAudioInputIndex = audioStartIndex;
        uploadedAudioPaths.forEach((audioPath, videoIndex) => {
          if (audioPath !== null) {
            videoToAudioInputMap.set(videoIndex, currentAudioInputIndex);
            currentAudioInputIndex++;
          }
        });
        console.log("[cutAndMergeAllVideos] Audio input mapping:", Array.from(videoToAudioInputMap.entries()));
        input.videos.forEach((video, index) => {
          const needsTrim = video.startMs > 0 || video.endMs > 0;
          const hasCleanVoice = uploadedAudioPaths[index] !== null;
          const audioInputIndex = videoToAudioInputMap.get(index);
          if (needsTrim) {
            const startSec = video.startMs / 1e3;
            const endSec = video.endMs / 1e3;
            console.log(`[cutAndMergeAllVideos] Video ${index} (${video.name}): TRIM from ${startSec}s to ${endSec}s, cleanVoice: ${hasCleanVoice}`);
            trimFilters.push(
              `[${index}:v]trim=start=${startSec.toFixed(3)}:end=${endSec.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`
            );
            if (hasCleanVoice) {
              trimFilters.push(
                `[${audioInputIndex}:a]atrim=start=${startSec.toFixed(3)}:end=${endSec.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`
              );
            } else {
              trimFilters.push(
                `[${index}:a]atrim=start=${startSec.toFixed(3)}:end=${endSec.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`
              );
            }
            concatInputs.push(`[v${index}][a${index}]`);
          } else {
            console.log(`[cutAndMergeAllVideos] Video ${index} (${video.name}): NO TRIM (use full video), cleanVoice: ${hasCleanVoice}`);
            if (hasCleanVoice) {
              concatInputs.push(`[${index}:v][${audioInputIndex}:a]`);
            } else {
              concatInputs.push(`[${index}:v][${index}:a]`);
            }
          }
        });
        let filterComplex;
        if (trimFilters.length > 0) {
          filterComplex = trimFilters.join(";") + ";" + concatInputs.join("") + `concat=n=${input.videos.length}:v=1:a=1[outv][outa]`;
        } else {
          filterComplex = concatInputs.join("") + `concat=n=${input.videos.length}:v=1:a=1[outv][outa]`;
        }
        console.log("[cutAndMergeAllVideos] Filter complex:", filterComplex);
        const outputFileName = `sample_merge_${Date.now()}.mp4`;
        const allInputs = [
          ...uploadedPaths.map((path4) => ({ file_path: path4 })),
          // Video inputs
          ...uploadedAudioPaths.filter((path4) => path4 !== null).map((path4) => ({ file_path: path4 }))
          // Audio inputs (only non-null)
        ];
        console.log(`[cutAndMergeAllVideos] Total inputs: ${allInputs.length} (${uploadedPaths.length} videos + ${uploadedAudioPaths.filter((p) => p !== null).length} audio files)`);
        const processRes = await fetch(`${FFMPEG_API_BASE2}/ffmpeg/process`, {
          method: "POST",
          headers: {
            "Authorization": input.ffmpegApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            task: {
              inputs: allInputs,
              filter_complex: filterComplex,
              outputs: [{
                file: outputFileName,
                options: [
                  "-c:v",
                  "libx264",
                  "-crf",
                  "23",
                  "-c:a",
                  "aac",
                  "-b:a",
                  "192k",
                  // 192 kbps audio bitrate
                  "-ar",
                  "48000"
                  // 48 kHz sample rate
                ],
                maps: ["[outv]", "[outa]"]
              }]
            }
          })
        });
        if (!processRes.ok) {
          const errorText = await processRes.text();
          console.error("[FFmpeg API] Error response:", errorText);
          throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
        }
        const result = await processRes.json();
        if (!result.ok || !result.result || result.result.length === 0) {
          throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
        }
        const downloadUrl = result.result[0].download_url;
        console.log(`[cutAndMergeAllVideos] Sample merge successful! Temporary URL: ${downloadUrl}`);
        return {
          success: true,
          downloadUrl
        };
      } catch (error) {
        console.error("[cutAndMergeAllVideos] Error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to cut and merge all videos: ${error.message}`
        });
      }
    }),
    // Save video editing data to context session
    save: publicProcedure.input(z2.object({
      userId: z2.number(),
      coreBeliefId: z2.number(),
      emotionalAngleId: z2.number(),
      adId: z2.number(),
      characterId: z2.number(),
      videoId: z2.string(),
      startKeep: z2.number(),
      endKeep: z2.number(),
      words: z2.any()
    })).mutation(async ({ input }) => {
      try {
        const session = await getContextSession({
          userId: input.userId,
          coreBeliefId: input.coreBeliefId,
          emotionalAngleId: input.emotionalAngleId,
          adId: input.adId,
          characterId: input.characterId
        });
        if (!session) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "Context session not found"
          });
        }
        const videoResults = session.videoResults || [];
        const videoIndex = videoResults.findIndex((v) => v.id === input.videoId);
        if (videoIndex === -1) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "Video not found in session"
          });
        }
        videoResults[videoIndex] = {
          ...videoResults[videoIndex],
          startKeep: input.startKeep,
          endKeep: input.endKeep,
          whisperWords: input.words,
          editStatus: "edited"
        };
        await upsertContextSession({
          userId: input.userId,
          coreBeliefId: input.coreBeliefId,
          emotionalAngleId: input.emotionalAngleId,
          adId: input.adId,
          characterId: input.characterId,
          videoResults
        });
        return { success: true };
      } catch (error) {
        console.error("[videoEditing.save] Error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to save editing data: ${error.message}`
        });
      }
    }),
    // List approved videos for editing
    list: publicProcedure.input(z2.object({
      userId: z2.number(),
      coreBeliefId: z2.number(),
      emotionalAngleId: z2.number(),
      adId: z2.number(),
      characterId: z2.number()
    })).query(async ({ input }) => {
      try {
        const session = await getContextSession(input);
        if (!session) {
          return { videos: [] };
        }
        const videoResults = session.videoResults || [];
        const approvedVideos = videoResults.filter(
          (v) => v.status === "approved"
        );
        return { videos: approvedVideos };
      } catch (error) {
        console.error("[videoEditing.list] Error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list videos: ${error.message}`
        });
      }
    }),
    // Process videos with CleanVoice API (Step 7)
    processWithCleanVoice: publicProcedure.input(z2.object({
      videos: z2.array(z2.object({
        videoUrl: z2.string(),
        videoName: z2.string(),
        videoId: z2.number()
      })),
      userId: z2.number(),
      cleanvoiceApiKey: z2.string()
    })).mutation(async ({ input }) => {
      try {
        const { processVideoWithCleanVoice: processVideoWithCleanVoice2 } = await Promise.resolve().then(() => (init_cleanvoice(), cleanvoice_exports));
        console.log(`[CleanVoice] Processing ${input.videos.length} videos for user ${input.userId}`);
        const results = await Promise.all(
          input.videos.map(async (video) => {
            try {
              console.log(`[CleanVoice] Processing video: ${video.videoName}`);
              const cleanvoiceAudioUrl = await processVideoWithCleanVoice2(
                video.videoUrl,
                video.videoName,
                input.userId,
                input.cleanvoiceApiKey
              );
              return {
                videoId: video.videoId,
                videoName: video.videoName,
                success: true,
                cleanvoiceAudioUrl
              };
            } catch (error) {
              console.error(`[CleanVoice] Error processing ${video.videoName}:`, error);
              return {
                videoId: video.videoId,
                videoName: video.videoName,
                success: false,
                error: error.message
              };
            }
          })
        );
        console.log(`[CleanVoice] Completed processing ${results.filter((r) => r.success).length}/${results.length} videos`);
        return {
          success: true,
          results
        };
      } catch (error) {
        console.error("[CleanVoice] Error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process videos with CleanVoice: ${error.message}`
        });
      }
    }),
    // Merge videos (Step 9 & Step 10)
    // Step 9: useSimpleMerge=true (concat filter + fast re-encode, no loudnorm)
    // Step 10: useSimpleMerge=false (concat filter + re-encode + loudnorm)
    mergeVideos: publicProcedure.input(z2.object({
      videoUrls: z2.array(z2.string()),
      outputVideoName: z2.string(),
      ffmpegApiKey: z2.string(),
      userId: z2.number().optional(),
      folder: z2.string().optional(),
      useSimpleMerge: z2.boolean().optional(),
      // true = Step 9 (fast re-encode), false = Step 10 (re-encode + loudnorm)
      useLoudnorm: z2.boolean().optional()
      // Enable loudnorm audio normalization for Step 10
    })).mutation(async ({ input }) => {
      try {
        console.log(`[mergeVideos] \u{1F680} Starting merge...`);
        console.log(`[mergeVideos] \u{1F4FA} Videos to merge: ${input.videoUrls.length}`);
        console.log(`[mergeVideos] \u{1F3AF} Output name: ${input.outputVideoName}`);
        console.log(`[mergeVideos] \u{1F517} Video URLs:`, input.videoUrls);
        console.log(`[mergeVideos] \u{1F527} Method: ${input.useSimpleMerge ? "SIMPLE (fast re-encode)" : "COMPLEX (re-encode + loudnorm)"}`);
        console.log(`[mergeVideos] \u{1F50A} Loudnorm: ${input.useLoudnorm ? "YES" : "NO"}`);
        let cdnUrl;
        if (input.useSimpleMerge) {
          const { mergeVideosSimple: mergeVideosSimple2 } = await Promise.resolve().then(() => (init_videoEditing(), videoEditing_exports));
          console.log(`[mergeVideos] \u{1F4E4} Calling mergeVideosSimple (Step 9)...`);
          cdnUrl = await mergeVideosSimple2(
            input.videoUrls,
            input.outputVideoName,
            input.ffmpegApiKey,
            input.userId,
            input.folder || "prepare-for-merge"
          );
        } else {
          const { mergeVideosWithFilterComplex: mergeVideosWithFilterComplex2 } = await Promise.resolve().then(() => (init_videoEditing(), videoEditing_exports));
          console.log(`[mergeVideos] \u{1F4E4} Calling mergeVideosWithFilterComplex (Step 10)...`);
          cdnUrl = await mergeVideosWithFilterComplex2(
            input.videoUrls,
            input.outputVideoName,
            input.ffmpegApiKey,
            input.userId,
            input.folder || "merged",
            input.useLoudnorm ?? true
          );
        }
        console.log(`[mergeVideos] \u2705 Merge complete! CDN URL: ${cdnUrl}`);
        return {
          success: true,
          cdnUrl
        };
      } catch (error) {
        console.error("[mergeVideos] \u274C Error:", error);
        console.error("[mergeVideos] \u274C Error stack:", error.stack);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to merge videos: ${error.message}`
        });
      }
    })
  }),
  // Test endpoint to verify audiowaveform installation
  testAudiowaveform: publicProcedure.query(async () => {
    try {
      const { stdout, stderr } = await execAsync("which audiowaveform");
      const versionResult = await execAsync("audiowaveform --version");
      return {
        success: true,
        installed: true,
        path: stdout.trim(),
        version: versionResult.stdout.trim() || versionResult.stderr.trim(),
        message: "audiowaveform is installed and working!"
      };
    } catch (error) {
      return {
        success: false,
        installed: false,
        error: error.message,
        message: "audiowaveform is NOT installed or not in PATH"
      };
    }
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user2 = null;
  try {
    user2 = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user2 = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user: user2
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path3 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path2.resolve(import.meta.dirname),
  root: path2.resolve(import.meta.dirname, "client"),
  publicDir: path2.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path3.resolve(import.meta.dirname, "../..", "dist", "public") : path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.get("/api/proxy-video", async (req, res) => {
    try {
      const videoUrl = req.query.url;
      if (!videoUrl) {
        return res.status(400).json({ error: "Missing url parameter" });
      }
      console.log("[Video Proxy] Streaming video:", videoUrl);
      const response = await fetch(videoUrl);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch video: ${response.status}` });
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      const contentType = response.headers.get("content-type") || "video/mp4";
      res.setHeader("Content-Type", contentType);
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      res.setHeader("Accept-Ranges", "bytes");
      if (response.body) {
        for await (const chunk of response.body) {
          res.write(chunk);
        }
      }
      res.end();
    } catch (error) {
      console.error("[Video Proxy] Error:", error);
      res.status(500).json({ error: `Failed to proxy video: ${error.message}` });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}
startServer().catch(console.error);
