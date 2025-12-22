# FFmpeg Batch Size Limits - All Locations

## Summary
Found **8 locations** in the codebase where FFmpeg batch size limits are defined.

---

## Location 1: Step 7 Autoprepare (batchProcessVideosWithWhisper)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~2759  
**Function:** `batchProcessVideosWithWhisper`

```typescript
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 61000; // 61 seconds
```

**Purpose:** FFmpeg audio extraction + Whisper transcription + CleanVoice  
**Comment:** "Step 8: Batch process videos with FFmpeg batch (10 per batch, 61s pause)"

---

## Location 2: Step 11 Final Merge (handleMergeFinalVideos)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~3656  
**Function:** `handleMergeFinalVideos`

```typescript
const BATCH_SIZE = 10;
```

**Purpose:** Final merge of HOOK + BODY videos  
**Comment:** "Batch processing: Max 10 FINAL videos per batch (same as STEP 2)"

---

## Location 3: Step 8 Trimming (handleBatchTrimming)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~4121  
**Function:** `handleBatchTrimming`

```typescript
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 58000; // 58 seconds
```

**Purpose:** Trim videos using FFmpeg  
**Comment:** "SIMPLE BATCH PROCESSING: 10 at once → wait 58s → next 10 → wait 58s → rest"

---

## Location 4: Step 8 Body Merge (OLD CODE - inside handleBatchTrimming)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~4701  
**Function:** `handleBatchTrimming` (BODY merge section)

```typescript
const BATCH_SIZE = 5;
```

**Purpose:** Merge BODY videos (split into batches of 5)  
**Comment:** "BATCH MERGE: Split into batches of 5 videos to avoid FFmpeg crash"  
**⚠️ NOTE:** This is **BATCH_SIZE = 5**, not 10!

---

## Location 5: Step 9 Simple Cut (handleSimpleCut)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~5470  
**Function:** `handleSimpleCut`

```typescript
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 58000; // 58 seconds
```

**Purpose:** Simple cut/trim videos  
**Comment:** "SIMPLE BATCH PROCESSING: 10 at once → wait 58s → next 10 → wait 58s → rest"

---

## Location 6: Step 9 Prepare for Merge (handlePrepareForMerge)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~5932  
**Function:** `handlePrepareForMerge`

```typescript
const MAX_FINAL_VIDEOS_PER_BATCH = 10;
```

**Purpose:** Merge BODY and HOOK groups  
**Comment:** "Create batches (max 10 final videos per batch)"

---

## Location 7: Step 9 Selective Merge (handleSelectiveMerge)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~6322  
**Function:** `handleSelectiveMerge`

```typescript
const MAX_FINAL_VIDEOS_PER_BATCH = 10;
```

**Purpose:** Selective re-merge of BODY and HOOK groups  
**Comment:** "Create batches (max 10 final videos per batch)"

---

## Location 8: Step 6 Video Generation (BATCH_SIZE = 20)
**File:** `client/src/pages/Home.tsx`  
**Line:** ~7353  
**Function:** Video generation

```typescript
const BATCH_SIZE = 20; // Max 20 videos per batch
```

**Purpose:** Generate videos with Veo API  
**Comment:** "Generate for each prompt type with batch processing (max 20 per batch)"  
**⚠️ NOTE:** This is **BATCH_SIZE = 20**, not 10! (Different API, not FFmpeg)

---

## Additional File: Home_batch_new.tsx (Experimental)
**File:** `client/src/pages/Home_batch_new.tsx`  
**Line:** ~11

```typescript
const MAX_FFMPEG_CONCURRENT = 10;  // Max 10 FFmpeg requests at once
const BATCH_SIZE = 5;  // Wait for 5 to complete before sending more
```

**Purpose:** Experimental smart batching (not used in production)  
**Note:** This file appears to be a test/backup file

---

## Summary Table

| # | Location | Function | Batch Size | Delay | Purpose |
|---|----------|----------|------------|-------|---------|
| 1 | Line ~2759 | `batchProcessVideosWithWhisper` | **10** | 61s | Step 7: FFmpeg audio + Whisper + CleanVoice |
| 2 | Line ~3656 | `handleMergeFinalVideos` | **10** | - | Step 11: Final merge HOOK + BODY |
| 3 | Line ~4121 | `handleBatchTrimming` | **10** | 58s | Step 8: Trim videos |
| 4 | Line ~4701 | `handleBatchTrimming` (BODY merge) | **5** ⚠️ | - | Step 8: Merge BODY videos |
| 5 | Line ~5470 | `handleSimpleCut` | **10** | 58s | Step 9: Simple cut |
| 6 | Line ~5932 | `handlePrepareForMerge` | **10** | - | Step 9: Merge BODY + HOOKs |
| 7 | Line ~6322 | `handleSelectiveMerge` | **10** | - | Step 9: Selective merge |
| 8 | Line ~7353 | Video generation | **20** ⚠️ | - | Step 6: Veo API (not FFmpeg) |

---

## Key Findings

### Standard FFmpeg Batch Size: **10**
Most FFmpeg operations use `BATCH_SIZE = 10` or `MAX_FINAL_VIDEOS_PER_BATCH = 10`

### Exceptions:
1. **BODY Merge (Line ~4701):** Uses `BATCH_SIZE = 5`
   - Comment: "Split into batches of 5 videos to avoid FFmpeg crash"
   - This suggests 5 is safer for merge operations

2. **Video Generation (Line ~7353):** Uses `BATCH_SIZE = 20`
   - This is for Veo API, NOT FFmpeg
   - Different rate limits apply

### Delays Between Batches:
- **61 seconds:** Step 7 Autoprepare (FFmpeg audio extraction)
- **58 seconds:** Step 8 Trimming, Step 9 Simple Cut
- **60 seconds:** Step 9/10 Merge operations (in countdown logic)

---

## Recommendations

### If changing batch size globally:
1. **Search for:** `const BATCH_SIZE = 10` and `const MAX_FINAL_VIDEOS_PER_BATCH = 10`
2. **Locations to update:** 7 locations (excluding BODY merge and video generation)
3. **Consider keeping:** BODY merge at 5 (more stable for large merges)

### If increasing batch size:
- **Test thoroughly** - current limit of 10 is based on FFmpeg API rate limits
- **Monitor:** FFmpeg API errors, timeouts, and failures
- **Adjust delays:** May need longer delays between batches

### If decreasing batch size:
- **Safer** but slower processing
- **Consider:** Reducing to 5 for all merge operations (like BODY merge)
- **Benefit:** More stable, fewer crashes

---

## Notes
- All batch sizes are defined as **local constants** within functions
- No global configuration file for batch sizes
- Each function independently defines its batch size
- To change globally, must update each location individually
