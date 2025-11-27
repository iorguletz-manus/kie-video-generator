  // Retry failed merge groups
  const handleRetryFailedMerges = async () => {
    const failedResults = mergeStep10Progress.results?.filter(r => r.status === 'failed') || [];
    
    if (failedResults.length === 0) {
      toast.info('No failed merges to retry');
      return;
    }
    
    console.log('[Merge Retry] 🔄 Retrying', failedResults.length, 'failed groups...');
    
    // Mark all failed as retrying
    setMergeStep10Progress(prev => ({
      ...prev,
      status: 'processing',
      message: `Retrying ${failedResults.length} failed groups...`,
      results: prev.results?.map(r => 
        r.status === 'failed' 
          ? { ...r, status: 'retrying' as any, error: undefined }
          : r
      )
    }));
    
    const trimmedVideos = videoResults.filter(v => 
      v.reviewStatus === 'accepted' && 
      v.status === 'success' && 
      v.trimmedVideoUrl &&
      v.recutStatus === 'accepted'
    );
    
    for (const failedResult of failedResults) {
      console.log(`[Merge Retry] 🔄 Retrying ${failedResult.name}...`);
      
      setMergeStep10Progress(prev => ({
        ...prev,
        message: `Retrying ${failedResult.name}...`
      }));
      
      try {
        if (failedResult.type === 'hook') {
          // Find hook group videos
          const hookVideos = trimmedVideos.filter(v => {
            const hookMatch = v.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/);
            if (hookMatch) {
              const prefix = hookMatch[1];
              const hookBase = hookMatch[2];
              const suffix = hookMatch[3];
              const groupKey = `${prefix}${hookBase}${suffix}`;
              return groupKey === failedResult.name;
            }
            return false;
          });
          
          if (hookVideos.length === 0) {
            throw new Error('Hook videos not found');
          }
          
          const sortedVideos = hookVideos.sort((a, b) => a.videoName.localeCompare(b.videoName));
          const videoUrls = sortedVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
          const outputName = failedResult.name.replace(/(HOOK\d+)/, '$1M');
          
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
          });
          
          console.log(`[Merge Retry] ✅ ${failedResult.name} SUCCESS:`, result.cdnUrl);
          
          // Update result to success
          setMergeStep10Progress(prev => ({
            ...prev,
            results: prev.results?.map(r =>
              r.name === failedResult.name
                ? { ...r, status: 'success', cdnUrl: result.cdnUrl, error: undefined }
                : r
            )
          }));
          
          setHookMergedVideos(prev => ({ ...prev, [failedResult.name]: result.cdnUrl }));
          
        } else if (failedResult.type === 'body') {
          // Find body videos
          const bodyVideos = trimmedVideos.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
          
          if (bodyVideos.length === 0) {
            throw new Error('Body videos not found');
          }
          
          const bodyVideoUrls = bodyVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
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
          
          console.log('[Merge Retry] ✅ BODY SUCCESS:', result.cdnUrl);
          
          setMergeStep10Progress(prev => ({
            ...prev,
            results: prev.results?.map(r =>
              r.name === 'BODY'
                ? { ...r, status: 'success', cdnUrl: result.cdnUrl, error: undefined }
                : r
            )
          }));
          
          setBodyMergedVideoUrl(result.cdnUrl);
        }
        
      } catch (error: any) {
        console.error(`[Merge Retry] ❌ ${failedResult.name} FAILED AGAIN:`, error);
        
        setMergeStep10Progress(prev => ({
          ...prev,
          results: prev.results?.map(r =>
            r.name === failedResult.name
              ? { ...r, status: 'failed', error: error.message }
              : r
          )
        }));
      }
    }
    
    // Final status update
    const finalResults = mergeStep10Progress.results || [];
    const successCount = finalResults.filter(r => r.status === 'success').length;
    const failCount = finalResults.filter(r => r.status === 'failed').length;
    
    setMergeStep10Progress(prev => ({
      ...prev,
      status: failCount > 0 ? 'partial' : 'complete',
      message: failCount > 0 
        ? `⚠️ ${successCount} succeeded, ${failCount} failed`
        : `✅ All merges complete!`
    }));
    
    if (failCount === 0) {
      toast.success(`✅ All retries succeeded!`);
    } else {
      toast.warning(`⚠️ ${successCount} succeeded, ${failCount} still failed`);
    }
  };
