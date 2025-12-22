# FFmpeg Batch Size - Database Settings Implementation

## Date: December 22, 2025

## Overview
Moved FFmpeg batch size from hardcoded constants to database settings, providing a single source of truth and allowing users to customize batch size per their needs.

---

## Implementation Summary

### 1. Database Schema Changes ✅

**File:** `drizzle/schema.ts`

Added new column to `app_users` table:
```typescript
ffmpegBatchSize: int("ffmpegBatchSize").default(15).notNull(), // FFmpeg batch size for processing (default: 15)
```

**Default Value:** 15 (increased from previous hardcoded 10)

**Migration:** Will be applied automatically on Railway deployment via `drizzle-kit`

---

### 2. Backend (tRPC) Changes ✅

**File:** `server/routers.ts`

#### Updated Procedures:
1. **`appAuth.login`** - Returns `ffmpegBatchSize` in user object
2. **`appAuth.getMe`** - Returns `ffmpegBatchSize` in user object
3. **`appAuth.updateProfile`** - Accepts and saves `ffmpegBatchSize`

#### Input Schema:
```typescript
updateProfile: publicProcedure
  .input(z.object({
    userId: z.number(),
    password: z.string().optional(),
    profileImageUrl: z.string().optional(),
    kieApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    ffmpegApiKey: z.string().optional(),
    cleanvoiceApiKey: z.string().optional(),
    ffmpegBatchSize: z.number().optional(), // NEW
  }))
```

#### Response Schema:
```typescript
user: {
  id: user.id,
  username: user.username,
  profileImageUrl: user.profileImageUrl,
  kieApiKey: user.kieApiKey,
  openaiApiKey: user.openaiApiKey,
  ffmpegApiKey: user.ffmpegApiKey,
  cleanvoiceApiKey: user.cleanvoiceApiKey,
  ffmpegBatchSize: user.ffmpegBatchSize, // NEW
}
```

---

### 3. Frontend (Settings UI) Changes ✅

**File:** `client/src/components/EditProfileModal.tsx`

#### Added State:
```typescript
const [ffmpegBatchSize, setFfmpegBatchSize] = useState(currentUser.ffmpegBatchSize || 15);
```

#### Added UI Input:
```tsx
{/* FFmpeg Batch Size */}
<div>
  <label className="block text-sm font-medium text-blue-900 mb-2">
    FFmpeg Batch Size
  </label>
  <input
    type="number"
    min="1"
    max="50"
    value={ffmpegBatchSize}
    onChange={(e) => setFfmpegBatchSize(parseInt(e.target.value) || 15)}
    className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    placeholder="Default: 15"
  />
  <p className="text-xs text-gray-600 mt-1">
    Number of videos to process simultaneously (default: 15)
  </p>
</div>
```

#### Updated Mutation Calls:
Both image upload and direct update paths now include `ffmpegBatchSize`:
```typescript
await updateProfileMutation.mutateAsync({
  userId: currentUser.id,
  password: newPassword || undefined,
  kieApiKey: kieApiKey || undefined,
  openaiApiKey: openaiApiKey || undefined,
  ffmpegApiKey: ffmpegApiKey || undefined,
  cleanvoiceApiKey: cleanvoiceApiKey || undefined,
  ffmpegBatchSize: ffmpegBatchSize, // NEW
});
```

---

### 4. Frontend (Home.tsx) Changes ✅

**File:** `client/src/pages/Home.tsx`

#### Updated Interface:
```typescript
interface HomeProps {
  currentUser: { 
    id: number; 
    username: string; 
    profileImageUrl: string | null; 
    kieApiKey: string | null; 
    openaiApiKey: string | null; 
    ffmpegApiKey: string | null; 
    cleanvoiceApiKey: string | null; 
    ffmpegBatchSize: number // NEW
  };
  onLogout: () => void;
}
```

#### Replaced 7 Hardcoded Locations:

**Before:**
```typescript
const BATCH_SIZE = 10;
```

**After:**
```typescript
const BATCH_SIZE = localCurrentUser?.ffmpegBatchSize || 15; // From database settings (default: 15)
```

---

### 5. All Updated Locations ✅

| # | Line | Function | Old Value | New Value | Step |
|---|------|----------|-----------|-----------|------|
| 1 | ~2759 | `batchProcessVideosWithWhisper` | `10` | `localCurrentUser?.ffmpegBatchSize \|\| 15` | Step 7 |
| 2 | ~3656 | `handleMergeFinalVideos` | `10` | `localCurrentUser?.ffmpegBatchSize \|\| 15` | Step 11 |
| 3 | ~4121 | `handleBatchTrimming` | `10` | `localCurrentUser?.ffmpegBatchSize \|\| 15` | Step 8 |
| 4 | ~5470 | `handleSimpleCut` | `10` | `localCurrentUser?.ffmpegBatchSize \|\| 15` | Step 9 |
| 5 | ~5932 | `handlePrepareForMerge` | `10` | `localCurrentUser?.ffmpegBatchSize \|\| 15` | Step 9 |
| 6 | ~6322 | `handleSelectiveMerge` | `10` | `localCurrentUser?.ffmpegBatchSize \|\| 15` | Step 9 |

**Total:** 6 locations updated (originally 7, but 2 were duplicates)

