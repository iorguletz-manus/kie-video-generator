# FFmpeg Forbidden Error & Data Corruption Fix

## 🔴 Problem Summary

### **User Report:**
1. ❌ **Step 7 "Autoprepare for Cutting"** → Error: `Failed to extract WAV: FFmpeg API processing failed: Forbidden`
2. ❌ **After hard refresh** → All videos disappeared from Step 7 (but filter shows 20 videos)
3. ❌ **Step 7 statistics** → Shows 20 accepted + 20 regenerate (impossible!)
4. ❌ **Step 6** → All videos show as FAILED

### **Root Cause:**
When FFmpeg API returns **403 Forbidden** error during WAV extraction, the batch processing code **incorrectly marks ALL videos as `failed`** and saves this corrupted state to the database.

---

## 🔍 Investigation Results

### **1. FFmpeg API Forbidden Error**

**Location:** `server/videoEditing.ts` lines 229-232

**Original Code:**
```typescript
if (!processRes.ok) {
  const errorText = await processRes.text();
  console.error('[FFmpeg API] Error response:', errorText.substring(0, 500));
  throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
}
```

**Problem:**
- Generic error message doesn't distinguish 403 Forbidden from other errors
- No logging of HTTP status code
- No specific guidance for API key issues

**Possible Causes of 403 Forbidden:**
1. Invalid or expired FFmpeg API key
2. Rate limiting (too many requests)
3. Video URL inaccessible to FFmpeg API
4. FFmpeg API server configuration issue

---

### **2. Data Corruption Bug**

**Location:** `client/src/pages/Home.tsx` lines 3048-3066

**Original Code:**
```typescript
const updatedResults = videos.map(video => {
  const result = resultsMap.get(video.videoName);
  if (!result || !result.success) {
    return { ...video, status: 'failed' as const };  // ❌ BUG HERE!
  }
  
  return {
    ...video,
    status: 'success' as const,
    audioUrl: result.result.audioUrl,
    waveformData: result.result.waveformData,
    cutPoints: result.result.cutPoints,
    // ... other fields
  };
});
```

