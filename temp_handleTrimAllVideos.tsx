  // Step 8 → Step 9: Trim all videos using FFMPEG API
  const handleTrimAllVideos = async () => {
    // Check if we have trimmed videos (Step 9 exists)
    const hasTrimmedVideos = videoResults.some(v => v.trimmedVideoUrl);
    
    let videosToTrim;
    
    if (hasTrimmedVideos) {
      // Scenario 2: We've been to Step 9, trim videos with "recut" status OR failed videos (trimmedVideoUrl === null)
      videosToTrim = videoResults.filter(v => 
        v.reviewStatus === 'accepted' && 
        v.status === 'success' && 
        v.videoUrl &&
        (!v.trimmedVideoUrl || v.recutStatus === 'recut') // Failed videos OR recut videos
      );
    } else {
      // Scenario 1: First time, trim all approved videos
      videosToTrim = videoResults.filter(v => 
        v.reviewStatus === 'accepted' && 
        v.status === 'success' && 
        v.videoUrl
      );
    }
    
    if (videosToTrim.length === 0) {
      if (hasTrimmedVideos) {
        // Check if all recut videos are already trimmed
        const recutVideos = videoResults.filter(v => 
          v.reviewStatus === 'accepted' && 
          v.status === 'success' && 
          v.recutStatus === 'recut'
        );
        const allRecutTrimmed = recutVideos.every(v => v.trimmedVideoUrl);
        
        if (allRecutTrimmed && recutVideos.length > 0) {
          toast.success('✅ Toate videourile sunt deja tăiate! Redirectăm către Step 9...', { duration: 3000 });
          setIsTrimmingModalOpen(false);
          // Auto-redirect with countdown
          let countdown = 3;
          const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown === 0) {
              clearInterval(countdownInterval);
              setCurrentStep(9);
            }
          }, 1000);
          return;
        } else {
          toast.error('Nu există videouri cu status "Recut" pentru tăiere!');
        }
      } else {
        toast.error('Nu există videouri pentru tăiere!');
      }
      setIsTrimmingModalOpen(false);
      return;
    }
    
    // Validate that all videos have START and END locked
    const unlockedVideos = videosToTrim.filter(v => 
      !v.isStartLocked || !v.isEndLocked
    );
    
    if (unlockedVideos.length > 0) {
      const unlockedNames = unlockedVideos.map(v => v.videoName).join('\n');
      
      toast.error(
        `❌ Următoarele videouri nu sunt locked:\n\n${unlockedNames}\n\nTe rog să blochezi START și END pentru toate videourile înainte de trimming!`,
        { duration: 8000 }
      );
      setIsTrimmingModalOpen(false);
      return;
    }
    
    console.log('[Trimming] Starting SIMPLE batch process for', videosToTrim.length, 'videos (10 per batch, 65s wait)');
    
    // SIMPLE BATCH PROCESSING: 10 at once → wait 65s → next 10 → wait 65s → rest
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 65000; // 65 seconds
    
    // Open modal immediately
    setIsTrimmingModalOpen(true);
    setTrimmingProgress({
      current: 0,
      total: videosToTrim.length,
      currentVideo: '',
      status: 'processing',
      message: 'Starting...',
      successVideos: [],
      failedVideos: [],
      inProgressVideos: []
    });
    
    // Process videos in batches
    let currentIndex = 0;
    let batchNumber = 1;
    
    while (currentIndex < videosToTrim.length) {
      const batchEnd = Math.min(currentIndex + BATCH_SIZE, videosToTrim.length);
      const batchVideos = videosToTrim.slice(currentIndex, batchEnd);
      
      console.log(`[Trimming] 📦 Batch ${batchNumber}: Processing ${batchVideos.length} videos (${currentIndex + 1}-${batchEnd})...`);
      
      // Process all videos in this batch IN PARALLEL
      const batchPromises = batchVideos.map(async (video) => {
        const videoIndex = videosToTrim.indexOf(video);
        
        // Update progress: add to in-progress list
        setTrimmingProgress(prev => ({
          ...prev,
          inProgressVideos: [...prev.inProgressVideos, { name: video.videoName }],
          message: `Processing batch ${batchNumber}...`
        }));
        
        try {
          const trimStart = video.cutPoints?.startKeep || 0;
          const trimEnd = video.cutPoints?.endKeep || 0;
          
          console.log(`[Trimming] Processing ${video.videoName} (${videoIndex + 1}/${videosToTrim.length})`);
          
          const result = await cutVideoMutation.mutateAsync({
            userId: localCurrentUser.id,
            videoUrl: video.videoUrl!,
            videoName: video.videoName,
            startTimeMs: trimStart,
            endTimeMs: trimEnd,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined,
            cleanVoiceAudioUrl: video.cleanvoiceAudioUrl || undefined
          });
          
          if (!result.success || !result.downloadUrl) {
            throw new Error('Failed to trim video');
          }
          
          // Update videoResults with trimmed URL
          setVideoResults(prev => prev.map(v =>
            v.videoName === video.videoName
              ? { 
                  ...v, 
                  trimmedVideoUrl: result.downloadUrl,
                  recutStatus: 'accepted'
                }
              : v
          ));
          
          // SUCCESS
          console.log(`[Trimming] ✅ ${video.videoName} SUCCESS`);
          
          setTrimmingProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            successVideos: [...prev.successVideos, { name: video.videoName }],
            inProgressVideos: prev.inProgressVideos.filter(v => v.name !== video.videoName)
          }));
          
          return { video, status: 'success' };
          
        } catch (error: any) {
          // FAILED
          console.error(`[Trimming] ❌ ${video.videoName} FAILED:`, error);
          
          setTrimmingProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            failedVideos: [...prev.failedVideos, {
              name: video.videoName,
              error: error.message || 'Unknown error',
              retries: 0
            }],
            inProgressVideos: prev.inProgressVideos.filter(v => v.name !== video.videoName)
          }));
          
          return { video, status: 'failed', error: error.message };
        }
      });
      
      // Wait for ALL videos in this batch to complete
      await Promise.all(batchPromises);
      
      console.log(`[Trimming] ✅ Batch ${batchNumber} complete!`);
      
      // Move to next batch
      currentIndex = batchEnd;
      batchNumber++;
      
      // Wait 65s before next batch (if there are more videos)
      if (currentIndex < videosToTrim.length) {
        console.log(`[Trimming] ⏳ Waiting 65 seconds before batch ${batchNumber}...`);
        
        // Countdown timer: 65s → 64s → 63s → ... → 1s
        for (let countdown = 65; countdown > 0; countdown--) {
          setTrimmingProgress(prev => ({
            ...prev,
            message: `⏳ Waiting ${countdown}s before next batch (FFmpeg rate limit)...`,
            status: 'processing'
          }));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('[Trimming] 🎉 All batches processed!');
    
    // Final status
    const successCount = trimmingProgress.successVideos.length;
    const failCount = trimmingProgress.failedVideos.length;
    const finalStatus = failCount > 0 ? 'partial' : 'complete';
    
    setTrimmingProgress(prev => ({
      ...prev,
      status: finalStatus,
      message: failCount > 0 
        ? `⚠️ ${successCount} succeeded, ${failCount} failed`
        : `✅ All ${successCount} videos trimmed successfully!`
    }));
    
    console.log(`[Trimming] 🎉 COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
    
    // Save updated videoResults to database (only successful ones)
    if (successCount > 0) {
      console.log('[Trimming] 💾 Saving trimmedVideoUrl to database...');
      try {
        await upsertContextSessionMutation.mutateAsync({
          userId: localCurrentUser.id,
          coreBeliefId: selectedCoreBelief!,
          emotionalAngleId: selectedEmotionalAngle!,
          adId: selectedAd!,
          characterId: selectedCharacter!,
          videoResults: videoResults,
        });
        console.log('[Trimming] ✅ Database save successful!');
      } catch (error) {
        console.error('[Trimming] ❌ Database save failed:', error);
        toast.error('Failed to save trimmed videos to database');
      }
    }
    
    // DO NOT auto-redirect - user must click button in modal
  };
