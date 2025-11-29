# STEP 1 ProcessingModal - Complete Analysis

## 📋 Structure Overview

### Props Interface:
```typescript
- open: boolean
- ffmpegProgress: { current, total, status, activeVideos[] }
- whisperProgress: { current, total, status, activeVideos[] }
- cleanvoiceProgress: { current, total, status, activeVideos[] }
- currentVideoName: string
- processingStep: 'download' | 'extract' | 'whisper' | 'cleanvoice' | 'detect' | 'save' | null
- countdown?: number
- estimatedMinutes?: number
- successVideos?: string[]
- failedVideos?: Array<{ videoName, error }>
- ffmpegSuccess?: string[]
- ffmpegFailed?: Array<{ videoName, error }>
- whisperSuccess?: string[]
- whisperFailed?: Array<{ videoName, error }>
- cleanvoiceSuccess?: string[]
- cleanvoiceFailed?: Array<{ videoName, error }>
- onRetryFailed?: () => void
- onClose?: () => void
- onContinue?: () => void
```

### State Management:
- **Collapsible logs:** useState for each section (success/failed for each phase)
- **Auto-open failed logs:** useEffect triggers when failed items appear
- **Progress calculation:** Percentage based on current/total

## 🎨 UI Design Pattern

### Section Structure (repeated for each phase):
```
1. Header with title + counter
   - Title: "🎬 FFmpeg (WAV Extraction)"
   - Counter: "X/Y" (current/total)

2. Progress Bar
   - Color: bg-blue-100 (FFmpeg), bg-purple-100 (Whisper), bg-green-100 (CleanVoice)
   - Height: h-3

3. Success Log (collapsible)
   - Button: "✅ Success (X)" + "View log" (blue underline)
   - Content: Green box (bg-green-50, border-green-200)
   - Items: ✓ + video name
   - Max height: max-h-32, scrollable

4. Failed Log (collapsible, auto-open)
   - Button: "❌ Failed (X)" + "View log" (blue underline)
   - Content: Red box (bg-red-50, border-red-200)
   - Items: ✗ + video name + "Error: {message}"
   - Max height: max-h-32, scrollable

5. In Progress (always visible when active)
   - Title: "⏳ Processing (X):"
   - Content: Blue box (bg-blue-50, border-blue-200)
   - Items: Spinner (w-4 h-4) + video name
   - Max height: max-h-24, scrollable
```

### Color Scheme:
- **Success:** green-50/600/700
- **Failed:** red-50/600/700
- **In Progress:** blue-50/600/700
- **Progress bars:** Different per section (blue, purple, green)

### Typography:
- **Section title:** text-sm font-semibold text-gray-700
- **Counter:** text-sm font-medium text-gray-600
- **Button text:** text-sm font-medium
- **"View log":** text-blue-600 underline text-xs
- **Log items:** text-sm

### Spacing:
- **Between sections:** border-t pt-4
- **Section internal:** space-y-3
- **Log items:** space-y-1 (success), space-y-2 (failed)

## 🔄 Behavior

1. **Auto-open failed logs** when errors occur
2. **Collapsible success logs** (closed by default)
3. **Always visible in-progress** section when active
4. **Prevent close** when processing (onInteractOutside)
5. **Retry button** at bottom if failures exist
6. **Continue button** when complete

## 📊 For STEP 2 Adaptation:

### Sections Needed:
1. **HOOKS Section**
   - Success: List of merged hook groups
   - Failed: Hook groups with errors
   - In Progress: Currently merging hooks

2. **BODY Section**
   - Success: List of merged body videos
   - Failed: Body videos with errors
   - In Progress: Currently merging body videos

### Key Differences:
- **No countdown timer** between sections (only initial + after batches)
- **Batch info:** Show "Batch X/Y" in header
- **Final videos counter:** Show "X/Y final videos" instead of phases
- **Single progress bar** per section (not per phase)

### Props Structure for STEP 2:
```typescript
{
  status: 'countdown' | 'processing' | 'complete' | 'partial' | 'error'
  countdown?: number
  totalFinalVideos: number
  currentFinalVideo: number
  currentBatch: number
  totalBatches: number
  
  // HOOKS tracking
  hooksSuccess: Array<{ name, videoCount, videoNames[] }>
  hooksFailed: Array<{ name, error }>
  hooksInProgress: Array<{ name }>
  
  // BODY tracking
  bodySuccess: Array<{ name }>
  bodyFailed: Array<{ name, error }>
  bodyInProgress: Array<{ name }>
  
  onSkipCountdown?: () => void
  onRetryFailed?: () => void
  onContinue?: () => void
  onClose?: () => void
}
```
