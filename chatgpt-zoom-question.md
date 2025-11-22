# WaveSurfer.js Zoom Issue - Need Help

## Problem

When clicking Zoom In/Out buttons in WaveSurfer.js, the waveform **jumps to a different part of the audio** instead of zooming in/out on the **current visible area**.

**Expected behavior:** Zoom should center on the current visible area (like Peaks.js does).

**Current behavior:** Zoom changes the `minPxPerSec` value, but the scroll position jumps to a random location.

---

## Current Code

### WaveSurferEditor.tsx (relevant parts)

```typescript
import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

export const WaveSurferEditor: React.FC<Props> = ({
  audioUrl,
  duration,
  // ... other props
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [zoom, setZoom] = useState(50); // minPxPerSec value
  const [isReady, setIsReady] = useState(false);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#cccccc',
      progressColor: 'transparent',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
      minPxPerSec: zoom,
      scrollParent: true,
      hideScrollbar: false,
    });

    ws.load(audioUrl);

    ws.on('ready', () => {
      setIsReady(true);
    });

    setWavesurfer(ws);

    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 2, 500));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 2, 10));
  };

  // Update WaveSurfer zoom when zoom state changes
  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    wavesurfer.zoom(zoom);
  }, [zoom, wavesurfer, isReady]);

  return (
    <div>
      <Button onClick={handleZoomIn}>Zoom In</Button>
      <Button onClick={handleZoomOut}>Zoom Out</Button>
      
      <div 
        ref={containerRef}
        className="overflow-x-auto"
        style={{ height: '120px', width: '100%' }}
      >
        <div ref={waveformRef} />
      </div>
    </div>
  );
};
```

---

## What We Need

**Goal:** When zooming in/out, the waveform should:
1. Stay centered on the **current visible area** (not jump to a different location)
2. Preserve scroll position relative to the center of the visible area
3. Behave like Peaks.js zoom (smooth, predictable)

**Context:**
- Audio files are 5-8 seconds long
- We use `scrollParent: true` to enable horizontal scrolling
- `minPxPerSec` controls zoom level (10 = zoomed out, 500 = zoomed in)

---

## Questions for ChatGPT

1. **How do we preserve scroll position when calling `wavesurfer.zoom()`?**
   - Do we need to manually calculate and set scroll position?
   - Is there a WaveSurfer.js API method to zoom while preserving center?

2. **Should we use `wavesurfer.zoom()` or recreate the instance with new `minPxPerSec`?**
   - Current approach: `wavesurfer.zoom(zoom)` in useEffect
   - Alternative: Destroy and recreate WaveSurfer with new config?

3. **How to calculate the correct scroll position after zoom?**
   - Before zoom: get current scroll position and visible center time
   - After zoom: calculate new scroll position to keep same center time visible

4. **Is there a better approach?**
   - Should we use `wavesurfer.seekTo()` after zoom?
   - Should we listen to scroll events and adjust?

---

## Reference: Working Peaks.js Zoom Code

This is how we do it in Peaks.js (works perfectly):

```typescript
const handleZoomIn = () => {
  const view = peaksInstance.views.getView('zoomview');
  
  // Get current visible area
  const currentViewStart = view.getStartTime();
  const currentViewEnd = view.getEndTime();
  const centerTime = (currentViewStart + currentViewEnd) / 2;
  
  // Calculate new window size
  const currentWindow = currentViewEnd - currentViewStart;
  const newWindow = Math.max(0.5, currentWindow / 2);
  const half = newWindow / 2;
  
  // Calculate new start time (centered on current view)
  let newStart = centerTime - half;
  if (newStart < 0) newStart = 0;
  if (newStart + newWindow > duration) {
    newStart = Math.max(0, duration - newWindow);
  }
  
  // Apply zoom
  view.setZoom({ seconds: newWindow });
  view.setStartTime(newStart);
};
```

**Can we replicate this logic in WaveSurfer.js?**

---

## Expected Solution Format

Please provide:
1. **Corrected code** for `handleZoomIn()` and `handleZoomOut()`
2. **Explanation** of how to preserve scroll position
3. **Any additional WaveSurfer.js methods** we should use

Thank you!
