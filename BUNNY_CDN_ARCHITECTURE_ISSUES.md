# Bunny CDN Architecture Issues & Recommendations

## Current State Analysis

### URLs Found in Database

| Field | Folder | Filename | Status |
|-------|--------|----------|--------|
| audioUrl | `/audio-files/` | `T1_C1_E1_AD4_HOOK1_TEST_1764170436421.mp3` | ✅ OK |
| imageUrl | `/user-1/library/Test/` | `Alina_1-1763565542441-8ex9ipx3ruv.png` | ⚠️ OLD STRUCTURE |
| trimmedVideoUrl | `/trimmed-videos/` | `video-undefined-1764171579534-9a56bw.mp4` | ❌ BUG: undefined |
| cleanvoiceAudioUrl | N/A | N/A | ❌ NOT SAVED |
| waveformData | N/A | (embedded JSON) | ⚠️ NOT ON CDN |

---

## Problems Identified

### 1. ❌ Trimmed Video Filename Contains "undefined"

**Current:**
```
trimmed-videos/video-undefined-1764171579534-9a56bw.mp4
                     ^^^^^^^^^
```

**Expected:**
```
trimmed-videos/T1_C1_E1_AD4_HOOK1_TEST-1764171579534.mp4
```

**Root Cause:**
In `server/videoEditing.ts` line 782:
```typescript
const outputFileName = `${videoName}_trimmed_${Date.now()}.mp4`;
```

But when uploading to Bunny (line 868):
```typescript
const bunnyFileName = `trimmed-videos/${outputFileName}`;
```

The problem is in `server/routers.ts` line 1673:
```typescript
const fileName = `trimmed-videos/video-${input.videoId}-${timestamp}-${randomSuffix}.mp4`;
                                        ^^^^^^^^^^^^^^
```

`input.videoId` is `undefined`!

**Fix:**
```typescript
// Remove "video-" prefix and use videoName directly
const fileName = `trimmed-videos/${videoName}-${timestamp}.mp4`;
```

---

### 2. ❌ CleanVoice Audio NOT Saved to Bunny CDN

**Current:**
```json
"cleanvoiceAudioUrl": null
```

**Expected:**
```
https://manus.b-cdn.net/cleanvoice/T1_C1_E1_AD4_HOOK1_TEST-1764170436421.mp3
```

**Root Cause:**
CleanVoice audio is processed but NOT uploaded to Bunny CDN. It's only used temporarily in FFmpeg processing.

**Fix:**
After CleanVoice processing, upload the audio to Bunny CDN:
```typescript
const cleanvoiceFileName = `cleanvoice/${videoName}-${timestamp}.mp3`;
const cleanvoiceUrl = await uploadToBunnyCDN(audioBuffer, cleanvoiceFileName, 'audio/mpeg');
```

---

### 3. ⚠️ Waveform Data NOT Saved to Bunny CDN

**Current:**
Waveform data is embedded in the database as JSON (47KB+).

**Expected:**
```
https://manus.b-cdn.net/waveforms/T1_C1_E1_AD4_HOOK1_TEST-1764170436421.json
```

**Recommendation:**
Upload waveform JSON to Bunny CDN instead of storing in database:
```typescript
const waveformFileName = `waveforms/${videoName}-${timestamp}.json`;
const waveformUrl = await uploadToBunnyCDN(
  Buffer.from(JSON.stringify(waveformData)), 
  waveformFileName, 
  'application/json'
);
```

---

### 4. ⚠️ Inconsistent Folder Structure

**Current Structure (Mixed):**
```
/audio-files/T1_C1_E1_AD4_HOOK1_TEST_1764170436421.mp3
/trimmed-videos/video-undefined-1764171579534-9a56bw.mp4
/user-1/library/Test/Alina_1-1763565542441-8ex9ipx3ruv.png
/cleanvoice/ (not used)
/waveforms/ (not used)
```

