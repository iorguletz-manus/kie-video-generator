# Overlay Scaling Implementation Documentation

## Overview
This document describes the implementation of overlay text scaling to ensure visual synchronization between the frontend video player (300px width) and the final rendered video (720px width).

## Problem Statement
When users configure overlay text in the frontend video player (300px × 533px), the settings (fontSize, padding, lineSpacing, position) are in "player coordinates". However, the final video is rendered at 720px × 1280px, requiring all overlay properties to be scaled by a factor of 2.4 (720 / 300).

## Solution Architecture

### 1. Scale Factor Calculation (Frontend)
**Location:** `client/src/components/VideoEditorV2.tsx`

When overlay settings are saved, the frontend calculates `scaleFactor`:
```typescript
const scaleFactor = videoWidth / playerWidth;
// Example: 720 / 300 = 2.4
```

This `scaleFactor` is saved along with other overlay settings to the database.

### 2. Zod Schema Update (Backend)
**Location:** `server/routers.ts`
**Commit:** `ae64c31`

Added three new fields to `overlaySettings` schema:
```typescript
overlaySettings: z.object({
  // ... existing fields ...
  videoWidth: z.number().optional(),    // 720
  videoHeight: z.number().optional(),   // 1280
  scaleFactor: z.number().optional(),   // 2.4
}).optional()
```

**Why:** Backend was ignoring these fields because they weren't in the Zod schema.

### 3. Property Scaling (Backend)
**Location:** `server/videoEditing.ts` → `buildDrawtextFilter()`
**Commits:** `ec63725` (fontSize), `be3fbda` (padding, lineSpacing)

#### Properties that MUST be scaled:
```typescript
const scaleFactor = settings.scaleFactor || 1;

// Scale fontSize
const scaledFontSize = Math.round(settings.fontSize * scaleFactor);
// Example: 20 * 2.4 = 48

// Scale padding (boxborderw in FFmpeg)
const scaledPadding = Math.round(settings.padding * scaleFactor);
// Example: 5 * 2.4 = 12

// Scale lineSpacing (distance between lines)
const scaledLineSpacing = Math.round(settings.lineSpacing * scaleFactor);
// Example: -10 * 2.4 = -24
```

#### Properties that should NOT be scaled:
```typescript
// Position X, Y are already in percentages, convert to pixels directly
const VIDEO_W = settings.videoWidth || 720;
const VIDEO_H = settings.videoHeight || 1280;

const xPos = Math.round((settings.x / 100) * VIDEO_W);
const yPos = Math.round((settings.y / 100) * VIDEO_H);
// Example: 50% of 720px = 360px
```

**Why:** Position percentages are relative to video dimensions, not player dimensions.

### 4. Text Centering
**Location:** `server/videoEditing.ts` → `buildDrawtextFilter()`
**Commit:** `0792461`

**Implementation:**
```typescript
// ALWAYS center text horizontally (ignore X position from settings)
const xExpression = '(w-text_w)/2';
```

**Why:** Users expect text to be centered when X position is around 50%. Using FFmpeg's `(w-text_w)/2` expression ensures perfect centering regardless of text length.

**Alternative (conditional centering):**
```typescript
// Center only if X is around 50% (45-55%)
const xExpression = (settings.x >= 45 && settings.x <= 55) 
  ? '(w-text_w)/2'  // Center horizontally
  : `${xPos}`;       // Use absolute position
```

## FFmpeg Drawtext Filter Structure

### Generated Filter Example:
```
drawtext=text='Banii aduc fericirea ':fontsize=48:fontcolor=000000:x=(w-text_w)/2:y=966:box=1:boxcolor=ffffff@1:boxborderw=12,
drawtext=text='Dar numaru ':fontsize=48:fontcolor=000000:x=(w-text_w)/2:y=990:box=1:boxcolor=ffffff@1:boxborderw=12
```

### Parameter Mapping:
| Frontend Setting | FFmpeg Parameter | Scaling | Example |
|-----------------|------------------|---------|---------|
| `fontSize: 20` | `fontsize=48` | ✅ × 2.4 | 20 → 48 |
| `padding: 5` | `boxborderw=12` | ✅ × 2.4 | 5 → 12 |
| `lineSpacing: -10` | Y offset: -24 | ✅ × 2.4 | -10 → -24 |
| `x: 50%` | `x=(w-text_w)/2` | ❌ Centered | 50% → center |
| `y: 75.5%` | `y=966` | ❌ % to px | 75.5% of 1280 = 966 |
| `textColor: #000000` | `fontcolor=000000` | ❌ Direct | #000000 → 000000 |
| `backgroundColor: #ffffff` | `boxcolor=ffffff@1` | ❌ Direct | #ffffff@1 |
| `opacity: 1` | `@1` in boxcolor | ❌ Direct | 1 → @1 |

