# Overlay Font Scaling Debug Documentation

## Problem
Font size appears small on final video after FFmpeg processing, even though it looks correct in the preview player.

## Root Cause
The video player displays at a smaller resolution (e.g., 400px width) while the actual video is 1080x1920. Font sizes set in the player need to be scaled up for FFmpeg to match the visual appearance.

## Solution: Scale Factor

### Formula
```
scaleFactor = videoWidth / playerWidth
```

### Example
- **Video resolution:** 1080x1920 (native)
- **Player width:** 400px (display)
- **Scale factor:** 1080 / 400 = **2.7**

If user sets font size to **20px** in player:
- **FFmpeg font size:** 20 × 2.7 = **54px**

## Code Implementation

### 1. Frontend (VideoEditorV2.tsx)

**Player dimensions:**
```typescript
const PLAYER_WIDTH = 400;  // Fixed player width in pixels
```

**Overlay settings passed to backend:**
```typescript
overlaySettings: {
  ...localOverlaySettings,
  videoWidth: 1080,        // Native video width
  videoHeight: 1920,       // Native video height
  scaleFactor: 1080 / 400, // = 2.7
}
```

### 2. Backend (videoEditing.ts)

**buildDrawtextFilter function (line 993-1100):**

```typescript
function buildDrawtextFilter(settings: {
  text: string;
  fontSize: number;
  padding: number;
  lineSpacing: number;
  scaleFactor?: number;  // Optional, defaults to 1
  // ... other settings
}): string {
  // Get scaleFactor (default 1 if not provided for backward compatibility)
  const scaleFactor = settings.scaleFactor || 1;
  
  // Scale fontSize, padding, and lineSpacing for FFmpeg to match player display
  const scaledFontSize = Math.round(settings.fontSize * scaleFactor);
  const scaledPadding = Math.round(settings.padding * scaleFactor);
  const scaledLineSpacing = Math.round(settings.lineSpacing * scaleFactor);
  
  // Detailed logging
  console.log(`[buildDrawtextFilter] 📐 Scaling factors:`);
  console.log(`  - fontSize: ${settings.fontSize} → ${scaledFontSize} (×${scaleFactor})`);
  console.log(`  - padding: ${settings.padding} → ${scaledPadding} (×${scaleFactor})`);
  console.log(`  - lineSpacing: ${settings.lineSpacing} → ${scaledLineSpacing} (×${scaleFactor})`);
  
  // Build drawtext filter with SCALED values
  const params = [
    `text='${escapedLine}'`,
    `fontsize=${scaledFontSize}`,  // Use SCALED font size
    `boxborderw=${scaledPadding}`,  // Use SCALED padding
    // ... other params
  ];
  
  return `drawtext=${params.join(':')}`;
}
```

### 3. tRPC Router (routers.ts)

**cutVideo procedure (line 1948-2013):**

```typescript
cutVideo: publicProcedure
  .input(z.object({
    // ... other fields
    overlaySettings: z.object({
      enabled: z.boolean(),
      text: z.string(),
      fontSize: z.number(),
      padding: z.number(),
      lineSpacing: z.number(),
      videoWidth: z.number().optional(),   // Native video width
      videoHeight: z.number().optional(),  // Native video height
      scaleFactor: z.number().optional(),  // Scale factor for fontSize
      // ... other fields
    }).optional(),
  }))
  .mutation(async ({ input }) => {
    // Pass overlaySettings with scaleFactor to FFmpeg
    const finalVideoUrl = await cutVideoWithFFmpegAPI(
      input.videoUrl,
      input.videoName,
      startTimeSeconds,
      endTimeSeconds,
      input.ffmpegApiKey!,
      input.cleanVoiceAudioUrl,
      input.userId,
      input.dirId,
      input.overlaySettings  // Includes scaleFactor
    );
    
    return { success: true, downloadUrl: finalVideoUrl };
  }),
```

## Debugging Steps

### 1. Check Frontend Console
Look for overlay settings being sent:
```
[Test Overlay] Overlay settings: {
  fontSize: 20,
  videoWidth: 1080,
  videoHeight: 1920,
  scaleFactor: 2.7
}
```

### 2. Check Backend Console
Look for scaling calculations:
```
[buildDrawtextFilter] 📐 Scaling factors:
  - fontSize: 20 → 54 (×2.7)
  - padding: 10 → 27 (×2.7)
  - lineSpacing: 5 → 14 (×2.7)
```

### 3. Check FFmpeg Command
Look for drawtext filter in logs:
```
drawtext=text='YOUR TEXT':fontsize=54:boxborderw=27:...
```

## Common Issues

### Issue 1: Font still appears small
**Cause:** scaleFactor not being passed or calculated incorrectly

**Fix:** Check that:
1. `videoWidth` and `videoHeight` are set correctly (1080x1920)
2. `scaleFactor` is calculated: `1080 / playerWidth`
3. Player width matches actual display width (400px)

### Issue 2: Font too large
**Cause:** scaleFactor applied twice or player width incorrect

**Fix:** 
1. Verify player width is correct
2. Check that scaleFactor is only applied once in `buildDrawtextFilter`

### Issue 3: Position incorrect
**Cause:** X/Y coordinates need scaling too

**Fix:** Position is calculated as percentage in backend:
```typescript
const VIDEO_W = settings.videoWidth || 1080;
const VIDEO_H = settings.videoHeight || 1920;
const xPos = Math.round((settings.x / 100) * VIDEO_W);
const yPos = Math.round((settings.y / 100) * VIDEO_H);
```

## Test Overlay Button

**Location:** Step 8, next to "Cut & Merge (test)" button

**Functionality:**
1. Takes current overlay settings from VideoEditorV2
2. Adds `videoWidth`, `videoHeight`, and `scaleFactor`
3. Calls `cutVideo` mutation with overlay settings
4. Opens popup with test video (same as Cut & Merge)

**Usage:**
1. Set overlay text, font size, position in Step 8
2. Click "🎨 Test Overlay" button
3. Wait for FFmpeg processing
4. Preview video in popup to verify overlay appearance

## Files Modified

1. **client/src/components/VideoEditorV2.tsx**
   - Enabled `OVERLAY_ENABLED = true` (line 8)
   - Added `onTestOverlay` prop (line 42)
   - Added "Test Overlay" button (line 1380-1402)

2. **client/src/pages/Home.tsx**
   - Added `onTestOverlay` callback (line 15012-15044)
   - Passes `videoWidth`, `videoHeight`, `scaleFactor` to backend

3. **server/videoEditing.ts**
   - `buildDrawtextFilter` function applies `scaleFactor` (line 1045-1057)
   - Scales `fontSize`, `padding`, `lineSpacing`

4. **server/routers.ts**
   - `cutVideo` procedure accepts `scaleFactor` in `overlaySettings` (line 1975)
