// Batch processing logic for trimming videos
// Max 10 parallel, retry on fail, don't close until all done

const MAX_PARALLEL = 10;
const MAX_RETRIES = 3;

interface TrimJob {
  video: VideoResult;
  retries: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
}

async function handleTrimAllVideosWithBatch() {
  // ... (existing validation code) ...
  
  // Create job queue
  const jobs: TrimJob[] = videosToTrim.map(video => ({
    video,
    retries: 0,
    status: 'pending' as const
  }));
  
  let successCount = 0;
  let failCount = 0;
  let activeJobs = 0;
  
  const processJob = async (job: TrimJob): Promise<void> => {
    if (job.status === 'success') return;
    
    job.status = 'processing';
    activeJobs++;
    
    // Update progress
    const completedCount = successCount + failCount;
    setTrimmingProgress({
      current: completedCount,
      total: videosToTrim.length,
      currentVideo: job.video.videoName,
      status: 'processing',
      message: `Trimming video ${completedCount + 1}/${videosToTrim.length}...`
    });
    
    try {
      const trimStart = job.video.cutPoints?.startKeep || 0;
      const trimEnd = job.video.cutPoints?.endKeep || 0;
      
      const result = await cutVideoMutation.mutateAsync({
        videoUrl: job.video.videoUrl!,
        videoName: job.video.videoName,
        startTimeMs: trimStart,
        endTimeMs: trimEnd,
        ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined
      });
      
      if (!result.success || !result.downloadUrl) {
        throw new Error('Failed to trim video');
      }
      
      // Update video with trimmed URL
      setVideoResults(prev => prev.map(v =>
        v.videoName === job.video.videoName
          ? { ...v, trimmedVideoUrl: result.downloadUrl }
          : v
      ));
      
      job.status = 'success';
      successCount++;
      console.log(`[Trimming] ✅ ${job.video.videoName} SUCCESS`);
      
    } catch (error: any) {
      console.error(`[Trimming] ❌ ${job.video.videoName} FAILED (attempt ${job.retries + 1}):`, error);
      
      // Retry logic
      if (job.retries < MAX_RETRIES) {
        job.retries++;
        job.status = 'pending';  // Retry
        console.log(`[Trimming] 🔄 Retrying ${job.video.videoName} (${job.retries}/${MAX_RETRIES})...`);
      } else {
        job.status = 'failed';
        job.error = error.message;
        failCount++;
        toast.error(`❌ ${job.video.videoName}: ${error.message} (failed after ${MAX_RETRIES} retries)`);
      }
    } finally {
      activeJobs--;
    }
  };
  
  // Process jobs with max parallelism
  const processQueue = async () => {
    while (true) {
      // Find pending jobs
      const pendingJobs = jobs.filter(j => j.status === 'pending');
      
      // If no pending jobs and no active jobs, we're done
      if (pendingJobs.length === 0 && activeJobs === 0) break;
      
      // Start new jobs up to MAX_PARALLEL
      while (pendingJobs.length > 0 && activeJobs < MAX_PARALLEL) {
        const job = pendingJobs.shift()!;
        processJob(job);  // Fire and forget (don't await)
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  
  // Start processing
  await processQueue();
  
  // Complete
  setTrimmingProgress({
    current: videosToTrim.length,
    total: videosToTrim.length,
    currentVideo: '',
    status: 'complete',
    message: `✅ Complete! Success: ${successCount}, Failed: ${failCount}`
  });
  
  console.log(`[Trimming] 🎉 COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
  toast.success(`✂️ Trimming complete! ${successCount}/${videosToTrim.length} videos trimmed`);
  
  // Navigate to Step 9 after 2 seconds
  setTimeout(() => {
    setIsTrimmingModalOpen(false);
    setCurrentStep(9);
  }, 2000);
}