## Implementation Steps (Clean)

### Step 1: Verify Zod Schema
Ensure `videoWidth`, `videoHeight`, `scaleFactor` are in schema:
```bash
grep -A20 "overlaySettings:" server/routers.ts
```

### Step 2: Implement Scaling in buildDrawtextFilter
```typescript
// Get scaleFactor (default 1 if not provided)
const scaleFactor = settings.scaleFactor || 1;

// Scale properties
const scaledFontSize = Math.round(settings.fontSize * scaleFactor);
const scaledPadding = Math.round(settings.padding * scaleFactor);
const scaledLineSpacing = Math.round(settings.lineSpacing * scaleFactor);

// Convert position from % to pixels (NO scaling)
const VIDEO_W = settings.videoWidth || 720;
const VIDEO_H = settings.videoHeight || 1280;
const xPos = Math.round((settings.x / 100) * VIDEO_W);
const yPos = Math.round((settings.y / 100) * VIDEO_H);

// Calculate Y for each line
const lineYOffset = index * (scaledFontSize + scaledLineSpacing);
const finalY = yPos + lineYOffset;

// Center text horizontally
const xExpression = '(w-text_w)/2';

// Build FFmpeg parameters
const params = [
  `text='${escapedLine}'`,
  `fontsize=${scaledFontSize}`,
  `fontcolor=${hexColor(settings.textColor)}`,
  `x=${xExpression}`,
  `y=${finalY}`,
  `box=1`,
  `boxcolor=${hexColor(settings.backgroundColor)}@${settings.opacity}`,
  `boxborderw=${scaledPadding}`,
];
```

### Step 3: Add Logging
```typescript
console.log(`[buildDrawtextFilter] 📐 Scaling factors:`);
console.log(`  - fontSize: ${settings.fontSize} → ${scaledFontSize} (×${scaleFactor})`);
console.log(`  - padding: ${settings.padding} → ${scaledPadding} (×${scaleFactor})`);
console.log(`  - lineSpacing: ${settings.lineSpacing} → ${scaledLineSpacing} (×${scaleFactor})`);
console.log(`  - position: ${settings.x}%, ${settings.y}% → ${xPos}px, ${yPos}px (video: ${VIDEO_W}x${VIDEO_H})`);
```

## Known Limitations

### 1. Bold Text
**Issue:** FFmpeg `drawtext` filter doesn't have a direct `bold` parameter.

**Workarounds:**
- Use a bold font file: `fontfile=Inter-Bold.ttf` (requires font upload)
- Draw text multiple times with slight offsets (hacky)
- Accept that bold won't work with default fonts

### 2. Corner Radius
**Issue:** FFmpeg `drawtext` filter doesn't support `border-radius`.

**Workarounds:**
- Use a pre-rendered PNG overlay with rounded corners
- Accept square corners

### 3. Font Upload
**Issue:** Uploading custom fonts (Inter) to FFmpeg API causes `__dirname is not defined` error in ES modules.

**Solution:** Use FFmpeg default fonts for now, or implement proper font upload with `fileURLToPath` and `import.meta.url`.

## Testing Checklist

- [ ] fontSize scales correctly (20 → 48 with scaleFactor 2.4)
- [ ] Padding scales correctly (5 → 12 with scaleFactor 2.4)
- [ ] LineSpacing scales correctly (-10 → -24 with scaleFactor 2.4)
- [ ] Text is centered horizontally
- [ ] Text position Y is correct (bottom of video)
- [ ] Multiple lines render with correct spacing
- [ ] Colors match between player and final video
- [ ] Opacity works correctly

## Debugging

### Check if scaleFactor is sent to backend:
```bash
# In server logs, look for:
[DB] 📝 T1_C1_E2_AD1_HOOK1_LIDIA: {
  scaleFactor: 2.4,
  videoWidth: 720,
  videoHeight: 1280,
  ...
}
```

### Check if buildDrawtextFilter is called:
```bash
# In server logs, look for:
[buildDrawtextFilter] 📐 Scaling factors:
  - fontSize: 20 → 48 (×2.4)
  - padding: 5 → 12 (×2.4)
  ...
```

### Check generated FFmpeg filter:
```bash
# In server logs, look for:
[cutVideoWithFFmpegAPI] 🎨 Drawtext filter: drawtext=text='...'
```

## Current Status (Commit ae64c31)

✅ **Working:**
- scaleFactor in Zod schema
- fontSize scaling (probably)

❌ **Not Implemented:**
- Text centering
- Padding scaling
- LineSpacing scaling
- Logging

❌ **Broken (removed):**
- Font upload (caused __dirname errors)
