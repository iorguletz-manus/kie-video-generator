// NEW BATCH PROCESSING WITH SMART FFMPEG RATE LIMITING
// This file contains the new batchProcessVideosWithWhisper function
// to be integrated into Home.tsx

const batchProcessVideosWithWhisper = async (videos: VideoResult[]) => {
  console.log('[Batch Processing] 🚀 Starting SMART processing with', videos.length, 'videos');
  
  let ffmpegCompletedCount = 0;
  let whisperCompletedCount = 0;
  let activeFfmpegRequests = 0;  // Track LIVE FFmpeg requests
  const MAX_FFMPEG_CONCURRENT = 10;  // Max 10 FFmpeg requests at once
  const BATCH_SIZE = 5;  // Wait for 5 to complete before sending more
  const DELAY_AFTER_BATCH = 3000;  // 3 seconds delay after receiving 5
  
  // Collect all results
  const resultsMap = new Map<string, any>();
  
  // Helper: Process single video with retry
  const processVideoWithRetry = async (video: VideoResult, retries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[Batch Processing] 🎬 ${video.videoName} - Attempt ${attempt}/${retries}`);
        console.log(`[Batch Processing] 📊 Active FFmpeg requests: ${activeFfmpegRequests}/${MAX_FFMPEG_CONCURRENT}`);
        
        // Extract red text
        const hasRedText = video.redStart !== undefined && 
                          video.redEnd !== undefined && 
                          video.redStart >= 0 && 
                          video.redEnd > video.redStart;
        
        const redText = hasRedText
          ? video.text.substring(video.redStart, video.redEnd)
          : '';
        
        const textLength = video.text.length;
        const redTextPosition: 'START' | 'END' | undefined = hasRedText
          ? ((video.redEnd || 0) >= textLength - 10 ? 'END' : 'START')
          : undefined;
        
        if (!hasRedText || !redText) {
          console.log(`[Batch Processing] ⚪ ${video.videoName} - No red text, processing as white-text-only`);
        }
        
        // Increment active FFmpeg counter BEFORE request
        activeFfmpegRequests++;
        setProcessingStep('extract');
        
        // Process with FFmpeg + Whisper
        const result = await processVideoForEditingMutation.mutateAsync({
          videoUrl: video.videoUrl!,
          videoId: parseInt(video.id || '0'),
          videoName: video.videoName,
          fullText: video.text,
          redText: redText,
          redTextPosition: redTextPosition,
          marginMs: 50,
          userApiKey: localCurrentUser.openaiApiKey || undefined,
          ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined,
        });
        
        // Decrement active FFmpeg counter AFTER response
        activeFfmpegRequests--;
        
        // Update FFmpeg progress (audio extraction complete)
        ffmpegCompletedCount++;
        setProcessingProgress(prev => ({ 
          ...prev,
          ffmpeg: { current: ffmpegCompletedCount, total: videos.length },
          currentVideoName: video.videoName 
        }));
        
        // Update Whisper progress (transcription complete)
        whisperCompletedCount++;
        setProcessingProgress(prev => ({ 
          ...prev,
          whisper: { current: whisperCompletedCount, total: videos.length },
          currentVideoName: video.videoName 
        }));
        
        console.log(`[Batch Processing] ✅ ${video.videoName} - Success!`);
        console.log(`[Batch Processing] 📊 Progress: FFmpeg ${ffmpegCompletedCount}/${videos.length}, Whisper ${whisperCompletedCount}/${videos.length}`);
        
        return {
          videoName: video.videoName,
          success: true,
          result: {
            whisperTranscript: result.whisperTranscript,
            cutPoints: result.cutPoints,
            words: result.words,
            audioUrl: result.audioUrl,
            waveformData: result.waveformJson,
            editingDebugInfo: result.editingDebugInfo,
            noCutNeeded: false,
          }
        };
      } catch (error: any) {
        // Decrement counter on error
        activeFfmpegRequests--;
        
        console.error(`[Batch Processing] ❌ ${video.videoName} - Attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          console.error(`[Batch Processing] 🚫 ${video.videoName} - All ${retries} attempts failed`);
          
          // Update progress even on failure
          ffmpegCompletedCount++;
          whisperCompletedCount++;
          setProcessingProgress(prev => ({ 
            ...prev,
            ffmpeg: { current: ffmpegCompletedCount, total: videos.length },
            whisper: { current: whisperCompletedCount, total: videos.length },
            currentVideoName: video.videoName 
          }));
          
          return {
            videoName: video.videoName,
            success: false,
            error: error.message
          };
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  };
  
  // SMART PROCESSING QUEUE
  const processQueueSmart = async (): Promise<any[]> => {
    const results: any[] = [];
    let currentIndex = 0;
    const pendingPromises: Promise<any>[] = [];
    
    console.log('[Batch Processing] 🚀 Phase 1: Sending first 10 videos...');
    
    // Phase 1: Send first 10 videos
    while (currentIndex < Math.min(MAX_FFMPEG_CONCURRENT, videos.length)) {
      const video = videos[currentIndex];
      const promise = processVideoWithRetry(video)
        .then(result => {
          results[currentIndex] = result;
          return result;
        });
      pendingPromises.push(promise);
      currentIndex++;
    }
    
    // Phase 2: Wait for batches and send more
    while (currentIndex < videos.length || pendingPromises.length > 0) {
      // Wait for BATCH_SIZE videos to complete (or all remaining if less than BATCH_SIZE)
      const batchToWait = Math.min(BATCH_SIZE, pendingPromises.length);
      
      if (batchToWait > 0) {
        console.log(`[Batch Processing] ⏳ Waiting for ${batchToWait} videos to complete...`);
        
        // Wait for the first BATCH_SIZE promises to resolve
        const completedBatch = await Promise.race([
          Promise.all(pendingPromises.slice(0, batchToWait)),
          new Promise(resolve => setTimeout(resolve, 60000)) // 60s timeout
        ]);
        
        // Remove completed promises from pending
        pendingPromises.splice(0, batchToWait);
        
        console.log(`[Batch Processing] ✅ Batch of ${batchToWait} completed!`);
        console.log(`[Batch Processing] 📊 Active FFmpeg requests: ${activeFfmpegRequests}/${MAX_FFMPEG_CONCURRENT}`);
        
        // Delay 3 seconds before sending next batch
        if (currentIndex < videos.length) {
          console.log(`[Batch Processing] ⏱️  Waiting 3 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_BATCH));
          
          // Send next BATCH_SIZE videos
          const nextBatchSize = Math.min(BATCH_SIZE, videos.length - currentIndex);
          console.log(`[Batch Processing] 🚀 Sending next ${nextBatchSize} videos...`);
          
          for (let i = 0; i < nextBatchSize; i++) {
            const video = videos[currentIndex];
            const index = currentIndex;
            const promise = processVideoWithRetry(video)
              .then(result => {
                results[index] = result;
                return result;
              });
            pendingPromises.push(promise);
            currentIndex++;
          }
        }
      } else {
        // No more pending, exit
        break;
      }
    }
    
    console.log('[Batch Processing] 🎉 All videos processed!');
    return results;
  };
  
  // Start smart processing
  setProcessingStep('extract');
  const allResults = await processQueueSmart();
  
  // Count successes and failures
  let successCount = 0;
  let failCount = 0;
  
  for (const result of allResults) {
    if (result && result.success) {
      successCount++;
      resultsMap.set(result.videoName, result.result);
    } else {
      failCount++;
      if (result) {
        toast.error(`❌ ${result.videoName}: ${result.error}`);
      }
    }
  }
  
  console.log(`[Batch Processing] 📊 Final results: ${successCount} success, ${failCount} failed`);
  
  return resultsMap;
};
