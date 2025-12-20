import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peaks, { PeaksInstance, Segment } from 'peaks.js';
import { Button } from './ui/button';
import { Play, Pause, ZoomIn, ZoomOut, Lock, Unlock } from 'lucide-react';
import { WaveSurferEditor } from './WaveSurferEditor';

// OVERLAY FEATURE FLAG - Set to false to disable overlay completely
const OVERLAY_ENABLED = true;

interface VideoEditorV2Props {
  video: {
    id: string;
    videoName: string;
    videoUrl: string;
    audioUrl: string;
    peaksUrl: string;
    cutPoints: { startKeep: number; endKeep: number };  // milliseconds
    duration: number;
    text?: string;
    redStart?: number;
    redEnd?: number;
    // Persistent lock state
    isStartLocked?: boolean;
    isEndLocked?: boolean;
    step9Note?: string | null;  // Note from Step 9
    editingDebugInfo?: any;  // Debug info from Whisper processing
    trimmedVideoUrl?: string | null;  // Trimmed video URL (if already trimmed)
    generationCount?: number;  // Number of successful generations for this video
  };
  previousVideo?: {
    videoName: string;
    videoUrl: string;
    cutPoints: { startKeep: number; endKeep: number };
  } | null;
  nextVideo?: {
    videoName: string;
    videoUrl: string;
    cutPoints: { startKeep: number; endKeep: number };
  } | null;
  onTrimChange?: (videoId: string, cutPoints: { startKeep: number; endKeep: number }, isStartLocked: boolean, isEndLocked: boolean) => void;
  onCutAndMerge?: (previousVideo: any | null, currentVideo: any, nextVideo: any | null) => Promise<void>;
  onTestOverlay?: (video: any, overlaySettings: any) => Promise<void>;  // Callback to test overlay with FFmpeg
  onReprocess?: (videoName: string) => void;  // Callback to re-process single video
  onMarkerModified?: (videoName: string) => void;  // Callback when markers are modified on a trimmed video
  // Overlay Settings for HOOK videos
  overlaySettings?: {
    enabled: boolean;
    text: string;
    x: number;
    y: number;
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    textColor: string;
    backgroundColor: string;
    opacity: number;
    padding: number;
    cornerRadius: number;
    lineSpacing: number;
    isLocked?: boolean;
  };
  onOverlaySettingsChange?: (videoName: string, settings: any) => void;
  previousVideoOverlaySettings?: {
    enabled: boolean;
    text: string;
    x: number;
    y: number;
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    textColor: string;
    backgroundColor: string;
    opacity: number;
    padding: number;
    cornerRadius: number;
    lineSpacing: number;
    isLocked?: boolean;
  };
}