**Recommended Structure (from storageHelpers.ts):**
```
users/{userId}/campaigns/{TAM}/{CoreBelief}/{EmotionalAngle}/{Ad}/{Character}/audio/{filename}.mp3
users/{userId}/campaigns/{TAM}/{CoreBelief}/{EmotionalAngle}/{Ad}/{Character}/trimmed-videos/{filename}.mp4
users/{userId}/campaigns/{TAM}/{CoreBelief}/{EmotionalAngle}/{Ad}/{Character}/cleanvoice/{filename}.mp3
users/{userId}/campaigns/{TAM}/{CoreBelief}/{EmotionalAngle}/{Ad}/{Character}/waveforms/{filename}.json
users/{userId}/library/images/{characterName}/{imageName}.png
```

**Benefits:**
- ✅ User isolation (multi-tenant support)
- ✅ Campaign organization (easy to find/delete campaigns)
- ✅ Hierarchical structure (TAM → CoreBelief → EmotionalAngle → Ad → Character)
- ✅ File type separation (audio, video, cleanvoice, waveforms)

---

## Recommended Fixes

### Priority 1: Critical Bugs

1. **Fix trimmed video filename**
   - Remove "video-" prefix
   - Use `videoName` instead of `input.videoId`
   - Format: `{videoName}-{timestamp}.mp4`

2. **Save CleanVoice audio to Bunny CDN**
   - Upload to `/cleanvoice/` folder
   - Save URL in `cleanvoiceAudioUrl` field

### Priority 2: Optimization

3. **Save waveform to Bunny CDN**
   - Upload JSON to `/waveforms/` folder
   - Save URL in `waveformUrl` field
   - Remove waveform data from database (reduce size)

### Priority 3: Architecture Improvement

4. **Migrate to hierarchical folder structure**
   - Use `generateCampaignFilePath()` from `storageHelpers.ts`
   - Migrate existing files to new structure
   - Update all upload functions

---

## Code Locations to Fix

### 1. Trimmed Video Filename (server/videoEditing.ts)

**Line 782:**
```typescript
// CURRENT
const outputFileName = `${videoName}_trimmed_${Date.now()}.mp4`;

// FIX
const outputFileName = `${videoName}-${Date.now()}.mp4`;
```

**Line 868:**
```typescript
// CURRENT
const bunnyFileName = `trimmed-videos/${outputFileName}`;

// FIX (if using new architecture)
const bunnyFileName = generateCampaignFilePath(
  userId, tamName, coreBeliefName, emotionalAngleName, adName, characterName,
  'trimmed-videos', videoName, 'mp4'
);
```

### 2. CleanVoice Audio Upload (server/videoEditing.ts)

After CleanVoice processing (around line 774-778), add:
```typescript
// Upload CleanVoice audio to Bunny CDN
const cleanvoiceFileName = `cleanvoice/${videoName}-${Date.now()}.mp3`;
const cleanvoiceUrl = await uploadToBunnyCDN(
  cleanvoiceAudioBuffer, 
  cleanvoiceFileName, 
  'audio/mpeg'
);
```

### 3. Waveform Upload (server/videoEditing.ts)

After waveform generation (around line 500-600), add:
```typescript
// Upload waveform to Bunny CDN
const waveformFileName = `waveforms/${videoName}-${Date.now()}.json`;
const waveformUrl = await uploadToBunnyCDN(
  Buffer.from(JSON.stringify(waveformData)), 
  waveformFileName, 
  'application/json'
);
```

---

## Summary

| Issue | Priority | Impact | Effort |
|-------|----------|--------|--------|
| Trimmed video filename bug | P1 | High | Low |
| CleanVoice audio not saved | P1 | High | Medium |
| Waveform not saved to CDN | P2 | Medium | Low |
| Inconsistent folder structure | P3 | Low | High |

**Recommendation:** Fix P1 issues immediately, P2 when convenient, P3 as a future improvement.
