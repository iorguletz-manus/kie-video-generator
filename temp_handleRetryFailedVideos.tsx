  // Manual retry for failed videos
  const handleRetryFailedVideos = async () => {
    const failedVideos = trimmingProgress.failedVideos;
    
    if (failedVideos.length === 0) {
      toast.error('No failed videos to retry!');
      return;
    }
    
    console.log(`[Retry] Starting manual retry for ${failedVideos.length} failed videos...`);
    
    // Update status to processing
    setTrimmingProgress(prev => ({
      ...prev,
      status: 'processing',
      message: `Retrying ${failedVideos.length} failed videos...`
    }));
    
    // Process each failed video
    for (const failedVideo of failedVideos) {
      // Find the actual video object from videoResults
      const video = videoResults.find(v => v.videoName === failedVideo.name);
      
      if (!video) {
        console.error(`[Retry] Video not found: ${failedVideo.name}`);
        continue;
      }
      
      // Mark as retrying
      setTrimmingProgress(prev => ({
        ...prev,
        failedVideos: prev.failedVideos.map(v =>
          v.name === failedVideo.name
            ? { ...v, status: 'retrying', error: '' }
            : v
        ),
        message: `Retrying ${failedVideo.name}...`
      }));
      
      try {
        const trimStart = video.cutPoints?.startKeep || 0;
        const trimEnd = video.cutPoints?.endKeep || 0;
        
        console.log(`[Retry] Processing ${video.videoName}...`);
        
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
        
        // SUCCESS - Move from failed to success list
        console.log(`[Retry] ✅ ${video.videoName} SUCCESS`);
        
        setTrimmingProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          successVideos: [...prev.successVideos, { name: video.videoName }],
          failedVideos: prev.failedVideos.filter(v => v.name !== video.videoName)
        }));
        
      } catch (error: any) {
        // FAILED AGAIN - Update error message
        console.error(`[Retry] ❌ ${video.videoName} FAILED:`, error);
        
        setTrimmingProgress(prev => ({
          ...prev,
          failedVideos: prev.failedVideos.map(v =>
            v.name === video.videoName
              ? { 
                  ...v, 
                  status: undefined,
                  error: error.message || 'Unknown error',
                  retries: (v.retries || 0) + 1
                }
              : v
          )
        }));
      }
    }
    
    // Final status
    const successCount = trimmingProgress.successVideos.length;
    const failCount = trimmingProgress.failedVideos.length;
    const finalStatus = failCount > 0 ? 'partial' : 'complete';
    
    setTrimmingProgress(prev => ({
      ...prev,
      status: finalStatus,
      message: failCount > 0 
        ? `⚠️ ${successCount} succeeded, ${failCount} still failed`
        : `✅ All videos trimmed successfully!`
    }));
    
    console.log(`[Retry] COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
    
    // Save updated videoResults to database
    if (successCount > 0) {
      console.log('[Retry] 💾 Saving trimmedVideoUrl to database...');
      try {
        await upsertContextSessionMutation.mutateAsync({
          userId: localCurrentUser.id,
          coreBeliefId: selectedCoreBelief!,
          emotionalAngleId: selectedEmotionalAngle!,
          adId: selectedAd!,
          characterId: selectedCharacter!,
          videoResults: videoResults,
        });
        console.log('[Retry] ✅ Database save successful!');
      } catch (error) {
        console.error('[Retry] ❌ Database save failed:', error);
        toast.error('Failed to save trimmed videos to database');
      }
    }
  };