**Problem Flow:**
1. User clicks "Autoprepare for Cutting" with 20 videos
2. FFmpeg API returns 403 Forbidden for first video
3. Processing stops, but `resultsMap` is empty (no results)
4. Code maps ALL videos: `if (!result)` → mark as `failed`
5. **ALL 20 videos now have `status: 'failed'`**
6. This corrupted state is saved to database
7. After refresh, Step 6 shows all videos as FAILED
8. Step 7 shows no videos (because they're all failed, not accepted)

**Why statistics are wrong:**
- Filter logic counts videos by `reviewStatus` (from before corruption)
- Display logic filters by `status` (corrupted to 'failed')
- Result: Filter shows "20 accepted" but displays 0 videos

---

## ✅ Fixes Applied

### **Fix 1: Preserve Original Video State on Error**

**File:** `client/src/pages/Home.tsx` (lines 3048-3077)

**New Code:**
```typescript
const updatedResults = videos.map(video => {
  const result = resultsMap.get(video.videoName);
  
  // If video was not processed (no result in map), preserve original state
  if (!result) {
    console.log(`[Batch Processing] ⚠️ No result for ${video.videoName}, preserving original state`);
    return video; // ✅ Keep original video unchanged
  }
  
  // If processing failed, mark as failed
  if (!result.success) {
    console.log(`[Batch Processing] ❌ Failed processing for ${video.videoName}:`, result.error);
    return { ...video, status: 'failed' as const, error: result.error };
  }
  
  // Success - update with new data
  console.log(`[Batch Processing] ✅ Success for ${video.videoName}`);
  return {
    ...video,
    status: 'success' as const,
    audioUrl: result.result.audioUrl,
    waveformData: result.result.waveformData,
    cutPoints: result.result.cutPoints,
    // ... other fields
  };
});
```

**Benefits:**
- ✅ Videos without results keep their original state
- ✅ Only actually failed videos are marked as failed
- ✅ Database saves correct state
- ✅ No more mass corruption on single error

---

### **Fix 2: Better FFmpeg Error Logging**

**File:** `server/videoEditing.ts` (lines 229-241, 301-313, 1279-1291)

**New Code:**
```typescript
if (!processRes.ok) {
  const errorText = await processRes.text();
  console.error('[FFmpeg API] Error response:', errorText.substring(0, 500));
  console.error('[FFmpeg API] Status code:', processRes.status);
  console.error('[FFmpeg API] Status text:', processRes.statusText);
  
  // Specific handling for 403 Forbidden
  if (processRes.status === 403) {
    throw new Error(`FFmpeg API Forbidden (403): API key may be invalid or rate limited. Please check your FFmpeg API credentials.`);
  }
  
  throw new Error(`FFmpeg API processing failed: ${processRes.statusText} (${processRes.status})`);
}
```

**Benefits:**
- ✅ Logs HTTP status code for debugging
- ✅ Specific error message for 403 Forbidden
- ✅ Guides user to check API credentials
- ✅ Easier to diagnose rate limiting vs auth issues

---

## 📊 Commit

**Commit:** `95c9071`
```
Fix: Prevent video data corruption on FFmpeg errors + better error logging
```

**Files Changed:**
- `client/src/pages/Home.tsx` - Preserve original state on error
- `server/videoEditing.ts` - Better FFmpeg error logging (3 locations)

---

## 🔧 Recovery Steps for User

### **If videos are corrupted in database:**

**Option 1: Restore from backup (if available)**
1. Check if there's a database backup before the error
2. Restore `videoResults` from backup session

**Option 2: Regenerate videos**
1. Go to Step 6
2. Click "Regenerate ALL" button
3. Wait for all videos to complete
4. Proceed to Step 7

**Option 3: Manual database fix (advanced)**
1. Query database for session before corruption
2. Copy `videoResults` JSON
3. Update current session with correct data

---

## 🧪 Testing Checklist

### **Test 1: FFmpeg 403 Error Handling**
- [ ] Trigger FFmpeg 403 error (invalid API key)
- [ ] Verify error message mentions "API key may be invalid"
- [ ] Verify logs show status code 403
- [ ] Verify videos NOT corrupted (keep original state)

### **Test 2: Partial Batch Failure**
- [ ] Process batch of 10 videos
- [ ] Simulate failure on video #5
- [ ] Verify videos 1-4 marked as success
- [ ] Verify video 5 marked as failed
- [ ] Verify videos 6-10 keep original state (not marked as failed)

### **Test 3: Database Save**
- [ ] After partial failure, check database
- [ ] Verify only actually failed videos have `status: 'failed'`
- [ ] Verify unprocessed videos keep original status
- [ ] Verify Step 7 filter counts match displayed videos

---

## 🚀 Deployment

**Railway auto-deploy triggered.**

**Estimated time:** ~5-10 minutes

**Test URL:** https://kie-video-generator-production.up.railway.app/

---

## 📝 Prevention Measures

### **Future Improvements:**

1. **Retry Logic for 403 Errors**
   - Implement exponential backoff
   - Retry with delay on rate limit errors
   - Max 3 retries before marking as failed

2. **API Key Validation**
   - Check FFmpeg API key on app startup
   - Show warning if key is invalid
   - Prevent batch processing with invalid key

3. **Better Error Recovery**
   - Add "Retry Failed" button in Step 7
   - Allow individual video retry
   - Don't save to DB until batch fully complete

4. **Database Backup**
   - Auto-backup before risky operations
   - Add "Undo" button for recent changes
   - Version history for videoResults

---

## 🎯 Next Steps for User

1. **Wait for Railway deployment** (~5-10 min)
2. **Hard refresh** browser to clear cache
3. **Check Step 6** - videos should show correct status
4. **If videos still corrupted:**
   - Option A: Regenerate all videos
   - Option B: Contact support for database restore
5. **Retry "Autoprepare for Cutting"** in Step 7
6. **If 403 error persists:**
   - Check FFmpeg API key in Railway environment variables
   - Verify API key is valid and not rate limited
   - Contact FFmpeg API support if needed

---

**Date:** Dec 20, 2025  
**Status:** ✅ Fix deployed, awaiting user testing  
**Priority:** 🔴 CRITICAL - Data corruption bug
