  // Step 9 → Step 10: Merge videos (REWRITTEN - simple, manual retry)
  const handleMergeVideos = async () => {
    console.log('[Step 9→Step 10] 🚀 Starting merge process...');
    
    const trimmedVideos = videoResults.filter(v => 
      v.reviewStatus === 'accepted' && 
      v.status === 'success' && 
      v.trimmedVideoUrl &&
      v.recutStatus === 'accepted' // Only accepted videos
    );
    
    if (trimmedVideos.length === 0) {
      toast.error('No accepted trimmed videos to merge!');
      return;
    }
    
    console.log('[Merge] 📋 Trimmed videos:', trimmedVideos.map(v => v.videoName));
    
    // 1. Group HOOKS by base name (HOOK3, HOOK3B, HOOK3C → 1 group)
    const hookVideos = trimmedVideos.filter(v => v.videoName.match(/HOOK\d+[A-Z]?/));
    const hookGroups: Record<string, typeof hookVideos> = {};
    
    hookVideos.forEach(video => {
      // Extract base hook name: T1_C1_E1_AD4_HOOK3_TEST → HOOK3
      const hookMatch = video.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/);
      if (hookMatch) {
        const prefix = hookMatch[1]; // T1_C1_E1_AD4_
        const hookBase = hookMatch[2]; // HOOK3
        const suffix = hookMatch[3]; // _TEST
        const groupKey = `${prefix}${hookBase}${suffix}`; // T1_C1_E1_AD4_HOOK3_TEST
        
        if (!hookGroups[groupKey]) {
          hookGroups[groupKey] = [];
        }
        hookGroups[groupKey].push(video);
      }
    });
    
    // Filter: only groups with 2+ videos need merging
    const hookGroupsToMerge = Object.entries(hookGroups).filter(([_, videos]) => videos.length > 1);
    
    console.log('[Merge] 🎣 Hook groups to merge:', hookGroupsToMerge.length);
    hookGroupsToMerge.forEach(([baseName, videos]) => {
      console.log(`[Merge]   ${baseName}: ${videos.length} videos (${videos.map(v => v.videoName).join(', ')})`);
    });
    
    // 2. BODY videos (all non-hook videos from MIRROR to CTA)
    const bodyVideos = trimmedVideos.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
    const needsBodyMerge = bodyVideos.length > 0;
    
    console.log('[Merge] 📺 Body videos:', bodyVideos.length);
    console.log('[Merge] 📺 Body video names:', bodyVideos.map(v => v.videoName));
    
    if (hookGroupsToMerge.length === 0 && !needsBodyMerge) {
      toast.info('No videos need merging! All hooks are standalone.');
      return;
    }
    
    // 3. 60-second countdown
    console.log('[Merge] ⏳ Starting 60-second countdown...');
    setMergeStep10Progress({ 
      status: 'countdown', 
      message: 'Waiting 60s before merge (FFmpeg rate limit)...',
      countdown: 60
    });
    setIsMergingStep10(true);
    
    for (let countdown = 60; countdown > 0; countdown--) {
      setMergeStep10Progress(prev => ({
        ...prev,
        message: `⏳ Waiting ${countdown}s before merge...`,
        countdown
      }));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. Start merging
    setMergeStep10Progress({ 
      status: 'processing', 
      message: 'Starting merge...',
      hookGroups: [],
      bodyGroup: null
    });
    
    const mergeResults: Array<{
      type: 'hook' | 'body';
      name: string;
      videoCount: number;
      status: 'success' | 'failed';
      cdnUrl?: string;
      error?: string;
    }> = [];
    
    try {
      // 5. Merge HOOKS
      for (const [baseName, videos] of hookGroupsToMerge) {
        console.log(`[Merge] 🎣 Merging ${baseName} (${videos.length} videos)...`);
        setMergeStep10Progress(prev => ({
          ...prev,
          message: `Merging ${baseName} (${videos.length} videos)...`
        }));
        
        try {
          const sortedVideos = videos.sort((a, b) => a.videoName.localeCompare(b.videoName));
          const videoUrls = sortedVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
          
          // Output name: T1_C1_E1_AD4_HOOK3M_TEST (M = merged)
          const outputName = baseName.replace(/(HOOK\d+)/, '$1M');
          
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
          });
          
          console.log(`[Merge] ✅ ${baseName} SUCCESS:`, result.cdnUrl);
          mergeResults.push({
            type: 'hook',
            name: baseName,
            videoCount: videos.length,
            status: 'success',
            cdnUrl: result.cdnUrl
          });
          
          // Save merged hook URL
          setHookMergedVideos(prev => ({ ...prev, [baseName]: result.cdnUrl }));
          
        } catch (error: any) {
          console.error(`[Merge] ❌ ${baseName} FAILED:`, error);
          mergeResults.push({
            type: 'hook',
            name: baseName,
            videoCount: videos.length,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // 6. Merge BODY
      if (needsBodyMerge) {
        console.log(`[Merge] 📺 Merging BODY (${bodyVideos.length} videos)...`);
        setMergeStep10Progress(prev => ({
          ...prev,
          message: `Merging BODY (${bodyVideos.length} videos)...`
        }));
        
        try {
          const bodyVideoUrls = bodyVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
          
          // Extract context from first video
          const firstVideoName = bodyVideos[0].videoName;
          const contextMatch = firstVideoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
          const context = contextMatch ? contextMatch[1] : 'MERGED';
          const characterMatch = firstVideoName.match(/_([^_]+)$/);
          const characterName = characterMatch ? characterMatch[1] : 'TEST';
          
          const outputName = `${context}_BODY_${characterName}`;
          
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls: bodyVideoUrls,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
          });
          
          console.log('[Merge] ✅ BODY SUCCESS:', result.cdnUrl);
          mergeResults.push({
            type: 'body',
            name: 'BODY',
            videoCount: bodyVideos.length,
            status: 'success',
            cdnUrl: result.cdnUrl
          });
          
          setBodyMergedVideoUrl(result.cdnUrl);
          
        } catch (error: any) {
          console.error('[Merge] ❌ BODY FAILED:', error);
          mergeResults.push({
            type: 'body',
            name: 'BODY',
            videoCount: bodyVideos.length,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // 7. Update progress with results
      const successCount = mergeResults.filter(r => r.status === 'success').length;
      const failCount = mergeResults.filter(r => r.status === 'failed').length;
      
      setMergeStep10Progress({
        status: failCount > 0 ? 'partial' : 'complete',
        message: failCount > 0 
          ? `⚠️ ${successCount} succeeded, ${failCount} failed`
          : `✅ All merges complete!`,
        results: mergeResults
      });
      
      console.log('[Merge] 🎉 COMPLETE! Success:', successCount, 'Failed:', failCount);
      
      if (failCount === 0) {
        toast.success(`✅ All ${successCount} groups merged successfully!`);
      } else {
        toast.warning(`⚠️ ${successCount} succeeded, ${failCount} failed. Check results.`);
      }
      
    } catch (error: any) {
      console.error('[Merge] ❌ Fatal error:', error);
      setMergeStep10Progress({
        status: 'error',
        message: `Error: ${error.message}`,
        results: mergeResults
      });
      toast.error(`Merge failed: ${error.message}`);
    }
  };
