# WaveSurfer.js Zoom Still Not Working - Code Review Needed

## Problem

Implemented the zoom formula you suggested, but **zoom still jumps to different parts** of the waveform instead of staying centered on the current visible area.

---

## Current Implementation

### Full WaveSurferEditor.tsx Component

```typescript
import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, Lock, Unlock } from 'lucide-react';

interface WaveSurferEditorProps {
  audioUrl: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  initialStart: number;
  initialEnd: number;
  duration: number;
  onTrimChange: (start: number, end: number) => void;
  isStartLocked: boolean;
  isEndLocked: boolean;
  onStartLockToggle: () => void;
  onEndLockToggle: () => void;
}

export const WaveSurferEditor: React.FC<WaveSurferEditorProps> = ({
  audioUrl,
  videoRef,
  initialStart,
  initialEnd,
  duration,
  onTrimChange,
  isStartLocked,
  isEndLocked,
  onStartLockToggle,
  onEndLockToggle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [trimStart, setTrimStart] = useState(initialStart);
  const [trimEnd, setTrimEnd] = useState(initialEnd);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(50); // minPxPerSec value
  const [isReady, setIsReady] = useState(false);

  // Format time helper
  const formatTime = (seconds: number): string => {
    return seconds.toFixed(2);
  };

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
      console.log('[WaveSurferEditor] Ready!');
      setIsReady(true);
      // Fix scroll jumping on ready
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
      }
    });

    // Sync with video playback
    ws.on('interaction', () => {
      if (videoRef.current) {
        videoRef.current.currentTime = ws.getCurrentTime();
      }
    });

    setWavesurfer(ws);

    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  // ⚠️ ZOOM HANDLER - THIS IS THE PROBLEM AREA
  const handleZoom = (factor: number) => {
    if (!wavesurfer || !containerRef.current) return;

    const container = containerRef.current;

    // 1) Measure current visible center
    const visibleWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    const centerPx = scrollLeft + visibleWidth / 2;

    // 2) Convert px -> time
    const oldPxPerSec = zoom;
    const centerTime = centerPx / oldPxPerSec;

    // 3) Calculate new zoom
    const newZoom = Math.min(Math.max(oldPxPerSec * factor, 10), 500);

    setZoom(newZoom);

    // 4) After zoom takes effect, reposition scroll
    requestAnimationFrame(() => {
      const newCenterPx = centerTime * newZoom;
      const newScrollLeft = newCenterPx - visibleWidth / 2;

      container.scrollLeft = Math.max(newScrollLeft, 0);
    });
  };

  const handleZoomIn = () => handleZoom(2);
  const handleZoomOut = () => handleZoom(0.5);

  // Update WaveSurfer zoom when zoom state changes (only after ready)
  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    wavesurfer.zoom(zoom);
  }, [zoom, wavesurfer, isReady]);

  // ... rest of component (markers, cursor, etc.)

  return (
    <div className="mt-6 p-4 bg-blue-50 border border-blue-300 rounded">
      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-2">
        <Button onClick={onStartLockToggle}>Lock START</Button>
        
        {/* Zoom Controls */}
        <div className="flex gap-1">
          <Button onClick={handleZoomOut}>
            <ZoomOut />
          </Button>
          <Button onClick={handleZoomIn}>
            <ZoomIn />
          </Button>
        </div>

        <Button onClick={onEndLockToggle}>Lock END</Button>
      </div>

      {/* Waveform Container */}
      <div 
        ref={containerRef}
        className="relative border border-blue-300 rounded bg-white overflow-x-auto"
        style={{ height: '120px', width: '100%' }}
      >
        <div ref={waveformRef} />
        {/* Markers, cursor, etc. */}
      </div>
    </div>
  );
};
```

---

## What's Happening

1. **User clicks Zoom In/Out**
2. **`handleZoom(factor)` runs:**
   - Calculates `centerTime` from current scroll position
   - Updates `zoom` state (triggers `useEffect`)
   - `requestAnimationFrame` → sets new `scrollLeft`
3. **`useEffect` runs:**
   - Calls `wavesurfer.zoom(newZoom)`
   - WaveSurfer redraws canvas with new `minPxPerSec`
4. **Result:** Waveform **jumps to different location** instead of staying centered

---

## Questions

1. **Is `requestAnimationFrame` the right timing?**
   - Should we wait for WaveSurfer to finish redrawing?
   - Should we use a different callback (e.g., `ws.on('redraw')`)?

2. **Is the formula correct?**
   ```typescript
   centerTime = centerPx / oldPxPerSec;
   newScrollLeft = centerTime * newZoom - visibleWidth / 2;
   ```
   - Does WaveSurfer's `minPxPerSec` work differently than expected?

3. **Should we handle scroll differently?**
   - Do we need to account for container padding/borders?
   - Should we use `waveformRef` instead of `containerRef`?

4. **Is there a race condition?**
   - `setZoom(newZoom)` → triggers `useEffect` → `wavesurfer.zoom()`
   - `requestAnimationFrame` → sets `scrollLeft`
   - Are these happening in the wrong order?

---

## Expected Behavior

**Like Peaks.js:** Zoom should stay centered on the current visible area.

**Peaks.js working code (for reference):**
```typescript
const handleZoomIn = () => {
  const view = peaksInstance.views.getView('zoomview');
  
  const currentViewStart = view.getStartTime();
  const currentViewEnd = view.getEndTime();
  const centerTime = (currentViewStart + currentViewEnd) / 2;
  
  const currentWindow = currentViewEnd - currentViewStart;
  const newWindow = Math.max(0.5, currentWindow / 2);
  const half = newWindow / 2;
  
  let newStart = centerTime - half;
  if (newStart < 0) newStart = 0;
  if (newStart + newWindow > duration) {
    newStart = Math.max(0, duration - newWindow);
  }
  
  view.setZoom({ seconds: newWindow });
  view.setStartTime(newStart);
};
```

---

## What We Need

**Please review the code and identify:**
1. What's wrong with the current implementation?
2. How to fix the scroll calculation/timing?
3. Any WaveSurfer.js-specific gotchas we're missing?

Thank you!
