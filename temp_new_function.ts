// STEP 2: Prepare for Merge - NEW SIMPLE LOGIC
// 1 batch = max 10 FINAL VIDEOS (regardless of input count)
// BODY = 1 final video, each HOOK group = 1 final video
const handlePrepareForMerge = async () => {
  console.log('[STEP 2] 🚀 Starting NEW merge process...');
  
  // 1. Filter trimmed videos
  const trimmedVideos = videoResults.filter(v => 
    v.trimmedVideoUrl &&
    v.reviewStatus === 'accepted' && 
    v.status === 'success'
  );
  
  if (trimmedVideos.length === 0) {
    toast.error('No trimmed videos to merge!');
    setIsMergingStep10(false);
    return;
  }
  
  console.log('[STEP 2] 📋 Trimmed videos:', trimmedVideos.length);
  
  // 2. Separate BODY and HOOKS
  const bodyVideos = trimmedVideos.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
  const hookVideos = trimmedVideos.filter(v => v.videoName.match(/HOOK\d+[A-Z]?/));
  
  // 3. Group HOOKS by base name
  const hookGroups: Record<string, typeof hookVideos> = {};
  hookVideos.forEach(video => {
    const hookMatch = video.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/);
    if (hookMatch) {
      const prefix = hookMatch[1];
      const hookBase = hookMatch[2];
      const suffix = hookMatch[3];
      const groupKey = `${prefix}${hookBase}${suffix}`;
      
      if (!hookGroups[groupKey]) {
        hookGroups[groupKey] = [];
      }
      hookGroups[groupKey].push(video);
    }
  });
  
  const hookGroupsToMerge = Object.entries(hookGroups).filter(([_, videos]) => videos.length > 1);
  
  console.log('[STEP 2] 📺 BODY videos:', bodyVideos.length);
  console.log('[STEP 2] 🎣 HOOK groups:', hookGroupsToMerge.length);
  
  // 4. Create list of ALL merge tasks (BODY + HOOKS)
  interface MergeTask {
    type: 'body' | 'hook';
    name: string;
    videos: typeof trimmedVideos;
  }
  
  const mergeTasks: MergeTask[] = [];
  
  // Add BODY task (if exists)
  if (bodyVideos.length > 0) {
    mergeTasks.push({
      type: 'body',
      name: 'BODY',
      videos: bodyVideos
    });
  }
  
  // Add HOOK tasks
  hookGroupsToMerge.forEach(([baseName, videos]) => {
    mergeTasks.push({
      type: 'hook',
      name: baseName,
      videos
    });
  });
  
  const totalFinalVideos = mergeTasks.length;
  console.log('[STEP 2] 📊 Total final videos to create:', totalFinalVideos);
  
  if (totalFinalVideos === 0) {
    toast.info('No videos need merging!');
    setIsMergingStep10(false);
    return;
  }
  
  // 5. Create batches (max 10 final videos per batch)
  const MAX_FINAL_VIDEOS_PER_BATCH = 10;
  const batches: MergeTask[][] = [];
  
  for (let i = 0; i < mergeTasks.length; i += MAX_FINAL_VIDEOS_PER_BATCH) {
    batches.push(mergeTasks.slice(i, i + MAX_FINAL_VIDEOS_PER_BATCH));
  }
  
  console.log('[STEP 2] 📦 Batches:', batches.length);
  batches.forEach((batch, idx) => {
    console.log(`  Batch ${idx + 1}: ${batch.length} final videos (${batch.map(t => t.name).join(', ')})`);
  });
  
  // 6. Initialize progress
  setMergeStep10Progress({
    status: 'countdown',
    message: 'Waiting 60s before starting...',
    countdown: 60,
    totalFinalVideos,
    currentFinalVideo: 0,
    currentBatch: 0,
    totalBatches: batches.length,
    successTasks: [],
    failedTasks: [],
    inProgressTask: null,
    onSkipCountdown: undefined // Will be set below
  });
  
  // 7. INITIAL COUNTDOWN: 60s with Skip button
  console.log('[STEP 2] ⏳ Initial countdown 60s...');
  let skipCountdown = false;
  
  setMergeStep10Progress(prev => ({
    ...prev,
    onSkipCountdown: () => {
      console.log('[STEP 2] ⏩ User skipped countdown!');
      skipCountdown = true;
    }
  }));
  
  for (let countdown = 60; countdown > 0; countdown--) {
    if (skipCountdown) {
      console.log('[STEP 2] ⏩ Countdown skipped!');
      break;
    }
    
    setMergeStep10Progress(prev => ({
      ...prev,
      countdown,
      message: `Waiting ${countdown}s before starting...`
    }));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Clear countdown
  setMergeStep10Progress(prev => ({
    ...prev,
    status: 'processing',
    countdown: 0,
    onSkipCountdown: undefined,
    message: 'Starting merge process...'
  }));
  
  console.log('[STEP 2] 🚀 Starting merge...');
  
  // 8. Process batches sequentially
  try {
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const batchNum = batchIdx + 1;
      
      console.log(`[STEP 2] 📦 Processing batch ${batchNum}/${batches.length} (${batch.length} final videos)...`);
      
      setMergeStep10Progress(prev => ({
        ...prev,
        currentBatch: batchNum,
        message: `Processing batch ${batchNum}/${batches.length}...`
      }));
      
      // Process all tasks in this batch in parallel
      const batchPromises = batch.map(async (task) => {
        console.log(`[STEP 2] 🔄 Merging ${task.name} (${task.videos.length} videos)...`);
        
        setMergeStep10Progress(prev => ({
          ...prev,
          inProgressTask: task.name
        }));
        
        try {
          const videoUrls = task.videos.map(v => extractOriginalUrl(v.trimmedVideoUrl!)).filter(Boolean);
          
          console.log(`[STEP 2] 📹 ${task.name} URLs:`, videoUrls);
          
          // Call merge API
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls,
            outputName: task.name,
            addTextOverlay: false,
            userId: localCurrentUser.id,
          });
          
          console.log(`[STEP 2] ✅ ${task.name} SUCCESS:`, result.cdnUrl);
          
          setMergeStep10Progress(prev => ({
            ...prev,
            successTasks: [...prev.successTasks, { name: task.name, url: result.cdnUrl }],
            currentFinalVideo: prev.currentFinalVideo + 1
          }));
          
          // Save to database
          if (task.type === 'body') {
            await updateProjectMutation.mutateAsync({
              id: currentProject!.id,
              bodyMergedVideoUrl: result.cdnUrl,
            });
            console.log(`[STEP 2] 💾 BODY saved to database`);
          } else {
            // Hook - update all videos in group
            for (const video of task.videos) {
              await updateVideoResultMutation.mutateAsync({
                id: video.id,
                hookMergedVideoUrl: result.cdnUrl,
                bodyMergedVideoUrl: currentProject?.bodyMergedVideoUrl || null,
              });
            }
            console.log(`[STEP 2] 💾 ${task.name} saved to database`);
          }
          
          return { task, status: 'success', url: result.cdnUrl };
          
        } catch (error: any) {
          console.error(`[STEP 2] ❌ ${task.name} FAILED:`, error);
          
          setMergeStep10Progress(prev => ({
            ...prev,
            failedTasks: [...prev.failedTasks, { name: task.name, error: error.message }],
            currentFinalVideo: prev.currentFinalVideo + 1
          }));
          
          return { task, status: 'failed', error: error.message };
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait 60s AFTER batch (except last batch)
      if (batchIdx < batches.length - 1) {
        console.log(`[STEP 2] ⏳ Waiting 60s after batch ${batchNum}...`);
        for (let countdown = 60; countdown >= 0; countdown--) {
          setMergeStep10Progress(prev => ({
            ...prev,
            message: `⏳ Waiting ${countdown}s before next batch...`,
            countdown
          }));
          if (countdown > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        console.log(`[STEP 2] ✅ Wait complete, starting next batch...`);
      }
    }
    
    // Complete
    const failedCount = mergeStep10Progress.failedTasks.length;
    setMergeStep10Progress(prev => ({
      ...prev,
      status: failedCount === 0 ? 'complete' : 'partial',
      message: failedCount === 0 
        ? `✅ All ${totalFinalVideos} merges complete!`
        : `⚠️ ${totalFinalVideos - failedCount}/${totalFinalVideos} merges complete (${failedCount} failed)`
    }));
    
    console.log('[STEP 2] 🎉 COMPLETE!');
    
    if (failedCount === 0) {
      toast.success(`✅ All ${totalFinalVideos} merges completed!`);
    } else {
      toast.warning(`⚠️ ${failedCount} merges failed`);
    }
    
  } catch (error: any) {
    console.error('[STEP 2] ❌ Fatal error:', error);
    
    setMergeStep10Progress(prev => ({
      ...prev,
      status: 'error',
      message: `Fatal Error: ${error.message}`
    }));
    toast.error(`Merge failed: ${error.message}`);
  }
};
