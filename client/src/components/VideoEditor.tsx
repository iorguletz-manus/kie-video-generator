import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Button } from './ui/button';
import { Loader2, Save, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';

interface VideoEditorProps {
  video: {
    id: string;
    videoName: string;
    videoUrl: string;
    text: string;
    redStart?: number;
    redEnd?: number;
    fullText?: string;
    redText?: string;
    startKeep?: number;  // milliseconds
    endKeep?: number;    // milliseconds
    editStatus?: 'pending' | 'processing' | 'edited';
  };
  onSave: (videoId: string, startKeep: number, endKeep: number) => Promise<void>;
  onProcess: (videoId: string) => Promise<{ startKeep: number; endKeep: number }>;
}

export function VideoEditor({ video, onSave, onProcess }: VideoEditorProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Timestamps in milliseconds
  const [startKeep, setStartKeep] = useState(video.startKeep || 0);
  const [endKeep, setEndKeep] = useState(video.endKeep || 0);
  
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(!!video.startKeep && !!video.endKeep);

  // Auto-process with Whisper when component mounts
  useEffect(() => {
    if (!hasProcessed && video.editStatus !== 'processing') {
      handleAutoProcess();
    }
  }, []);

  const handleAutoProcess = async () => {
    try {
      setProcessing(true);
      toast.info(`Procesare ${video.videoName} cu Whisper...`);
      
      const result = await onProcess(video.id);
      
      setStartKeep(result.startKeep);
      setEndKeep(result.endKeep);
      setHasProcessed(true);
      
      toast.success(`${video.videoName} procesat! Ajustează timestamps dacă e necesar.`);
    } catch (error: any) {
      console.error('[VideoEditor] Auto-process error:', error);
      toast.error(`Eroare procesare: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(video.id, startKeep, endKeep);
      toast.success(`${video.videoName} salvat!`);
    } catch (error: any) {
      console.error('[VideoEditor] Save error:', error);
      toast.error(`Eroare salvare: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDuration = (duration: number) => {
    setDuration(duration * 1000); // Convert to milliseconds
    if (!hasProcessed && endKeep === 0) {
      setEndKeep(duration * 1000);
    }
  };

  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds * 1000); // Convert to milliseconds
  };

  const handleSeekToStart = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(startKeep / 1000); // Convert to seconds
      setPlaying(true);
    }
  };

  const handleSeekToEnd = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(Math.max(0, endKeep / 1000 - 1)); // 1s before end
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
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16', maxWidth: '400px', margin: '0 auto' }}>
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
        
        {/* Play/Pause Button */}
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
            Seek to START
          </Button>
          <Button
            onClick={handleSeekToEnd}
            size="sm"
            variant="outline"
          >
            Seek to END
          </Button>
        </div>
      </div>

      {/* Processing Status */}
      {processing && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-300 rounded flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <div>
            <p className="text-blue-900 font-medium">Procesare cu Whisper API...</p>
            <p className="text-sm text-blue-700">Detectare automată text roșu și calculare timestamps</p>
          </div>
        </div>
      )}

      {/* Timeline Editor */}
      {!processing && hasProcessed && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Timeline Editor</h4>
          
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
              <label className="text-sm font-medium text-green-700">START (Keep from)</label>
              <span className="text-sm font-mono font-bold text-green-700">{formatTime(startKeep)}</span>
            </div>
            <Slider
              min={0}
              max={duration}
              value={startKeep}
              onChange={(value) => {
                const newStart = Array.isArray(value) ? value[0] : value;
                setStartKeep(newStart);
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
              <label className="text-sm font-medium text-red-700">END (Keep until)</label>
              <span className="text-sm font-mono font-bold text-red-700">{formatTime(endKeep)}</span>
            </div>
            <Slider
              min={0}
              max={duration}
              value={endKeep}
              onChange={(value) => {
                const newEnd = Array.isArray(value) ? value[0] : value;
                setEndKeep(newEnd);
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

          {/* Duration Info */}
          <div className="p-3 bg-gray-50 border border-gray-300 rounded text-sm">
            <p className="text-gray-700">
              <span className="font-semibold">Trimmed Duration:</span>{' '}
              <span className="font-mono font-bold text-purple-600">
                {formatTime(Math.max(0, endKeep - startKeep))}
              </span>
            </p>
            <p className="text-gray-600 text-xs mt-1">
              Video va fi tăiat de la {formatTime(startKeep)} până la {formatTime(endKeep)}
            </p>
          </div>
        </div>
      )}

      {/* Save Button */}
      {hasProcessed && (
        <Button
          onClick={handleSave}
          disabled={saving || startKeep >= endKeep}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvare...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvează Timestamps
            </>
          )}
        </Button>
      )}

      {/* Error State */}
      {hasProcessed && startKeep >= endKeep && (
        <p className="text-sm text-red-600 mt-2 text-center">
          ⚠️ START trebuie să fie înainte de END
        </p>
      )}
    </div>
  );
}
