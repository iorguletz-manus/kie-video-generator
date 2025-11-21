import React, { useState, useRef, useEffect } from 'react';
import Peaks, { PeaksInstance, Segment } from 'peaks.js';
import { Button } from './ui/button';
import { Play, Pause, ZoomIn, ZoomOut } from 'lucide-react';

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
  const overviewRef = useRef<HTMLDivElement>(null);
  const zoomviewRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [peaksInstance, setPeaksInstance] = useState<PeaksInstance | null>(null);
  const [trimSegment, setTrimSegment] = useState<Segment | null>(null);
  const [trimStart, setTrimStart] = useState(video.suggestedStart);
  const [trimEnd, setTrimEnd] = useState(video.suggestedEnd);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [refsReady, setRefsReady] = useState(false);
  const [windowSize, setWindowSize] = useState(Math.min(8, video.duration)); // Default 8 seconds zoom, or full duration if shorter
  const [centerTime, setCenterTime] = useState((video.suggestedStart + video.suggestedEnd) / 2); // Center point for zoom
  const isSyncingRef = useRef(false); // Prevent event loop (using ref to avoid re-renders)

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
        // Retry after a short delay
        setTimeout(checkRefs, 100);
      }
    };
    
    // Wait for DOM to render
    setTimeout(checkRefs, 0);
  }, []); // Run once on mount

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
  }, [refsReady]); // Initialize when refs are ready

  const initializePeaks = async () => {
    console.log('[VideoEditorV2] initializePeaks called');
    console.log('[VideoEditorV2] zoomviewRef.current:', zoomviewRef.current);
    console.log('[VideoEditorV2] audioRef.current:', audioRef.current);
    
    if (!zoomviewRef.current || !videoRef.current) {
      console.error('[VideoEditorV2] Missing refs!');
      return;
    }
    
    const options = {
      zoomview: {
        container: zoomviewRef.current!,
        waveformColor: '#cccccc', // Classic gray waveform line
        playheadColor: '#000000', // Black playhead
        wheelMode: 'zoom',
        segmentOptions: {
          startMarkerColor: '#22c55e', // Green for START
          endMarkerColor: '#ef4444',   // Red for END
          waveformColor: 'transparent', // No segment fill
          overlayColor: 'transparent', // No overlay
        },
      },
      mediaElement: videoRef.current!,
      dataUri: {
        json: video.peaksUrl,
      },
      keyboard: true,
      showPlayheadTime: true,
      zoomLevels: [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072],
      segmentOptions: {
        startMarkerColor: '#22c55e', // Green for START
        endMarkerColor: '#ef4444',   // Red for END
        waveformColor: 'transparent', // No segment fill
        overlayColor: 'transparent', // No overlay
      },
    };

    Peaks.init(options, (err, peaks) => {
      if (err) {
        console.error('[VideoEditorV2] Peaks.js init error:', err);
        return;
      }

      console.log('[VideoEditorV2] Peaks.js initialized successfully');
      setPeaksInstance(peaks!);

      // Create initial trim segment
      const segment = peaks!.segments.add({
        startTime: video.suggestedStart,
        endTime: video.suggestedEnd,
        editable: true,
        color: 'transparent', // No fill, only show markers
        labelText: '', // No label
      });

      setTrimSegment(segment);
      console.log('[VideoEditorV2] Trim segment created:', segment);

      // Listen to segment updates (multiple events to ensure updates)
      peaks!.on('segments.dragend', handleSegmentUpdate);
      peaks!.on('segments.dragged', handleSegmentUpdate);
      peaks!.on('segments.dragstart', (segment: Segment) => {
        console.log('[VideoEditorV2] Segment drag started:', segment);
      });
      peaks!.on('segments.change', handleSegmentUpdate);

      // Set initial zoom to 8 seconds (or full duration if shorter)
      const initialWindow = Math.min(8, video.duration);
      const view = peaks!.views.getView('zoomview');
      if (view) {
        view.setZoom({ seconds: initialWindow });
        // Center on the trim segment
        const centerTime = (video.suggestedStart + video.suggestedEnd) / 2;
        const startTime = Math.max(0, centerTime - initialWindow / 2);
        view.setStartTime(startTime);
        console.log('[VideoEditorV2] Initial zoom set to', initialWindow, 'seconds');
      }

      // No need for player event handlers - video is the source of truth
      // Peaks automatically syncs with mediaElement (videoRef)
    });
  };

  const handleSegmentUpdate = (segment: Segment) => {
    console.log('[VideoEditorV2] Segment updated:', segment);
    setTrimStart(segment.startTime);
    setTrimEnd(segment.endTime);
    if (onTrimChange) {
      onTrimChange(video.id, segment.startTime, segment.endTime);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      // Stop playback if we've reached the END marker (with 0.1s tolerance)
      if (playing && time >= trimEnd - 0.05) {
        videoRef.current.pause();
        videoRef.current.currentTime = trimEnd; // Snap to exact END position
        setPlaying(false);
        console.log('[VideoEditorV2] Playback stopped at END marker:', trimEnd);
      }
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (playing) {
      // Only control video - Peaks will sync automatically
      videoRef.current.pause();
      setPlaying(false);
    } else {
      // Start playback from START marker
      if (isFinite(trimStart) && !isNaN(trimStart)) {
        videoRef.current.currentTime = trimStart;
        videoRef.current.play();
        setPlaying(true);
      } else {
        console.error('[VideoEditorV2] trimStart is not a valid number:', trimStart);
      }
    }
  };

  const setStartMarker = () => {
    if (trimSegment && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      trimSegment.update({ startTime: currentTime });
      setTrimStart(currentTime);
      if (onTrimChange) {
        onTrimChange(video.id, currentTime, trimEnd);
      }
      console.log('[VideoEditorV2] START marker set to:', currentTime);
    }
  };

  const setEndMarker = () => {
    if (trimSegment && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      trimSegment.update({ endTime: currentTime });
      setTrimEnd(currentTime);
      if (onTrimChange) {
        onTrimChange(video.id, trimStart, currentTime);
      }
      console.log('[VideoEditorV2] END marker set to:', currentTime);
    }
  };

   const seekToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
      // Peaks will sync automatically
    }
  };

  const seekToEnd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimEnd;
      // Peaks will sync automatically
    }
  };

  const handleZoomIn = () => {
    if (!peaksInstance) {
      console.error('[VideoEditorV2] No peaks instance!');
      return;
    }

    const view = peaksInstance.views.getView('zoomview');
    if (!view) {
      console.error('[VideoEditorV2] No zoomview found!');
      return;
    }

    const duration = video.duration;
    if (!duration) return;

    // Calculate new window (in seconds)
    const MIN_WINDOW = 0.5; // 500ms minimum
    const currentWindow = windowSize || duration;
    const newWindow = Math.max(MIN_WINDOW, currentWindow / 2);

    // Center on current playback time or midpoint of START-END segment
    const centerTime = videoRef.current?.currentTime || (trimStart + trimEnd) / 2;
    const half = newWindow / 2;

    // Start of window, centered on centerTime
    let newStart = centerTime - half;
    if (newStart < 0) newStart = 0;

    // Ensure we don't exceed duration
    if (newStart + newWindow > duration) {
      newStart = Math.max(0, duration - newWindow);
    }

    console.log('[VideoEditorV2] Zoom In:', {
      currentWindow,
      newWindow,
      centerTime,
      newStart,
      newEnd: newStart + newWindow,
    });

    // PEAKS V4 API: setZoom with seconds
    view.setZoom({ seconds: newWindow });
    view.setStartTime(newStart);

    setWindowSize(newWindow);
  };

  const handleZoomOut = () => {
    if (!peaksInstance) {
      console.error('[VideoEditorV2] No peaks instance!');
      return;
    }

    const view = peaksInstance.views.getView('zoomview');
    if (!view) {
      console.error('[VideoEditorV2] No zoomview found!');
      return;
    }

    const duration = video.duration;
    if (!duration) return;

    const MAX_WINDOW = duration; // Maximum is full video duration
    const currentWindow = windowSize || duration;
    const newWindow = Math.min(MAX_WINDOW, currentWindow * 2);

    // Center on current playback time or midpoint of START-END segment
    const centerTime = videoRef.current?.currentTime || (trimStart + trimEnd) / 2;
    const half = newWindow / 2;

    let newStart = centerTime - half;
    if (newStart < 0) newStart = 0;

    if (newStart + newWindow > duration) {
      newStart = Math.max(0, duration - newWindow);
    }

    console.log('[VideoEditorV2] Zoom Out:', {
      currentWindow,
      newWindow,
      centerTime,
      newStart,
      newEnd: newStart + newWindow,
    });

    // PEAKS V4 API: setZoom with seconds
    view.setZoom({ seconds: newWindow });
    view.setStartTime(newStart);

    setWindowSize(newWindow);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0:00.00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border-2 border-purple-300 rounded-lg p-6 bg-white">
      {/* Video Player */}
      <div className="mb-6">
        {/* Video Name */}
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
        {/* Hidden Audio Element for Peaks.js */}
        <audio 
          id="peaks-audio-element"
          ref={audioRef} 
          src={video.audioUrl} 
          crossOrigin="anonymous"
          style={{ display: 'none' }}
        />

        {/* Play/Pause Controls */}
        <div className="flex justify-center mt-4 gap-2">
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
            ▶ Seek to START
          </Button>
          <Button
            onClick={seekToEnd}
            size="sm"
            variant="outline"
          >
            ▶ Seek to END
          </Button>
        </div>

      </div>

      {/* Video Text (from database) - Above Waveform */}
      {video.text && (
        <div className="mb-4 mx-auto" style={{ maxWidth: '300px' }}>
          <p className="text-sm text-gray-800 text-center">
            {video.redStart !== undefined && video.redEnd !== undefined ? (
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

      {/* Waveform Timeline */}
      <div className="mb-6">
        {/* Header with Current Time and Zoom Controls */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">
            🎵 Waveform Timeline
          </h4>
          <div className="flex items-center gap-4">
            {/* Trimmed Duration Info */}
            <span className="text-sm text-gray-600">
              ✂️ Trimmed: <span className="font-mono font-bold text-purple-600">{formatTime(Math.max(0, trimEnd - trimStart))}</span>
              {' | '}
              Cut: <span className="font-mono text-green-600">{formatTime(trimStart)}</span>
              {' → '}
              <span className="font-mono text-red-600">{formatTime(trimEnd)}</span>
            </span>
            {/* Current Time Display */}
            <span className="text-sm text-gray-600">
              Current: <span className="font-mono font-bold text-purple-600">{formatTime(currentTime)}</span>
              {' / '}
              <span className="font-mono">{formatTime(video.duration)}</span>
            </span>
            {/* Zoom Controls */}
            <div className="flex gap-2">
              <Button
                onClick={handleZoomOut}
                size="sm"
                variant="outline"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleZoomIn}
                size="sm"
                variant="outline"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Waveform Zoomview */}
        <div 
          id="peaks-zoomview-container"
          ref={zoomviewRef} 
          className="waveform-zoomview border border-gray-300 rounded"
          style={{ height: '120px', width: '100%' }}
        />

      </div>

      {/* Trim Markers - Dual Control: Drag on waveform OR use buttons */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Button
              onClick={setStartMarker}
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700"
            >
              🟢 Set START Here
            </Button>
            <div className="text-center mt-2">
              <span className="text-sm font-mono font-bold text-green-700">
                {formatTime(trimStart)}
              </span>
            </div>
          </div>
          <div>
            <Button
              onClick={setEndMarker}
              size="sm"
              className="w-full bg-red-600 hover:bg-red-700"
            >
              🔴 Set END Here
            </Button>
            <div className="text-center mt-2">
              <span className="text-sm font-mono font-bold text-red-700">
                {formatTime(trimEnd)}
              </span>
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
  // Only re-render if video.id changes
  return prevProps.video.id === nextProps.video.id;
});
