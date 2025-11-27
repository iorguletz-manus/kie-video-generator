import axios from 'axios';

const CLEANVOICE_API_BASE = 'https://api.cleanvoice.ai/v2';

interface CleanVoiceConfig {
  video: boolean;
  send_email?: boolean;
  long_silences?: boolean;
  stutters?: boolean;
  fillers?: boolean;
  mouth_sounds?: boolean;
  hesitations?: boolean;
  muted?: boolean;
  remove_noise?: boolean;
  keep_music?: boolean;
  breath?: boolean | 'natural' | 'legacy';
  normalize?: boolean;
  studio_sound?: 'false' | 'true' | 'nightly';
  export_format?: 'auto' | 'mp3' | 'wav' | 'flac' | 'm4a';
}

interface CleanVoiceEditResponse {
  id: string;
}

interface CleanVoiceStatusResponse {
  status: 'PENDING' | 'STARTED' | 'EDITING' | 'EXPORT' | 'SUCCESS' | 'FAILURE';
  result?: {
    video: boolean;
    filename: string;
    download_url?: string;
    statistics?: any;
    summarization?: any[];
    transcription?: any[];
    social_content?: any[];
    waveform_result?: any[];
    merged_audio_url?: any[];
    timestamps_markers_urls?: any[];
  };
  task_id: string;
  error?: string;
}

/**
 * Submit a video to CleanVoice for audio processing
 */
export async function submitToCleanVoice(
  videoUrl: string,
  apiKey: string
): Promise<string> {
  const config: CleanVoiceConfig = {
    video: false,           // Extract audio only (not video)
    export_format: 'mp3',   // MP3 format (compressed, faster download)
    breath: 'mute',         // Mute breaths
    normalize: true,        // Normalize audio levels
    remove_noise: true,     // Remove background noise
    studio_sound: 'nightly', // Apply studio processing
  };

  console.log(`[CleanVoice] Submitting video: ${videoUrl}`);
  console.log(`[CleanVoice] Config:`, JSON.stringify(config, null, 2));

  const response = await axios.post<CleanVoiceEditResponse>(
    `${CLEANVOICE_API_BASE}/edits`,
    {
      input: {
        files: [videoUrl],
        config,  // Config must be inside input object
      },
    },
    {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`[CleanVoice] Edit created with ID: ${response.data.id}`);
  return response.data.id;
}

/**
 * Check status of a CleanVoice edit
 */
export async function getCleanVoiceStatus(
  editId: string,
  apiKey: string
): Promise<CleanVoiceStatusResponse> {
  const response = await axios.get<CleanVoiceStatusResponse>(
    `${CLEANVOICE_API_BASE}/edits/${editId}`,
    {
      headers: {
        'X-Api-Key': apiKey,
      },
    }
  );

  return response.data;
}

/**
 * Poll CleanVoice status until completion or failure
 */
export async function pollCleanVoiceStatus(
  editId: string,
  apiKey: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<CleanVoiceStatusResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getCleanVoiceStatus(editId, apiKey);
    
    console.log(`[CleanVoice] Edit ${editId} status: ${status.status} (attempt ${i + 1}/${maxAttempts})`);

    if (status.status === 'SUCCESS' || status.status === 'FAILURE') {
      console.log(`[CleanVoice] FULL RESPONSE:`, JSON.stringify(status, null, 2));
      return status;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`CleanVoice processing timed out after ${maxAttempts} attempts`);
}

/**
 * Download audio from CleanVoice and upload to Bunny CDN
 */
export async function downloadAndUploadCleanVoiceAudio(
  downloadUrl: string,
  videoName: string,
  userId: number
): Promise<string> {
  console.log(`[CleanVoice] Downloading audio from: ${downloadUrl}`);

  // Download audio file
  const response = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
  });

  const audioBuffer = Buffer.from(response.data);
  
  // Use new path structure: user-{userId}/audio/{fileName}
  const { generateAudioPath } = await import('./storageHelpers');
  const fileName = generateAudioPath(userId, videoName);

  console.log(`[CleanVoice] Uploading to Bunny CDN: ${fileName}`);

  // Upload to Bunny CDN
  const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
  const BUNNYCDN_STORAGE_ZONE = 'manus-storage';
  const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net';

  const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${fileName}`;

  const uploadResponse = await axios.put(storageUrl, audioBuffer, {
    headers: {
      'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
      'Content-Type': 'audio/mpeg',
    },
  });

  if (uploadResponse.status !== 201) {
    throw new Error(`Failed to upload to Bunny CDN: ${uploadResponse.status}`);
  }

  const cdnUrl = `${BUNNYCDN_PULL_ZONE_URL}/${fileName}`;

  console.log(`[CleanVoice] Audio uploaded successfully: ${cdnUrl}`);
  return cdnUrl;
}

/**
 * Process a single video with CleanVoice (submit + poll + download + upload)
 */
export async function processVideoWithCleanVoice(
  videoUrl: string,
  videoName: string,
  userId: number,
  apiKey: string
): Promise<string> {
  // Submit to CleanVoice
  const editId = await submitToCleanVoice(videoUrl, apiKey);

  // Poll until complete
  const result = await pollCleanVoiceStatus(editId, apiKey);

  if (result.status === 'FAILURE') {
    throw new Error(`CleanVoice processing failed: ${result.error || 'Unknown error'}`);
  }

  if (!result.result?.download_url) {
    throw new Error('CleanVoice processing succeeded but no download URL provided');
  }

  // Download and upload to Bunny CDN
  const cleanvoiceAudioUrl = await downloadAndUploadCleanVoiceAudio(
    result.result.download_url,
    videoName,
    userId
  );

  return cleanvoiceAudioUrl;
}
