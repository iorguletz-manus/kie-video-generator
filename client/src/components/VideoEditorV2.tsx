import React, { useState, useRef, useEffect } from 'react';
import Peaks, { PeaksInstance, Segment } from 'peaks.js';
import { Button } from './ui/button';
import { Play, Pause, ZoomIn, ZoomOut, Lock, Unlock } from 'lucide-react';

interface VideoEditorV2Props {
  video: {
    id: string;
    videoName: string;
    videoUrl: string;
    audioUrl: string;
    peaksUrl: string;
    suggestedStart: number;  // seconds
    suggestedEnd: number;    // seconds
    duration: number;
    text?: string;
    redStart?: number;
    redEnd?: number;
  };
  onTrimChange?: (videoId: string, trimStart: number, trimEnd: number) => void;
}

export const VideoEditorV2 = React.memo(function VideoEditorV2({ video, onTrimChange }: VideoEditorV2Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const zoomviewRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  
  const [peaksInstance, setPeaksInstance] = useState<PeaksInstance | null>(null);
  const [trimSegment, setTrimSegment] = useState<Segment | null>(null);
  const [trimStart, setTrimStart] = useState(video.suggestedStart);
  const [trimEnd, setTrimEnd] = useState(video.suggestedEnd);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [refsReady, setRefsReady] = useState(false);
  const [windowSize, setWindowSize] = useState(Math.min(8, video.duration));
  
  // Lock system
  const [isStartLocked, setIsStartLocked] = useState(false);
  const [isEndLocked, setIsEndLocked] = useState(false);
  
  // Playhead (black marker) - only visible when START is locked
  const [playheadTime, setPlayheadTime] = useState<number | null>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  console.log('[VideoEditorV2] Received video:', video);

  // Check if refs are ready after DOM renders
  useEffect(() => {
    const checkRefs = () => {
      if (zoomviewRef.current && audioRef.current) {
        console.log('[VideoEditorV2] All refs are ready!');
        setRefsReady(true);
      } else {
        console.log('[VideoEditorV2] Refs not ready yet, retrying...', {
          zoomview: !!zoomviewRef.current,
          audio: !!audioRef.current
        });
        setTimeout(checkRefs, 100);
      }
    };
    
    setTimeout(checkRefs, 0);
  }, []);

  // Initialize Peaks.js when refs are ready
  useEffect(() => {
    if (!refsReady) {
      console.log('[VideoEditorV2] Waiting for refs to be ready...');
      return;
    }

    console.log('[VideoEditorV2] Initializing Peaks.js...');
    initializePeaks();

    return () => {
      console.log('[VideoEditorV2] Destroying Peaks.js instance');
      peaksInstance?.destroy();
    };
  }, [refsReady]);

  const initializePeaks = async () => {
    console.log('[VideoEditorV2] initializePeaks called');
    
    if (!zoomviewRef.current || !videoRef.current) {
      console.error('[VideoEditorV2] Missing refs!');
      return;
    }
    
    const options = {
      zoomview: {
        container: zoomviewRef.current!,
        waveformColor: '#cccccc',
        playheadColor: 'transparent', // Hide default playhead, we'll use custom
        wheelMode: 'zoom' as const,
        segmentOptions: {
          startMarkerColor: 'transparent', // Hide default markers
          endMarkerColor: 'transparent',
          waveformColor: 'transparent',
          overlayColor: 'transparent',
        },
      },
      mediaElement: videoRef.current!,
      dataUri: {
        json: video.peaksUrl,
      },
      keyboard: true,
      showPlayheadTime: false,
      zoomLevels: [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072],
      segmentOptions: {
        startMarkerColor: 'transparent',
        endMarkerColor: 'transparent',
        waveformColor: 'transparent',
        overlayColor: 'transparent',
      },
    };

    Peaks.init(options, (err, peaks) => {
      if (err) {
        console.error('[VideoEditorV2] Peaks.js init error:', err);
        return;
      }

      console.log('[VideoEditorV2] Peaks.js initialized successfully');
      setPeaksInstance(peaks!);

      // Create initial trim segment (non-editable, just for visual reference)
      const segment = peaks!.segments.add({
        startTime: video.suggestedStart,
        endTime: video.suggestedEnd,
        editable: false, // We handle dragging with custom overlay
        color: 'transparent',
        labelText: '',
      });

      setTrimSegment(segment);
      console.log('[VideoEditorV2] Trim segment created:', segment);

      // Set initial zoom
      const initialWindow = Math.min(8, video.duration);
      const view = peaks!.views.getView('zoomview');
      if (view) {
        view.setZoom({ seconds: initialWindow });
        const centerTime = (video.suggestedStart + video.suggestedEnd) / 2;
        const startTime = Math.max(0, centerTime - initialWindow / 2);
        view.setStartTime(startTime);
        console.log('[VideoEditorV2] Initial zoom set to', initialWindow, 'seconds');
      }
    });
  };

  // Update segment when trim times change
  useEffect(() => {
    if (trimSegment) {
      trimSegment.update({
        startTime: trimStart,
        endTime: trimEnd,
      });
    }
  }, [trimStart, trimEnd, trimSegment]);

  // When START becomes locked, initialize playhead between START and END
  useEffect(() => {
    if (isStartLocked && playheadTime === null) {
      // Initialize playhead at midpoint between START and END
      const midpoint = (trimStart + trimEnd) / 2;
      setPlayheadTime(midpoint);
      console.log('[VideoEditorV2] START locked, playhead initialized at midpoint', midpoint);
    } else if (!isStartLocked && playheadTime !== null) {
      setPlayheadTime(null);
      console.log('[VideoEditorV2] START unlocked, playhead hidden');
    }
  }, [isStartLocked, trimStart, trimEnd]);

  // Ensure playhead stays between START and END when they change
  useEffect(() => {
    if (isStartLocked && playheadTime !== null) {
      if (playheadTime < trimStart || playheadTime > trimEnd) {
        const clampedTime = Math.max(trimStart, Math.min(playheadTime, trimEnd));
        setPlayheadTime(clampedTime);
      }
    }
  }, [trimStart, trimEnd, isStartLocked, playheadTime]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      // Stop playback if we've reached the END marker
      if (playing && time >= trimEnd - 0.05) {
        videoRef.current.pause();
        videoRef.current.currentTime = trimEnd;
        setPlaying(false);
        console.log('[VideoEditorV2] Playback stopped at END marker:', trimEnd);
      }
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      // Start playback from appropriate position
      if (isStartLocked && playheadTime !== null) {
        // If START is locked, play from playhead position
        videoRef.current.currentTime = playheadTime;
        console.log('[VideoEditorV2] Playing from playhead:', playheadTime);
      } else {
        // Otherwise play from START marker
        videoRef.current.currentTime = trimStart;
        console.log('[VideoEditorV2] Playing from START:', trimStart);
      }
      videoRef.current.play();
      setPlaying(true);
    }
  };

  const seekToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
    }
  };

  const seekToEnd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimEnd;
    }
  };

  // Convert time to pixel position on waveform
  const timeToPixel = (time: number): number => {
    if (!peaksInstance || !waveformContainerRef.current) return 0;
    
    const view = peaksInstance.views.getView('zoomview');
    if (!view) return 0;
    
    const viewStartTime = view.getStartTime();
    const viewEndTime = view.getEndTime();
    const containerWidth = waveformContainerRef.current.offsetWidth;
    
    const relativeTime = time - viewStartTime;
    const viewDuration = viewEndTime - viewStartTime;
    
    return (relativeTime / viewDuration) * containerWidth;
  };

  // Convert pixel position to time
  const pixelToTime = (pixel: number): number => {
    if (!peaksInstance || !waveformContainerRef.current) return 0;
    
    const view = peaksInstance.views.getView('zoomview');
    if (!view) return 0;
    
    const viewStartTime = view.getStartTime();
    const viewEndTime = view.getEndTime();
    const containerWidth = waveformContainerRef.current.offsetWidth;
    
    const viewDuration = viewEndTime - viewStartTime;
    const relativeTime = (pixel / containerWidth) * viewDuration;
    
    return Math.max(0, Math.min(video.duration, viewStartTime + relativeTime));
  };

  // Mouse down on marker
  const handleMarkerMouseDown = (e: React.MouseEvent, markerType: 'start' | 'end' | 'playhead') => {
    // Check if marker is locked
    if (markerType === 'start' && isStartLocked) return;
    if (markerType === 'end' && isEndLocked) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(markerType);
    dragStartX.current = e.clientX;
    
    if (markerType === 'start') {
      dragStartTime.current = trimStart;
    } else if (markerType === 'end') {
      dragStartTime.current = trimEnd;
    } else if (markerType === 'playhead' && playheadTime !== null) {
      dragStartTime.current = playheadTime;
    }
    
    console.log('[VideoEditorV2] Started dragging', markerType);
  };

  // Mouse move (global)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !waveformContainerRef.current) return;
      
      const rect = waveformContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const newTime = pixelToTime(relativeX);
      
      if (isDragging === 'start') {
        const clampedTime = Math.max(0, Math.min(newTime, trimEnd - 0.1));
        setTrimStart(clampedTime);
        if (onTrimChange) {
          onTrimChange(video.id, clampedTime, trimEnd);
        }
        // Sync video to new START position
        if (videoRef.current) {
          videoRef.current.currentTime = clampedTime;
        }
      } else if (isDragging === 'end') {
        const clampedTime = Math.max(trimStart + 0.1, Math.min(newTime, video.duration));
        setTrimEnd(clampedTime);
        if (onTrimChange) {
          onTrimChange(video.id, trimStart, clampedTime);
        }
        // Sync video to new END position
        if (videoRef.current) {
          videoRef.current.currentTime = clampedTime;
        }
      } else if (isDragging === 'playhead') {
        const clampedTime = Math.max(0, Math.min(newTime, video.duration));
        setPlayheadTime(clampedTime);
        // Sync video to playhead position
        if (videoRef.current) {
          videoRef.current.currentTime = clampedTime;
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        console.log('[VideoEditorV2] Stopped dragging', isDragging);
        setIsDragging(null);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, trimStart, trimEnd, playheadTime, video.duration, video.id, onTrimChange]);

  const handleZoomIn = () => {
    if (!peaksInstance) return;

    const view = peaksInstance.views.getView('zoomview');
    if (!view) return;

    const duration = video.duration;
    if (!duration) return;

    const MIN_WINDOW = 0.5;
    const currentWindow = windowSize || duration;
    const newWindow = Math.max(MIN_WINDOW, currentWindow / 2);

    const centerTime = videoRef.current?.currentTime || (trimStart + trimEnd) / 2;
    const half = newWindow / 2;

    let newStart = centerTime - half;
    if (newStart < 0) newStart = 0;

    if (newStart + newWindow > duration) {
      newStart = Math.max(0, duration - newWindow);
    }

    view.setZoom({ seconds: newWindow });
    view.setStartTime(newStart);

    setWindowSize(newWindow);
  };

  const handleZoomOut = () => {
    if (!peaksInstance) return;

    const view = peaksInstance.views.getView('zoomview');
    if (!view) return;

    const duration = video.duration;
    if (!duration) return;

    const MAX_WINDOW = duration;
    const currentWindow = windowSize || duration;
    const newWindow = Math.min(MAX_WINDOW, currentWindow * 2);

    const centerTime = videoRef.current?.currentTime || (trimStart + trimEnd) / 2;
    const half = newWindow / 2;

    let newStart = centerTime - half;
    if (newStart < 0) newStart = 0;

    if (newStart + newWindow > duration) {
      newStart = Math.max(0, duration - newWindow);
    }

    view.setZoom({ seconds: newWindow });
    view.setStartTime(newStart);

    setWindowSize(newWindow);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0.00';
    }
    const secs = Math.floor(seconds);
    const ms = Math.floor((seconds % 1) * 100);
    return `${secs}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border-2 border-purple-300 rounded-lg p-3 bg-white">
      {/* Video Player */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-center mb-3 text-gray-900">
          {video.videoName}
        </h3>
        <div 
          className="relative bg-black rounded-lg overflow-hidden mx-auto" 
          style={{ aspectRatio: '9/16', width: '300px' }}
        >
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="absolute top-0 left-0 w-full h-full object-contain"
            playsInline
            crossOrigin="anonymous"
            onTimeUpdate={handleVideoTimeUpdate}
          />
        </div>
        <audio 
          id="peaks-audio-element"
          ref={audioRef} 
          src={video.audioUrl} 
          crossOrigin="anonymous"
          style={{ display: 'none' }}
        />

        {/* Play/Pause Controls */}
        <div className="flex justify-center mt-2 gap-2">
          <Button
            onClick={handlePlayPause}
            size="sm"
            variant="outline"
          >
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button
            onClick={seekToStart}
            size="sm"
            variant="outline"
          >
            ▶ JUMP to START
          </Button>
        </div>
      </      {/* Video Text (from database) - Above Waveform */}
      {video.text && (
        <div className="mb-2 mx-auto" style={{ maxWidth: '300px' }}>
          <p className="text-xs text-gray-800 text-center">t !== undefined && video.redEnd !== undefined ? (
              <>
                {video.text.substring(0, video.redStart)}
                <span className="text-red-600 font-bold">
                  {video.text.substring(video.redStart, video.redEnd)}
                </span>
                {video.text.substring(video.redEnd)}
              </>
            ) : (
              video.text
            )}
          </p>
        </div>
      )}

      {/* Lock Controls */}
      <div className="mb-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setIsStartLocked(!isStartLocked)}
            size="sm"
            variant={isStartLocked ? "default" : "outline"}
            className={isStartLocked ? "bg-gray-600 hover:bg-gray-700" : ""}
          >
            {isStartLocked ? <Lock className="w-4 h-4 mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}
            {isStartLocked ? 'START Locked' : 'Lock START'}
          </Button>
          <Button
            onClick={() => setIsEndLocked(!isEndLocked)}
            size="sm"
            variant={isEndLocked ? "default" : "outline"}
            className={isEndLocked ? "bg-gray-600 hover:bg-gray-700" : ""}
          >
            {isEndLocked ? <Lock className="w-4 h-4 mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}
            {isEndLocked ? 'END Locked' : 'Lock END'}
          </Button>
        </div>
      </div>

      {/* Waveform Timeline */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold text-gray-900">
            🎵 Wav            {/* Current Time Display */}
            <span className="text-xs text-gray-600">
              Current: <span className="font-mono font-bold text-purple-600">{formatTime(currentTime)}</span>
              {' / '}
              <span className="font-mono">{formatTime(video.duration)}</span>
            </span>
            <div className="flex gap-2">
              <Button onClick={handleZoomOut} size="sm" variant="outline">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button onClick={handleZoomIn} size="sm" variant="outline">
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Waveform Container with Custom Markers Overlay */}
        <div 
          ref={waveformContainerRef}
          className="relative"
          style={{ height: '120px', width: '100%' }}
        >
          {/* Peaks.js Waveform */}
          <div 
            id="peaks-zoomview-container"
            ref={zoomviewRef} 
            className="border border-gray-300 rounded"
            style={{ height: '120px', width: '100%' }}
          />

          {/* Custom Markers Overlay */}
          {peaksInstance && (
            <>
              {/* START Marker (Green) - Line + Handle */}
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
                    borderRadius: '2px',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  }}
                  title={isStartLocked ? "START (Locked)" : "START (Drag to move)"}
                />
              </div>

              {/* END Marker (Red) - Line + Handle */}
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
                    borderRadius: '2px',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  }}
                  title={isEndLocked ? "END (Locked)" : "END (Drag to move)"}
                />
              </div>

              {/* PLAYHEAD Marker (Black) - Only visible when START is locked */}
              {isStartLocked && playheadTime !== null && (
                <div
                  onMouseDown={(e) => handleMarkerMouseDown(e, 'playhead')}
                  style={{
                    position: 'absolute',
                    left: `${timeToPixel(playheadTime)}px`,
                    top: 0,
                    width: '1.5px',
                    height: '120px',
                    backgroundColor: '#000000',
                    cursor: 'ew-resize',
                    transform: 'translateX(-0.75px)',
                    zIndex: 9,
                  }}
                  title="PLAYHEAD (Drag to move)"
                >
                  {/* Playhead handle at top */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#000000',
                      borderRadius: '2px',
                      border: '2px solid white',
                    }}
                  />
                </div>
              )}

              {/* LIVE Playback Marker (Blue) - Shows current video position */}
              <div
                style={{
                  position: 'absolute',
                  left: `${timeToPixel(currentTime)}px`,
                  top: 0,
                  width: '2px',
                  height: '120px',
                  backgroundColor: '#3b82f6',
                  transform: 'translateX(-1px)',
                  zIndex: 8,
                  pointerEvents: 'none',
                }}
                title="Current playback position"
              >
                {/* Triangle marker at top */}
                <div
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '8px solid #3b82f6',
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Marker Info */}
      <div className="mb-2 mt-1">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-600 mb-1">
              🟢 START {isStartLocked && '(Locked)'}
            </div>
            <div className="text-sm font-mono font-bold" style={{ color: isStartLocked ? '#9ca3af' : '#22c55e' }}>
              {formatTime(trimStart)}
            </div>
          </div>
          {isStartLocked && playheadTime !== null ? (
            <div>
              <div className="text-xs text-gray-600 mb-1">
                ⚫ PLAYHEAD
              </div>
              <div className="text-sm font-mono font-bold text-black">
                {formatTime(playheadTime)}
              </div>
            </div>
          ) : (
            <div></div>
          )}
          <div>
            <div className="text-xs text-gray-600 mb-1">
              🔴 END {isEndLocked && '(Locked)'}
            </div>
            <div className="text-sm font-mono font-bold" style={{ color: isEndLocked ? '#9ca3af' : '#ef4444' }}>
              {formatTime(trimEnd)}
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {trimStart >= trimEnd && (
        <div className="p-3 bg-red-50 border-2 border-red-300 rounded text-center">
          <p className="text-sm text-red-700 font-semibold">
            ⚠️ START must be before END
          </p>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.video.id === nextProps.video.id;
});
