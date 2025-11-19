import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Button } from './ui/button';
import { Play, Pause } from 'lucide-react';

interface VideoEditorProps {
  video: {
    id: string;
    videoName: string;
    videoUrl: string;
    text: string;
    startKeep?: number;  // milliseconds from Whisper API
    endKeep?: number;    // milliseconds from Whisper API
  };
  onTimestampChange?: (videoId: string, startKeep: number, endKeep: number) => void;
}

export function VideoEditor({ video, onTimestampChange }: VideoEditorProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Timestamps in milliseconds - initialized from Whisper API cutPoints
  const [startKeep, setStartKeep] = useState(video.startKeep || 0);
  const [endKeep, setEndKeep] = useState(video.endKeep || 0);

  // Update parent component when timestamps change
  useEffect(() => {
    if (onTimestampChange) {
      onTimestampChange(video.id, startKeep, endKeep);
    }
  }, [startKeep, endKeep]);

  const handleDuration = (duration: number) => {
    const durationMs = duration * 1000;
    setDuration(durationMs);
    
    // If no endKeep set, use full duration
    if (endKeep === 0) {
      setEndKeep(durationMs);
    }
  };

  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds * 1000);
  };

  const handleSeekToStart = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(startKeep / 1000);
      setPlaying(true);
    }
  };

  const handleSeekToEnd = () => {
    if (playerRef.current) {
      // Seek to 1 second before end to see the end point
      playerRef.current.seekTo(Math.max(0, (endKeep / 1000) - 1));
      setPlaying(true);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border-2 border-purple-300 rounded-lg p-6 bg-white">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-purple-900">{video.videoName}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {video.text}
        </p>
      </div>

      {/* Video Player */}
      <div className="mb-6">
        <div 
          className="relative bg-black rounded-lg overflow-hidden mx-auto" 
          style={{ aspectRatio: '9/16', width: '300px' }}
        >
          <ReactPlayer
            ref={playerRef}
            url={video.videoUrl}
            playing={playing}
            controls={false}
            width="100%"
            height="100%"
            onDuration={handleDuration}
            onProgress={handleProgress}
            progressInterval={100}
          />
        </div>
        
        {/* Play/Pause Controls */}
        <div className="flex justify-center mt-4 gap-2">
          <Button
            onClick={() => setPlaying(!playing)}
            size="sm"
            variant="outline"
          >
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button
            onClick={handleSeekToStart}
            size="sm"
            variant="outline"
          >
            ▶ Seek to START
          </Button>
          <Button
            onClick={handleSeekToEnd}
            size="sm"
            variant="outline"
          >
            ▶ Seek to END
          </Button>
        </div>
      </div>

      {/* Timeline Editor */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          ✂️ Adjust Trim Points
        </h4>
        
        {/* Current Time Display */}
        <div className="mb-4 text-center">
          <span className="text-sm text-gray-600">
            Current: <span className="font-mono font-bold text-purple-600">{formatTime(currentTime)}</span>
            {' / '}
            <span className="font-mono">{formatTime(duration)}</span>
          </span>
        </div>

        {/* START Slider */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-green-700">🟢 START (Keep from)</label>
            <span className="text-sm font-mono font-bold text-green-700">{formatTime(startKeep)}</span>
          </div>
          <Slider
            min={0}
            max={duration}
            value={startKeep}
            onChange={(value) => {
              const newStart = Array.isArray(value) ? value[0] : value;
              setStartKeep(newStart);
              // LIVE SEEK when slider moves
              if (playerRef.current) {
                playerRef.current.seekTo(newStart / 1000);
              }
            }}
            railStyle={{ backgroundColor: '#e5e7eb', height: 8 }}
            trackStyle={{ backgroundColor: '#10b981', height: 8 }}
            handleStyle={{
              borderColor: '#10b981',
              height: 20,
              width: 20,
              marginTop: -6,
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          />
        </div>

        {/* END Slider */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-red-700">🔴 END (Keep until)</label>
            <span className="text-sm font-mono font-bold text-red-700">{formatTime(endKeep)}</span>
          </div>
          <Slider
            min={0}
            max={duration}
            value={endKeep}
            onChange={(value) => {
              const newEnd = Array.isArray(value) ? value[0] : value;
              setEndKeep(newEnd);
              // LIVE SEEK when slider moves
              if (playerRef.current) {
                playerRef.current.seekTo(newEnd / 1000);
              }
            }}
            railStyle={{ backgroundColor: '#e5e7eb', height: 8 }}
            trackStyle={{ backgroundColor: '#ef4444', height: 8 }}
            handleStyle={{
              borderColor: '#ef4444',
              height: 20,
              width: 20,
              marginTop: -6,
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          />
        </div>

        {/* Trimmed Duration Info */}
        <div className="p-3 bg-purple-50 border-2 border-purple-300 rounded text-sm">
          <p className="text-purple-900 font-semibold">
            ✂️ Trimmed Duration: {' '}
            <span className="font-mono font-bold text-purple-600">
              {formatTime(Math.max(0, endKeep - startKeep))}
            </span>
          </p>
          <p className="text-purple-700 text-xs mt-1">
            Video will be cut from {formatTime(startKeep)} to {formatTime(endKeep)}
          </p>
        </div>
      </div>

      {/* Error State */}
      {startKeep >= endKeep && (
        <div className="p-3 bg-red-50 border-2 border-red-300 rounded text-center">
          <p className="text-sm text-red-700 font-semibold">
            ⚠️ START must be before END
          </p>
        </div>
      )}
    </div>
  );
}
