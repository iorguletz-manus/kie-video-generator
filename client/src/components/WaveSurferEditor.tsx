import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, Lock, Unlock } from 'lucide-react';

interface WaveSurferEditorProps {
  audioUrl: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  initialStart: number; // seconds
  initialEnd: number; // seconds
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

  // Format time helper - simple seconds format
  const formatTime = (seconds: number): string => {
    return seconds.toFixed(2);
  };

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#cccccc',
      progressColor: 'transparent', // Hide default progress, we'll use custom cursor
      cursorColor: 'transparent', // Hide default cursor
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

  // Zoom handler with manual scroll calculation (like Peaks.js)
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

  // Sync cursor with video playback (smooth, 60fps)
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    let animationFrameId: number;

    const updateCursor = () => {
      setCurrentTime(video.currentTime);
      animationFrameId = requestAnimationFrame(updateCursor);
    };

    animationFrameId = requestAnimationFrame(updateCursor);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [videoRef]);

  // Convert pixel to time
  const pixelToTime = (pixel: number): number => {
    if (!containerRef.current || !duration) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const relativePixel = pixel - rect.left;
    const containerWidth = rect.width;
    return (relativePixel / containerWidth) * duration;
  };

  // Convert time to pixel
  const timeToPixel = (time: number): number => {
    if (!containerRef.current || !duration) return 0;
    const containerWidth = containerRef.current.offsetWidth;
    return (time / duration) * containerWidth;
  };

  // Handle marker drag
  const handleMarkerMouseDown = (e: React.MouseEvent, marker: 'start' | 'end') => {
    if ((marker === 'start' && isStartLocked) || (marker === 'end' && isEndLocked)) return;
    
    e.preventDefault();
    setIsDragging(marker);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const time = pixelToTime(e.clientX);

      if (isDragging === 'start') {
        const newStart = Math.max(0, Math.min(time, trimEnd - 0.1));
        setTrimStart(newStart);
        onTrimChange(newStart, trimEnd);
      } else if (isDragging === 'end') {
        const newEnd = Math.min(duration, Math.max(time, trimStart + 0.1));
        setTrimEnd(newEnd);
        onTrimChange(trimStart, newEnd);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, trimStart, trimEnd, duration]);

  // Generate time axis labels
  const generateTimeLabels = () => {
    const labels = [];
    const step = duration > 5 ? 1 : 0.5; // 1s intervals for >5s, 0.5s for shorter
    for (let t = 0; t <= duration; t += step) {
      labels.push(t);
    }
    return labels;
  };

  return (
    <div className="mt-6 p-4 bg-blue-50 border border-blue-300 rounded">
      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-2">
        {/* Lock START Button */}
        <Button
          onClick={onStartLockToggle}
          size="sm"
          variant={isStartLocked ? "default" : "outline"}
          className="h-7 text-xs px-2"
        >
          {isStartLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
          Lock START
        </Button>

        {/* Zoom Controls */}
        <div className="flex gap-1">
          <Button onClick={handleZoomOut} size="sm" variant="outline" className="h-6 w-6 p-0">
            <ZoomOut className="w-3 h-3" />
          </Button>
          <Button onClick={handleZoomIn} size="sm" variant="outline" className="h-6 w-6 p-0">
            <ZoomIn className="w-3 h-3" />
          </Button>
        </div>

        {/* Current Time Display */}
        <span className="text-xs text-gray-600 whitespace-nowrap font-mono">
          Current: <span className="font-bold text-purple-600">{formatTime(currentTime)}</span>
          {' / '}
          <span>{formatTime(duration)}</span>
        </span>

        {/* Lock END Button */}
        <Button
          onClick={onEndLockToggle}
          size="sm"
          variant={isEndLocked ? "default" : "outline"}
          className="h-7 text-xs px-2"
        >
          {isEndLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
          Lock END
        </Button>
      </div>

      {/* Waveform Container */}
      <div 
        ref={containerRef}
        className="relative border border-blue-300 rounded bg-white overflow-x-auto"
        style={{ height: '120px', width: '100%' }}
      >
        <div ref={waveformRef} />

        {/* Custom Playhead Cursor (Blue line) */}
        <div
          style={{
            position: 'absolute',
            left: `${timeToPixel(currentTime)}px`,
            top: 0,
            width: '2px',
            height: '120px',
            backgroundColor: '#3b82f6',
            pointerEvents: 'none',
            zIndex: 8,
            transform: 'translateX(-1px)',
          }}
        />

        {/* START Marker (Green) - Identical to Peaks.js */}
        <div
          style={{
            position: 'absolute',
            left: `${timeToPixel(trimStart)}px`,
            top: 0,
            transform: 'translateX(-1px)',
            zIndex: 10,
          }}
        >
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '2px',
              height: '120px',
              backgroundColor: isStartLocked ? '#d1d5db' : '#22c55e',
              pointerEvents: 'none',
            }}
          />
          {/* Draggable handle */}
          <div
            onMouseDown={(e) => handleMarkerMouseDown(e, 'start')}
            style={{
              position: 'absolute',
              left: '-5px',
              top: 0,
              width: '12px',
              height: '12px',
              backgroundColor: isStartLocked ? '#d1d5db' : '#22c55e',
              cursor: isStartLocked ? 'not-allowed' : 'ew-resize',
              pointerEvents: isStartLocked ? 'none' : 'auto',
              borderRadius: '2px',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
            title={isStartLocked ? "START (Locked)" : "START (Drag to move)"}
          />
        </div>

        {/* END Marker (Red) - Identical to Peaks.js */}
        <div
          style={{
            position: 'absolute',
            left: `${timeToPixel(trimEnd)}px`,
            top: 0,
            transform: 'translateX(-1px)',
            zIndex: 10,
          }}
        >
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '2px',
              height: '120px',
              backgroundColor: isEndLocked ? '#d1d5db' : '#ef4444',
              pointerEvents: 'none',
            }}
          />
          {/* Draggable handle */}
          <div
            onMouseDown={(e) => handleMarkerMouseDown(e, 'end')}
            style={{
              position: 'absolute',
              left: '-5px',
              top: 0,
              width: '12px',
              height: '12px',
              backgroundColor: isEndLocked ? '#d1d5db' : '#ef4444',
              cursor: isEndLocked ? 'not-allowed' : 'ew-resize',
              pointerEvents: isEndLocked ? 'none' : 'auto',
              borderRadius: '2px',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
            title={isEndLocked ? "END (Locked)" : "END (Drag to move)"}
          />
        </div>
      </div>

      {/* Time Axis (seconds below waveform) */}
      <div className="relative mt-1" style={{ height: '20px' }}>
        {generateTimeLabels().map((time) => (
          <div
            key={time}
            style={{
              position: 'absolute',
              left: `${timeToPixel(time)}px`,
              transform: 'translateX(-50%)',
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: 'monospace',
            }}
          >
            {time.toFixed(1)}s
          </div>
        ))}
      </div>

      {/* Time Displays - Positioned exactly like Peaks.js */}
      <div className="flex justify-between items-center mt-3">
        <div style={{ marginLeft: `${timeToPixel(trimStart)}px` }}>
          <div className="text-xs text-gray-600 mb-1">
            🟢 START {isStartLocked && '(Locked)'}
          </div>
          <div className="text-sm font-mono font-bold" style={{ color: isStartLocked ? '#9ca3af' : '#22c55e' }}>
            {formatTime(trimStart)}
          </div>
        </div>
        <div style={{ marginRight: `${containerRef.current ? containerRef.current.offsetWidth - timeToPixel(trimEnd) : 0}px` }}>
          <div className="text-xs text-gray-600 mb-1">
            🔴 END {isEndLocked && '(Locked)'}
          </div>
          <div className="text-sm font-mono font-bold" style={{ color: isEndLocked ? '#9ca3af' : '#ef4444' }}>
            {formatTime(trimEnd)}
          </div>
        </div>
      </div>

      {!audioUrl && (
        <div className="text-xs text-blue-600 mt-2">
          ⚠️ No audio URL available
        </div>
      )}
    </div>
  );
};