export const VideoEditorV2 = React.memo(function VideoEditorV2({ video, previousVideo, nextVideo, onTrimChange, onCutAndMerge, onTestOverlay, onReprocess, onMarkerModified, overlaySettings, onOverlaySettingsChange, previousVideoOverlaySettings }: VideoEditorV2Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const zoomviewRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  
  const [peaksInstance, setPeaksInstance] = useState<PeaksInstance | null>(null);
  const [trimSegment, setTrimSegment] = useState<Segment | null>(null);
  // Preview state - user can drag markers freely, saved to DB only on LOCK
  // In MILLISECONDS
  const [previewStart, setPreviewStart] = useState(video.cutPoints?.startKeep || 0);
  const [previewEnd, setPreviewEnd] = useState(video.cutPoints?.endKeep || video.duration * 1000);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [refsReady, setRefsReady] = useState(false);
  
  // Calculate REAL audio duration from waveform data (not video.duration)
  const [audioDuration, setAudioDuration] = useState(video.duration);
  const [windowSize, setWindowSize] = useState(Math.min(8, audioDuration));
  
  // Lock system - restore from persisted state
  const [isStartLocked, setIsStartLocked] = useState(video.isStartLocked ?? false);
  const [isEndLocked, setIsEndLocked] = useState(video.isEndLocked ?? false);
  
  // View Log dropdown state
  const [isLogVisible, setIsLogVisible] = useState(false);
  
  // Overlay Settings dropdown state (only for HOOK videos)
  const [isOverlaySettingsVisible, setIsOverlaySettingsVisible] = useState(true); // Open by default
  const isHookVideo = video.videoName.toLowerCase().includes('hook');
  
  // Snap guides state
  const [showSnapGuides, setShowSnapGuides] = useState({ horizontal: false, vertical: false });
  const SNAP_THRESHOLD = 3; // 3% threshold for snapping
  
  // Local overlay settings state (initialize from props or defaults)
  // Default overlay settings
  const defaultOverlaySettings = {
    enabled: true, // Always enabled for HOOK videos
    text: '',
    x: 50.0, // Centered horizontally
    y: 75.5, // Lower third position
    fontFamily: "'Inter', system-ui, sans-serif", // Inter font (META)
    fontSize: 20, // Default 20px
    bold: true, // Bold ON by default
    italic: false, // Italic OFF by default
    textColor: '#000000', // Black text
    backgroundColor: '#ffffff', // White background
    opacity: 1.0, // Full opacity
    padding: 5, // 5px padding
    cornerRadius: 5, // 5px corner radius
    lineSpacing: -10, // -10px line spacing (negative = overlap)
    isLocked: false, // Unlocked by default
    videoWidth: undefined, // Will be set from video element
    videoHeight: undefined, // Will be set from video element
    scaleFactor: undefined, // Will be calculated from player vs native dimensions
  };
  
  // Merge props with defaults (props override defaults)
  const [localOverlaySettings, setLocalOverlaySettings] = useState({
    ...defaultOverlaySettings,
    ...overlaySettings,
  });
  
  // Fine-tune controls state
  const [fineTuneStep, setFineTuneStep] = useState(10); // Default 10ms
  
  // Cut & Merge test state
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState('');
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  
  // Playhead (black marker) - only visible when START is locked
  const [playheadTime, setPlayheadTime] = useState<number | null>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  // Helper functions for milliseconds ↔ seconds conversion
  // Only use at library interfaces (Peaks.js, video element, FFmpeg)
  const msToSeconds = (ms: number): number => ms / 1000;
  const secondsToMs = (sec: number): number => Math.round(sec * 1000);

  console.log('[VideoEditorV2] Received video:', video);

  // Update previewStart/previewEnd when video.cutPoints changes (e.g., after reprocesare)
  useEffect(() => {
    if (video.cutPoints) {
      console.log('[VideoEditorV2] useEffect triggered! Updating trim markers from cutPoints:', {
        startKeep: video.cutPoints.startKeep,
        endKeep: video.cutPoints.endKeep,
        videoName: video.videoName
      });
      
      setPreviewStart(video.cutPoints.startKeep);
      setPreviewEnd(video.cutPoints.endKeep);
      
      // Update Peaks.js segment if it exists
      if (trimSegment) {
        console.log('[VideoEditorV2] Updating Peaks.js segment');
        trimSegment.update({
          startTime: msToSeconds(video.cutPoints.startKeep),
          endTime: msToSeconds(video.cutPoints.endKeep)
        });
      }
    }
  }, [video.cutPoints?.startKeep, video.cutPoints?.endKeep, video.audioUrl, video.peaksUrl]);

  // Check if refs are ready after DOM renders
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 50; // Max 5 seconds (50 * 100ms)
    
    const checkRefs = () => {
      if (zoomviewRef.current && audioRef.current) {
        console.log('[VideoEditorV2] All refs are ready!');
        setRefsReady(true);
      } else if (retryCount < maxRetries) {
        retryCount++;
        // Only log every 10 retries to reduce console spam
        if (retryCount % 10 === 0) {
          console.log(`[VideoEditorV2] Waiting for refs (${retryCount}/${maxRetries})...`);
        }
        setTimeout(checkRefs, 100);
      } else {
        console.error('[VideoEditorV2] Refs not ready after max retries!', {
          zoomview: !!zoomviewRef.current,
          audio: !!audioRef.current
        });
      }
    };
    
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => setTimeout(checkRefs, 0));
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
        wheelMode: 'none' as const, // Disable wheel zoom/scroll
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
        startTime: msToSeconds(video.cutPoints?.startKeep || 0),
        endTime: msToSeconds(video.cutPoints?.endKeep || video.duration * 1000),
        editable: false, // We handle dragging with custom overlay
        color: 'transparent',
        labelText: '',
      });

      setTrimSegment(segment);
      console.log('[VideoEditorV2] Trim segment created:', segment);

      // 🔒 Freeze pan/drag on waveform
      // Peaks.js attaches pan to internal div, need to identify it
      setTimeout(() => {
        const zoomviewContainer = zoomviewRef.current;
        if (!zoomviewContainer) {
          console.error('[VideoEditorV2] zoomviewContainer is null');
          return;
        }

        console.log('[VideoEditorV2] DEBUG: zoomviewContainer:', zoomviewContainer);
        console.log('[VideoEditorV2] DEBUG: All children:', zoomviewContainer.children);
        
        // Try multiple selectors
        const selectors = [
          '.peaks-zoomview',
          '.peaks-workspace',
          '[data-peaks-zoomview]',
          'div > div',  // First nested div
        ];
        
        let draggableWrapper: Element | null = null;
        let usedSelector = '';
        
        for (const selector of selectors) {
          draggableWrapper = zoomviewContainer.querySelector(selector);
          if (draggableWrapper) {
            usedSelector = selector;
            console.log(`[VideoEditorV2] Found draggable wrapper with selector: ${selector}`);
            break;
          }
        }
        
        // If still not found, try first child div
        if (!draggableWrapper) {
          const firstDiv = zoomviewContainer.querySelector('div');
          if (firstDiv) {
            draggableWrapper = firstDiv;
            usedSelector = 'first div child';
            console.log('[VideoEditorV2] Using first div child as draggable wrapper');
          }
        }

        if (draggableWrapper) {
          const wrapper = draggableWrapper as HTMLElement;
          
          console.log('[VideoEditorV2] Freezing element:', {
            selector: usedSelector,
            element: wrapper,
            tagName: wrapper.tagName,
            className: wrapper.className,
            id: wrapper.id,
          });
          
          wrapper.style.pointerEvents = 'none';
          wrapper.style.touchAction = 'none';
          wrapper.style.userSelect = 'none';

          wrapper.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[VideoEditorV2] Pan mousedown BLOCKED');
            return false;
          }, { capture: true, passive: false });

          wrapper.addEventListener('mousemove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, { capture: true, passive: false });

          wrapper.addEventListener('mouseup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, { capture: true, passive: false });

          wrapper.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, { capture: true, passive: false });
          
          wrapper.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, { capture: true, passive: false });

          console.log('[VideoEditorV2] ✅ Waveform pan FROZEN successfully');
        } else {
          console.error('[VideoEditorV2] ❌ Could not find draggable wrapper!');
          console.log('[VideoEditorV2] All elements in container:');
          const allElements = zoomviewContainer.querySelectorAll('*');
          allElements.forEach((el, i) => {
            console.log(`  ${i}: ${el.tagName}.${el.className} #${el.id}`);
          });
        }
      }, 200);  // Increased timeout to 200ms

      // Set initial zoom
      const initialWindow = Math.min(8, video.duration);
      const view = peaks!.views.getView('zoomview');
      if (view) {
        view.setZoom({ seconds: initialWindow });
        const centerTime = ((video.cutPoints?.startKeep || 0) + (video.cutPoints?.endKeep || 0)) / 2000;
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
        startTime: msToSeconds(previewStart),
        endTime: msToSeconds(previewEnd),
      });
    }
  }, [previewStart, previewEnd, trimSegment]);

  // When START becomes locked, initialize playhead at previewStart
  useEffect(() => {
    if (isStartLocked && playheadTime === null) {
      // Initialize playhead at START marker position
      setPlayheadTime(previewStart);
      console.log('[VideoEditorV2] START locked, playhead initialized at previewStart', previewStart);
    } else if (!isStartLocked && playheadTime !== null) {
      setPlayheadTime(null);
      console.log('[VideoEditorV2] START unlocked, playhead hidden');
    }
  }, [isStartLocked, playheadTime, previewStart]);

  // Keep playhead between START and END when they change
  useEffect(() => {
    if (isStartLocked && playheadTime !== null) {
      if (playheadTime < previewStart || playheadTime > previewEnd) {
        const clampedTime = Math.max(previewStart, Math.min(playheadTime, previewEnd));
        setPlayheadTime(clampedTime);
      }
    }
  }, [previewStart, previewEnd, isStartLocked, playheadTime]);

  const handleVideoTimeUpdate = () => {
    // Only used for UI updates if needed
    // STOP logic is in requestAnimationFrame loop
  };

  // Smooth LIVE marker update with requestAnimationFrame
  useEffect(() => {
    let animationFrameId: number;
    
    const updateCurrentTime = () => {
      if (videoRef.current && playing) {
        const timeMs = secondsToMs(videoRef.current.currentTime);
        setCurrentTime(timeMs);
        
        // Check if we've reached END marker
        if (timeMs >= previewEnd - 20) { // 20ms tolerance
          // Stop playback
          videoRef.current.pause();
          setPlaying(false);
          
          // Optional: snap to exact previewEnd
          videoRef.current.currentTime = msToSeconds(previewEnd);
          
          console.log('[VideoEditorV2] Stopped at END marker:', previewEnd);
          return; // STOP, no more rAF
        }
        
        // Continue animation loop
        animationFrameId = requestAnimationFrame(updateCurrentTime);
      }
    };
    
    if (playing) {
      animationFrameId = requestAnimationFrame(updateCurrentTime);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playing, previewEnd]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      // Start playback from appropriate position
      if (isStartLocked && playheadTime !== null) {
        // If START is locked, play from playhead position
        videoRef.current.currentTime = msToSeconds(playheadTime);
        console.log('[VideoEditorV2] Playing from playhead:', playheadTime);
      } else {
        // Otherwise play from START marker
        videoRef.current.currentTime = msToSeconds(previewStart);
        console.log('[VideoEditorV2] Playing from START:', previewStart);
      }
      videoRef.current.play();
      setPlaying(true);
    }
  };

  const seekToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = msToSeconds(previewStart);
    }
  };

  const seekToEnd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = msToSeconds(previewEnd);
    }
  };

  // Convert time (milliseconds) to pixel position on waveform
  const timeToPixel = (timeMs: number): number => {
    if (!peaksInstance || !waveformContainerRef.current) return 0;
    
    const view = peaksInstance.views.getView('zoomview');
    if (!view) return 0;
    
    const viewStartTime = view.getStartTime();  // seconds
    const viewEndTime = view.getEndTime();      // seconds
    const containerWidth = waveformContainerRef.current.offsetWidth;
    
    const timeSeconds = msToSeconds(timeMs);
    const relativeTime = timeSeconds - viewStartTime;
    const viewDuration = viewEndTime - viewStartTime;
    
    return (relativeTime / viewDuration) * containerWidth;
  };

  // Convert pixel position to time (returns milliseconds)
  const pixelToTime = (pixel: number): number => {
    if (!peaksInstance || !waveformContainerRef.current) return 0;
    
    const view = peaksInstance.views.getView('zoomview');
    if (!view) return 0;
    
    const viewStartTime = view.getStartTime();  // seconds
    const viewEndTime = view.getEndTime();      // seconds
    const containerWidth = waveformContainerRef.current.offsetWidth;
    
    const viewDuration = viewEndTime - viewStartTime;
    const relativeTime = (pixel / containerWidth) * viewDuration;
    const timeSeconds = viewStartTime + relativeTime;
    
    return Math.max(0, Math.min(video.duration * 1000, secondsToMs(timeSeconds)));
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
      dragStartTime.current = previewStart;
    } else if (markerType === 'end') {
      dragStartTime.current = previewEnd;
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
        const clampedTime = Math.max(0, Math.min(newTime, previewEnd - 100));  // 100ms min gap
        setPreviewStart(clampedTime);
        // NOTE: NO onTrimChange here! Save happens only on LOCK.
        // Sync video to new START position
        if (videoRef.current) {
          videoRef.current.currentTime = msToSeconds(clampedTime);
        }
      } else if (isDragging === 'end') {
        const clampedTime = Math.max(previewStart + 100, Math.min(newTime, video.duration * 1000));  // 100ms min gap
        setPreviewEnd(clampedTime);
        // NOTE: NO onTrimChange here! Save happens only on LOCK.
        // Sync video to new END position
        if (videoRef.current) {
          videoRef.current.currentTime = msToSeconds(clampedTime);
        }
      } else if (isDragging === 'playhead') {
        const clampedTime = Math.max(0, Math.min(newTime, video.duration * 1000));
        setPlayheadTime(clampedTime);
        // Sync video to playhead position
        if (videoRef.current) {
          videoRef.current.currentTime = msToSeconds(clampedTime);
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
  }, [isDragging, previewStart, previewEnd, playheadTime, video.duration, video.id, onTrimChange, isStartLocked, isEndLocked]);

  // NOTE: We NO LONGER auto-save on lock state changes!
  // Saving happens ONLY when user clicks LOCK button (handleLockStart/handleLockEnd)

  // Note: Cannot manually set canvas width as it clears Konva.js rendering
  // Peaks.js manages waveform rendering internally
  // Use zoom + scroll to navigate the waveform

  const handleZoomIn = () => {
    if (!peaksInstance) return;

    const view = peaksInstance.views.getView('zoomview');
    if (!view) return;

    const duration = video.duration;
    if (!duration) return;

    const MIN_WINDOW = 0.5;
    const currentWindow = windowSize || duration;
    const newWindow = Math.max(MIN_WINDOW, currentWindow / 2);

    // Center on current visible area, not video currentTime
    const currentViewStart = view.getStartTime();
    const currentViewEnd = view.getEndTime();
    const centerTime = (currentViewStart + currentViewEnd) / 2;
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

    // Center on current visible area, not video currentTime
    const currentViewStart = view.getStartTime();
    const currentViewEnd = view.getEndTime();
    const centerTime = (currentViewStart + currentViewEnd) / 2;
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

  // Format milliseconds to seconds with 3 decimals (e.g., 50ms → "0.050", 5810ms → "5.810")
  const formatTime = (milliseconds: number) => {
    if (isNaN(milliseconds) || !isFinite(milliseconds)) {
      return '0.000';
    }
    const seconds = milliseconds / 1000;
    return seconds.toFixed(3);
  };

  return (
    <div className="border-2 border-purple-300 rounded-lg p-3 bg-white">
      {/* Video Player */}
      <div className="mb-3">
        <div className="flex justify-center items-center gap-2 mb-3">
          <h3 className="text-base font-bold text-center px-5 py-2.5 bg-green-100 text-green-900 rounded-lg inline-block">
            {video.videoName}
          </h3>
          {video.generationCount && video.generationCount > 0 && (
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-semibold">
              Regen: {video.generationCount}
            </span>
          )}
        </div>
        <div 
          className="relative bg-black rounded-lg overflow-hidden mx-auto" 
          style={{ aspectRatio: '9/16', width: '100%', maxWidth: '300px' }}
        >
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="absolute top-0 left-0 w-full h-full object-contain"
            playsInline
            crossOrigin="anonymous"
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedMetadata={(e) => {
              const videoElement = e.currentTarget;
              // Calculate scale factor between displayed size and native size
              const scaleFactor = videoElement.videoWidth / videoElement.clientWidth;
              console.log('[VideoEditorV2] 📐 Player dimensions (displayed):', videoElement.clientWidth, 'x', videoElement.clientHeight);
              console.log('[VideoEditorV2] 📐 Video dimensions (native):', videoElement.videoWidth, 'x', videoElement.videoHeight);
              console.log('[VideoEditorV2] 📐 Scale factor:', scaleFactor);
              // Update overlay settings with actual video dimensions and scale factor
              setLocalOverlaySettings(prev => ({
                ...prev,
                videoWidth: videoElement.videoWidth,
                videoHeight: videoElement.videoHeight,
                scaleFactor: scaleFactor,  // Store for FFmpeg fontSize calculation
              }));
            }}
          />
          
          {/* Snap Guide Lines - Horizontal (center Y) */}
          {isHookVideo && showSnapGuides.horizontal && (
            <div
              className="absolute w-full border-t-2 border-purple-500 pointer-events-none"
              style={{ top: '50%', left: 0, right: 0, zIndex: 10 }}
            />
          )}
          
          {/* Snap Guide Lines - Vertical (center X) */}
          {isHookVideo && showSnapGuides.vertical && (
            <div
              className="absolute h-full border-l-2 border-purple-500 pointer-events-none"
              style={{ left: '50%', top: 0, bottom: 0, zIndex: 10 }}
            />
          )}
          
          {/* Draggable Overlay Preview - Only for HOOK videos with enabled overlay */}
          {OVERLAY_ENABLED && isHookVideo && localOverlaySettings.enabled && (
            <div
              className="absolute cursor-move select-none"
              style={{
                left: `${localOverlaySettings.x}%`,
                top: `${localOverlaySettings.y}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'all',
                zIndex: 20
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                const container = e.currentTarget.parentElement;
                if (!container) return;
                
                const rect = container.getBoundingClientRect();
                const startX = e.clientX;
                const startY = e.clientY;
                const startPosX = localOverlaySettings.x;
                const startPosY = localOverlaySettings.y;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  
                  let newX = Math.max(0, Math.min(100, startPosX + (deltaX / rect.width) * 100));
                  let newY = Math.max(0, Math.min(100, startPosY + (deltaY / rect.height) * 100));
                  
                  // Snap to center (50%) if within threshold
                  const snapHorizontal = Math.abs(newY - 50) < SNAP_THRESHOLD;
                  const snapVertical = Math.abs(newX - 50) < SNAP_THRESHOLD;
                  
                  if (snapHorizontal) newY = 50;
                  if (snapVertical) newX = 50;
                  
                  setShowSnapGuides({ horizontal: snapHorizontal, vertical: snapVertical });
                  setLocalOverlaySettings(prev => ({ ...prev, x: newX, y: newY }));
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                  setShowSnapGuides({ horizontal: false, vertical: false });
                  onOverlaySettingsChange?.(video.videoName, localOverlaySettings);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {(localOverlaySettings.text || 'Lorem ipsum generator\nLorem ipsum').split('\n').map((line, idx, arr) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      fontFamily: localOverlaySettings.fontFamily,
                      fontSize: `${localOverlaySettings.fontSize}px`,
                      fontWeight: localOverlaySettings.bold ? 700 : 400,
                      fontStyle: localOverlaySettings.italic ? 'italic' : 'normal',
                      color: localOverlaySettings.textColor,
                      backgroundColor: localOverlaySettings.backgroundColor,
                      padding: `${localOverlaySettings.padding}px ${localOverlaySettings.padding * 1.5}px`,
                      borderRadius: `${localOverlaySettings.cornerRadius}px`,
                      marginBottom: idx < arr.length - 1 ? `${localOverlaySettings.lineSpacing}px` : '0',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      zIndex: arr.length - idx
                    }}
                  >
                    {line || ' '}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <audio 
          id="peaks-audio-element"
          ref={audioRef} 
          src={video.audioUrl} 
          crossOrigin="anonymous"
          style={{ display: 'none' }}
        />

        {/* Play/Pause Controls */}
        <div className="flex flex-col sm:flex-row justify-center mt-2 gap-2">
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
      </div>

      {/* Video Text (from database) - Above Waveform */}
      {video.text && (
        <div className="mb-2 mx-auto" style={{ maxWidth: '300px' }}>
          <p className="text-xs text-gray-800 text-center">
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


      {/* View Log Link - Above Waveform */}
      {video.editingDebugInfo && (
        <div className="mb-2 text-center">
          <button
            onClick={() => setIsLogVisible(!isLogVisible)}
            className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
          >
            {isLogVisible ? 'Hide Log' : 'View Log'}
          </button>
        </div>
      )}

      {/* Overlay Settings Link - Only for HOOK videos */}
      {OVERLAY_ENABLED && isHookVideo && (
        <div className="mb-2 text-center flex items-center justify-center gap-4">
          <button
            onClick={() => setIsOverlaySettingsVisible(!isOverlaySettingsVisible)}
            className="text-purple-600 hover:text-purple-800 underline text-sm font-medium"
          >
            {isOverlaySettingsVisible ? '- Overlay Settings' : '+ Overlay Settings'}
          </button>
          
          {/* Lock/Unlock Overlay button */}
          <button
            onClick={() => {
              const newSettings = { ...localOverlaySettings, isLocked: !localOverlaySettings.isLocked };
              setLocalOverlaySettings(newSettings);
              // Save to DB on both lock and unlock
              onOverlaySettingsChange?.(video.videoName, newSettings);
            }}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              localOverlaySettings.isLocked
                ? 'bg-gray-400 text-white hover:bg-gray-500'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {localOverlaySettings.isLocked ? '🔓 Unlock Overlay' : '🔒 Lock Overlay'}
          </button>
        </div>
      )}

      {/* Debug Log Dropdown */}
      {video.editingDebugInfo && isLogVisible && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-300 rounded-lg">
          <div className={`px-3 py-1 border rounded text-xs font-semibold inline-flex items-center gap-1 mb-3 ${
            video.editingDebugInfo.status === 'success' ? 'bg-green-100 border-green-400 text-green-700' :
            video.editingDebugInfo.status === 'warning' ? 'bg-yellow-100 border-yellow-400 text-yellow-700' :
            'bg-red-100 border-red-400 text-red-700'
          }`}>
            <span>{video.editingDebugInfo.message}</span>
          </div>
          {video.editingDebugInfo.whisperTranscript && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-300 rounded text-xs mb-3">
              <div className="font-semibold text-blue-700 mb-1">
                📝 Whisper Transcript ({video.editingDebugInfo.whisperWordCount || 0} words):
              </div>
              <div className="text-blue-900 italic">
                "{video.editingDebugInfo.whisperTranscript}"
              </div>
            </div>
          )}
          {video.editingDebugInfo.algorithmLogs && video.editingDebugInfo.algorithmLogs.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-xs">
              <div className="font-semibold text-gray-700 mb-2">
                🔍 Algorithm Execution Log:
              </div>
              <div className="space-y-1 font-mono text-[10px] text-gray-800">
                {video.editingDebugInfo.algorithmLogs.map((log, idx) => (
                  <div key={idx} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overlay Settings Dropdown - Only for HOOK videos */}
      {OVERLAY_ENABLED && isHookVideo && isOverlaySettingsVisible && (
        <div className="mb-3 p-3 bg-purple-50 border border-purple-300 rounded text-xs mx-auto w-full md:w-[60%] lg:w-[40%]">
          <div className="space-y-2">
            {/* Text Input */}
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                Text:
              </label>
              <textarea
                value={localOverlaySettings.text}
                onChange={(e) => {
                  const newSettings = { ...localOverlaySettings, text: e.target.value };
                  setLocalOverlaySettings(newSettings);
                }}
                placeholder="Lorem ipsum generator&#10;Lorem ipsum"
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                rows={3}
                disabled={localOverlaySettings.isLocked}
              />
            </div>

            {/* Font Settings */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Font:
                </label>
                <select
                  value={localOverlaySettings.fontFamily}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, fontFamily: e.target.value };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                >
                  <option value="'Inter', system-ui, sans-serif">Inter</option>
                  <option value="'Roboto', system-ui, sans-serif">Roboto</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="'Times New Roman', serif">Times</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Size: {localOverlaySettings.fontSize}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  value={localOverlaySettings.fontSize}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, fontSize: parseInt(e.target.value) };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-full h-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
              </div>
            </div>

            {/* Bold & Italic */}
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-[10px]">
                <input
                  type="checkbox"
                  checked={localOverlaySettings.bold}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, bold: e.target.checked };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-3 h-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
                Bold
              </label>
              <label className="flex items-center gap-1 text-[10px] italic">
                <input
                  type="checkbox"
                  checked={localOverlaySettings.italic}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, italic: e.target.checked };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-3 h-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
                Italic
              </label>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Text:
                </label>
                <input
                  type="color"
                  value={localOverlaySettings.textColor}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, textColor: e.target.value };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-full h-6 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  BG:
                </label>
                <input
                  type="color"
                  value={localOverlaySettings.backgroundColor}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, backgroundColor: e.target.value };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-full h-6 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                Opacity: {(localOverlaySettings.opacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localOverlaySettings.opacity}
                onChange={(e) => {
                  const newSettings = { ...localOverlaySettings, opacity: parseFloat(e.target.value) };
                  setLocalOverlaySettings(newSettings);
                }}
                className="w-full h-1 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={localOverlaySettings.isLocked}
                  />
                </div>

            {/* Layout Settings */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Padding: {localOverlaySettings.padding}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={localOverlaySettings.padding}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, padding: parseInt(e.target.value) };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-full h-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Radius: {localOverlaySettings.cornerRadius}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={localOverlaySettings.cornerRadius}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, cornerRadius: parseInt(e.target.value) };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-full h-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Spacing: {localOverlaySettings.lineSpacing}px
                </label>
                <input
                  type="range"
                  min="-80"
                  max="80"
                  value={localOverlaySettings.lineSpacing}
                  onChange={(e) => {
                    const newSettings = { ...localOverlaySettings, lineSpacing: parseInt(e.target.value) };
                    setLocalOverlaySettings(newSettings);
                  }}
                  className="w-full h-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={localOverlaySettings.isLocked}
                />
              </div>
            </div>
            
            {/* Copy Settings from Above */}
            {previousVideo && previousVideoOverlaySettings && (
              <div className="mt-2">
                <label className="flex items-center gap-1 text-[10px] text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={localOverlaySettings.isLocked}
                    onChange={(e) => {
                      if (e.target.checked && previousVideoOverlaySettings) {
                        // Copy all settings EXCEPT text
                        const newSettings = {
                          ...localOverlaySettings,
                          x: previousVideoOverlaySettings.x,
                          y: previousVideoOverlaySettings.y,
                          fontFamily: previousVideoOverlaySettings.fontFamily,
                          fontSize: previousVideoOverlaySettings.fontSize,
                          bold: previousVideoOverlaySettings.bold,
                          italic: previousVideoOverlaySettings.italic,
                          textColor: previousVideoOverlaySettings.textColor,
                          backgroundColor: previousVideoOverlaySettings.backgroundColor,
                          opacity: previousVideoOverlaySettings.opacity,
                          padding: previousVideoOverlaySettings.padding,
                          cornerRadius: previousVideoOverlaySettings.cornerRadius,
                          lineSpacing: previousVideoOverlaySettings.lineSpacing
                        };
                        setLocalOverlaySettings(newSettings);
                        onOverlaySettingsChange?.(video.videoName, newSettings);
                      }
                    }}
                    className="w-3 h-3"
                  />
                  <span>Copy settings from above</span>
                </label>
              </div>
            )}
            
            {/* Position Display */}
            <div className="text-[10px] text-gray-600">
              Pos: X={localOverlaySettings.x.toFixed(1)}%, Y={localOverlaySettings.y.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Waveform Timeline */}
      <div className="mb-2">
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mb-1">
          
          {/* NO CUT NEEDED Badge - Left of Lock START */}
          {video.noCutNeeded && (
            <div className="px-3 py-1 bg-orange-100 border border-orange-400 rounded text-xs font-semibold text-orange-700 flex items-center gap-1">
              <span>⚠️</span>
              <span>NO CUT NEEDED</span>
            </div>
          )}
          
          {/* WARNING Badge - For unprocessed videos */}
          {onReprocess && (!video.audioWav || !video.markers || !video.cleanVoiceUrl) && (
            <div className="px-3 py-1 bg-red-100 border-2 border-red-500 rounded text-xs font-bold text-red-700 flex items-center gap-1 animate-pulse">
              <span>⚠️</span>
              <span>WARNING: Please reprocess this video first</span>
            </div>
          )}
          
          {/* Reprocesare Button - Far left */}
          {onReprocess && (
            <Button
              onClick={() => onReprocess(video.videoName)}
              size="sm"
              variant="outline"
              className="h-6 md:h-7 text-[10px] md:text-xs px-2 border-blue-500 text-blue-700 hover:bg-blue-50"
            >
              🔄 Reprocesare
            </Button>
          )}
          
          {/* Lock START Button - Left of center */}
          <Button
            onClick={async () => {
              // Check if video is already trimmed and user is trying to lock (modify markers)
              if (video.trimmedVideoUrl && !isStartLocked) {
                const confirmed = window.confirm(
                  'Are you sure you want to modify the markers? If you modify them, this video will need to be re-trimmed using the red button below to appear correctly in Step 10.'
                );
                
                if (!confirmed) {
                  return; // User cancelled
                }
                
                // User confirmed - mark video for recut
                if (onMarkerModified) {
                  onMarkerModified(video.videoName);
                }
              }
              
              const newLockState = !isStartLocked;
              setIsStartLocked(newLockState);
              // Trigger immediate save
              if (onTrimChange) {
                onTrimChange(video.id, {
                  startKeep: Math.round(previewStart),
                  endKeep: Math.round(previewEnd)
                }, newLockState, isEndLocked);
              }
            }}
            size="sm"
            variant={isStartLocked ? "default" : "outline"}
            className="h-7 text-xs px-2"
            style={{
              backgroundColor: isStartLocked ? '#22c55e' : undefined,
              borderColor: isStartLocked ? '#22c55e' : undefined,
              color: isStartLocked ? 'white' : undefined,
            }}
          >
            {isStartLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
            {isStartLocked ? 'START Locked' : 'Lock START'}
          </Button>
          
          {/* Center Group: Zoom + Current Time */}
          <div className="flex flex-col items-center gap-1">
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
            <span className="text-xs text-gray-600 whitespace-nowrap">
              Current: <span className="font-mono font-bold text-purple-600">{formatTime(currentTime)}</span>
              {' / '}
              <span className="font-mono">{formatTime(video.duration * 1000)}</span>
            </span>
          </div>
          
          {/* Lock END Button - Right of center */}
          <Button
            onClick={async () => {
              // Check if video is already trimmed and user is trying to lock (modify markers)
              if (video.trimmedVideoUrl && !isEndLocked) {
                const confirmed = window.confirm(
                  'Are you sure you want to modify the markers? If you modify them, this video will need to be re-trimmed using the red button below to appear correctly in Step 10.'
                );
                
                if (!confirmed) {
                  return; // User cancelled
                }
                
                // User confirmed - mark video for recut
                if (onMarkerModified) {
                  onMarkerModified(video.videoName);
                }
              }
              
              const newLockState = !isEndLocked;
              setIsEndLocked(newLockState);
              // Trigger immediate save
              if (onTrimChange) {
                onTrimChange(video.id, {
                  startKeep: Math.round(previewStart),
                  endKeep: Math.round(previewEnd)
                }, isStartLocked, newLockState);
              }
            }}
            size="sm"
            variant={isEndLocked ? "default" : "outline"}
            className="h-7 text-xs px-2"
            style={{
              backgroundColor: isEndLocked ? '#ef4444' : undefined,
              borderColor: isEndLocked ? '#ef4444' : undefined,
              color: isEndLocked ? 'white' : undefined,
            }}
          >
            {isEndLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
            {isEndLocked ? 'END Locked' : 'Lock END'}
          </Button>
          
          {/* Step 9 Note - Right of LOCK END */}
          {video.step9Note && (
            <div className="ml-3 px-3 py-1 bg-yellow-100 border border-yellow-400 rounded text-xs text-yellow-900 max-w-xs truncate" title={video.step9Note}>
              📝 {video.step9Note}
            </div>
          )}
          
          {/* Cut & Merge (test) Button - Right of Notes */}
          {onCutAndMerge && (previousVideo || nextVideo) && (
            <Button
              onClick={async () => {
                setIsMerging(true);
                setMergeProgress('Starting merge...');
                try {
                  await onCutAndMerge(previousVideo, video, nextVideo);
                } catch (error) {
                  console.error('[Cut & Merge] Error:', error);
                } finally {
                  setIsMerging(false);
                  setMergeProgress('');
                }
              }}
              disabled={isMerging}
              size="sm"
              variant="outline"
              className="ml-2 md:ml-3 h-6 md:h-7 text-[10px] md:text-xs px-2 md:px-3 border-blue-500 text-blue-700 hover:bg-blue-50"
            >
              {isMerging ? 'Merging...' : 'Cut & Merge (test)'}
            </Button>
          )}
          
          {/* Test Overlay Button - Only for HOOK videos with enabled overlay */}
          {OVERLAY_ENABLED && isHookVideo && localOverlaySettings.enabled && onTestOverlay && (
            <Button
              onClick={async () => {
                setIsMerging(true);
                setMergeProgress('Testing overlay...');
                try {
                  await onTestOverlay(video, localOverlaySettings);
                } catch (error) {
                  console.error('[Test Overlay] Error:', error);
                } finally {
                  setIsMerging(false);
                  setMergeProgress('');
                }
              }}
              disabled={isMerging}
              size="sm"
              variant="outline"
              className="ml-2 md:ml-3 h-6 md:h-7 text-[10px] md:text-xs px-2 md:px-3 border-purple-500 text-purple-700 hover:bg-purple-50"
            >
              {isMerging ? 'Testing...' : '🎨 Test Overlay'}
            </Button>
          )}
        </div>

        {/* Waveform Container with Custom Markers Overlay */}
        <div 
          ref={waveformContainerRef}
          className="waveform-scroll-container"
          style={{ 
            height: '120px', 
            width: '100%', 
            overflowX: 'hidden', // Prevent page horizontal scroll
            overflowY: 'hidden',
            position: 'relative',
          }}
        >
          {/* Custom thin scrollbar CSS */}
          <style>{`
            /* Firefox scrollbar */
            .waveform-scroll-container {
              scrollbar-width: thin;
              scrollbar-color: #9ca3af #e5e7eb;
            }
            
            /* Chrome/Safari/Edge scrollbar */
            .waveform-scroll-container::-webkit-scrollbar {
              height: 4px;
            }
            .waveform-scroll-container::-webkit-scrollbar-track {
              background: #e5e7eb;
              border-radius: 2px;
            }
            .waveform-scroll-container::-webkit-scrollbar-thumb {
              background: #9ca3af;
              border-radius: 2px;
            }
            .waveform-scroll-container::-webkit-scrollbar-thumb:hover {
              background: #6b7280;
            }
          `}</style>
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
                  left: `${timeToPixel(previewStart)}px`,
                  top: 0,
                  transform: 'translateX(0px)',
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
                {/* Draggable handle - centered on line (12px width, so -5px to center) */}
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

              {/* END Marker (Red) - Line + Handle */}
              <div
                style={{
                  position: 'absolute',
                  left: `${timeToPixel(previewEnd)}px`,
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
                {/* Draggable handle - adjust left when at end to keep visible */}
                <div
                  onMouseDown={(e) => handleMarkerMouseDown(e, 'end')}
                  style={{
                    position: 'absolute',
                    left: previewEnd >= audioDuration * 1000 - 10 ? '-12px' : '-5px',
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
              {currentTime > 0 && (
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
              )}
            </>
          )}
        </div>
      </div>

      {/* Marker Info */}
      <div className="mb-2 mt-1">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-600 mb-1">
              🟢 START
            </div>
            <div className="text-sm font-mono font-bold" style={{ color: isStartLocked ? '#9ca3af' : '#22c55e' }}>
              {formatTime(previewStart)}
            </div>
            {/* Fine-tune controls for START */}
            <div className="flex items-center justify-center gap-1 mt-2">
              <button
                onClick={() => {
                  const newStart = Math.max(0, previewStart - fineTuneStep);
                  setPreviewStart(newStart);
                  // NOTE: NO onTrimChange here! Save happens only on LOCK.
                }}
                disabled={isStartLocked}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded"
                title="Move START left"
              >
                ←
              </button>
              <input
                type="number"
                value={fineTuneStep}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setFineTuneStep(Math.max(1, Math.min(99, val))); // Max 2 digits
                }}
                className="w-10 px-1 py-1 text-xs text-center border border-gray-300 rounded"
                min="1"
                max="99"
              />
              <span className="text-xs text-gray-600">ms</span>
              <button
                onClick={() => {
                  const newStart = Math.min(previewEnd - 100, previewStart + fineTuneStep);
                  setPreviewStart(newStart);
                  // NOTE: NO onTrimChange here! Save happens only on LOCK.
                }}
                disabled={isStartLocked}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded"
                title="Move START right"
              >
                →
              </button>
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
              🔴 END
            </div>
            <div className="text-sm font-mono font-bold" style={{ color: isEndLocked ? '#9ca3af' : '#ef4444' }}>
              {formatTime(previewEnd)}
            </div>
            {/* Fine-tune controls for END */}
            <div className="flex items-center justify-center gap-1 mt-2">
              <button
                onClick={() => {
                  const newEnd = Math.max(previewStart + 100, previewEnd - fineTuneStep);
                  setPreviewEnd(newEnd);
                  // NOTE: NO onTrimChange here! Save happens only on LOCK.
                }}
                disabled={isEndLocked}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded"
                title="Move END left"
              >
                ←
              </button>
              <input
                type="number"
                value={fineTuneStep}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setFineTuneStep(Math.max(1, Math.min(99, val))); // Max 2 digits
                }}
                className="w-10 px-1 py-1 text-xs text-center border border-gray-300 rounded"
                min="1"
                max="99"
              />
              <span className="text-xs text-gray-600">ms</span>
              <button
                onClick={() => {
                  const maxEnd = audioDuration * 1000;
                  const newEnd = Math.min(maxEnd, previewEnd + fineTuneStep);
                  setPreviewEnd(newEnd);
                  // NOTE: NO onTrimChange here! Save happens only on LOCK.
                }}
                disabled={isEndLocked}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded"
                title="Move END right"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WaveSurfer.js Full Implementation - COMMENTED OUT */}
      {/* {video.audioUrl && (
        <WaveSurferEditor
          audioUrl={video.audioUrl}
          videoRef={videoRef}
          initialStart={previewStart}
          initialEnd={previewEnd}
          duration={video.duration}
          onTrimChange={(start, end) => {
            setPreviewStart(start);
            setPreviewEnd(end);
            // NOTE: NO onTrimChange here! Save happens only on LOCK.
          }}
          isStartLocked={isStartLocked}
          isEndLocked={isEndLocked}
          onStartLockToggle={() => {
            const newLockState = !isStartLocked;
            setIsStartLocked(newLockState);
            if (onTrimChange) {
              onTrimChange(video.id, {
                startKeep: Math.round(previewStart),
                endKeep: Math.round(previewEnd)
              }, newLockState, isEndLocked);
            }
          }}
          onEndLockToggle={() => {
            const newLockState = !isEndLocked;
            setIsEndLocked(newLockState);
            if (onTrimChange) {
              onTrimChange(video.id, {
                startKeep: Math.round(previewStart),
                endKeep: Math.round(previewEnd)
              }, isStartLocked, newLockState);
            }
          }}
        />
      )} */}

      {/* Error State */}
      {previewStart >= previewEnd && (
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