---

### 6. Locations NOT Changed ✅

#### BODY Merge (Line ~4701)
```typescript
const BATCH_SIZE = 5; // KEPT at 5 - more stable for merge operations
```
**Reason:** Comment in code says "Split into batches of 5 videos to avoid FFmpeg crash"

#### Veo API (Line ~7353)
```typescript
const BATCH_SIZE = 20; // KEPT at 20 - different API (not FFmpeg)
```
**Reason:** This is for Veo video generation API, not FFmpeg processing

---

## User Experience

### Settings Flow:
1. User clicks **Settings** button in header
2. Modal opens with all settings
3. User sees **"FFmpeg Batch Size"** input field
4. User can change value (min: 1, max: 50, default: 15)
5. User clicks **Save**
6. Value is saved to database
7. All future FFmpeg operations use the new batch size

### Default Behavior:
- New users: `ffmpegBatchSize = 15` (database default)
- Existing users: Will need to run migration to add column with default 15
- Fallback: If database value is missing, code uses `|| 15`

---

## Migration Notes

### Railway Deployment:
1. Railway will detect schema changes
2. Drizzle will generate migration automatically
3. Migration will add `ffmpegBatchSize` column with default 15
4. Existing users will get default value 15
5. No data loss, backward compatible

### Manual Migration (if needed):
```sql
ALTER TABLE app_users 
ADD COLUMN ffmpegBatchSize INT NOT NULL DEFAULT 15 
COMMENT 'FFmpeg batch size for processing (default: 15)';
```

---

## Testing Checklist

### Before Testing:
- ✅ Build successful (no TypeScript errors)
- ✅ Commit created: `4ce9568`
- ✅ Pushed to GitHub
- ⏳ Railway deployment in progress

### After Deployment:
1. **Login** - Verify user object includes `ffmpegBatchSize`
2. **Settings Modal** - Verify FFmpeg Batch Size input appears
3. **Change Value** - Set to different value (e.g., 20)
4. **Save** - Verify no errors
5. **Reload** - Verify value persists
6. **Step 7 Autoprepare** - Check console logs for batch size
7. **Step 8 Trimming** - Check console logs for batch size
8. **Step 9 Merge** - Check console logs for batch size
9. **Step 11 Final Merge** - Check console logs for batch size

### Console Log Verification:
Look for logs like:
```
[Batch Processing] 🚀 Starting FFmpeg batch processing with X videos
```
Then check that batches are created with the correct size.

---

## Benefits

### ✅ Single Source of Truth
- No more scattered hardcoded values
- One place to change batch size
- Consistent across all operations

### ✅ User Customization
- Users can optimize for their needs
- Higher values = faster but more load
- Lower values = slower but more stable

### ✅ Database Persistence
- Value survives server restarts
- Per-user configuration
- Easy to audit and modify

### ✅ Backward Compatible
- Fallback to 15 if database value missing
- No breaking changes
- Existing code continues to work

---

## Recommendations

### For Users:
- **Default (15):** Good balance for most users
- **Higher (20-30):** If you have good API rate limits and want speed
- **Lower (5-10):** If you experience timeouts or rate limit errors
- **BODY Merge:** Always uses 5 (hardcoded for stability)

### For Developers:
- Monitor FFmpeg API rate limits
- Consider adding per-operation batch sizes in future
- Consider adding batch size validation (min/max)
- Consider adding batch size recommendations based on API key tier

---

## Git History

### Commits:
- **4ce9568** - feat: Move FFmpeg batch size to database settings (default: 15)

### Files Changed:
1. `drizzle/schema.ts` - Added `ffmpegBatchSize` column
2. `server/routers.ts` - Updated tRPC procedures
3. `client/src/components/EditProfileModal.tsx` - Added UI input
4. `client/src/pages/Home.tsx` - Replaced 6 hardcoded locations
5. `FFMPEG_BATCH_SIZE_LOCATIONS.md` - Documentation (created earlier)
6. `FFMPEG_BATCH_SIZE_DATABASE_IMPLEMENTATION.md` - This file

---

## Success Criteria - ALL MET ✅

✅ Database schema updated with `ffmpegBatchSize` column  
✅ Default value set to 15  
✅ Settings UI includes input field  
✅ Input has validation (min: 1, max: 50)  
✅ tRPC router handles ffmpegBatchSize  
✅ All 6 FFmpeg batch locations updated  
✅ BODY merge kept at 5 (stability)  
✅ Veo API kept at 20 (different system)  
✅ TypeScript compiles without errors  
✅ Build successful  
✅ Committed to git  
✅ Pushed to GitHub  
⏳ Railway deployment in progress  

---

## Next Steps

1. ⏳ Wait for Railway deployment to complete
2. 🧪 Test Settings UI - change batch size
3. 🧪 Test Step 7 Autoprepare - verify batch size used
4. 🧪 Test Step 8 Trimming - verify batch size used
5. 🧪 Test Step 9 Merge - verify batch size used
6. 📊 Monitor FFmpeg API usage and errors
7. 📝 Document optimal batch size recommendations

---

## Notes

- User requested default value of **15** (increased from 10)
- User wanted **one source of truth: database** ✅
- Implementation maintains backward compatibility
- All operations now read from same source
- Easy to modify per-user in future if needed
