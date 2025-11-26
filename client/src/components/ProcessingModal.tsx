import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { Loader2 } from 'lucide-react';

interface ProcessingModalProps {
  open: boolean;
  ffmpegProgress: { current: number; total: number; status: 'idle' | 'processing' | 'complete'; activeVideos: string[] };
  whisperProgress: { current: number; total: number; status: 'idle' | 'processing' | 'complete'; activeVideos: string[] };
  cleanvoiceProgress: { current: number; total: number; status: 'idle' | 'processing' | 'complete'; activeVideos: string[] };
  currentVideoName: string;
  processingStep: 'download' | 'extract' | 'whisper' | 'cleanvoice' | 'detect' | 'save' | null;
}

export function ProcessingModal({
  open,
  ffmpegProgress,
  whisperProgress,
  cleanvoiceProgress,
  currentVideoName,
  processingStep
}: ProcessingModalProps) {
  const ffmpegPercent = ffmpegProgress.total > 0 ? (ffmpegProgress.current / ffmpegProgress.total) * 100 : 0;
  const whisperPercent = whisperProgress.total > 0 ? (whisperProgress.current / whisperProgress.total) * 100 : 0;
  const cleanvoicePercent = cleanvoiceProgress.total > 0 ? (cleanvoiceProgress.current / cleanvoiceProgress.total) * 100 : 0;
  const totalCompleted = Math.min(ffmpegProgress.current, whisperProgress.current, cleanvoiceProgress.current);
  const totalVideos = ffmpegProgress.total;
  
  const estimatedMinutes = Math.ceil((totalVideos - totalCompleted) * 15 / 60); // ~15s per video

  const getStepLabel = () => {
    switch (processingStep) {
      case 'extract':
        return '🎵 Step 1: Extracting Audio with FFmpeg API...';
      case 'whisper':
        return '🤖 Step 2: Extracting Timestamps with Whisper API...';
      case 'cleanvoice':
        return '🎙️ Step 3: Processing Audio with CleanVoice API...';
      case 'save':
        return '💾 Saving results...';
      default:
        return '⏳ Processing...';
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            🎬 Procesare Videouri
          </DialogTitle>
          <DialogDescription>
            Analizăm fiecare video pentru a detecta textul roșu și a calcula timestamps...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* FFmpeg Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">📤 FFmpeg (Upload + Extract Audio)</p>
              <p className="text-xs font-medium text-gray-700">{ffmpegProgress.current}/{ffmpegProgress.total}</p>
            </div>
            <Progress value={ffmpegPercent} className="h-2" />
            <p className="text-xs text-gray-500">
              {ffmpegProgress.status === 'idle' && '⏸️ Waiting...'}
              {ffmpegProgress.status === 'processing' && ffmpegProgress.activeVideos.length > 0 && (
                <span>⏳ Processing {ffmpegProgress.activeVideos.length} video(s): {ffmpegProgress.activeVideos.slice(0, 2).join(', ')}{ffmpegProgress.activeVideos.length > 2 && ` +${ffmpegProgress.activeVideos.length - 2} more`}</span>
              )}
              {ffmpegProgress.status === 'complete' && '✅ Complete!'}
            </p>
          </div>

          {/* Whisper Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">🎤 Whisper (Transcription)</p>
              <p className="text-xs font-medium text-gray-700">{whisperProgress.current}/{whisperProgress.total}</p>
            </div>
            <Progress value={whisperPercent} className="h-2" />
            <p className="text-xs text-gray-500">
              {whisperProgress.status === 'idle' && '⏸️ Waiting...'}
              {whisperProgress.status === 'processing' && whisperProgress.activeVideos.length > 0 && (
                <span>⏳ Processing {whisperProgress.activeVideos.length} video(s): {whisperProgress.activeVideos.slice(0, 2).join(', ')}{whisperProgress.activeVideos.length > 2 && ` +${whisperProgress.activeVideos.length - 2} more`}</span>
              )}
              {whisperProgress.status === 'complete' && '✅ Complete!'}
            </p>
          </div>

          {/* CleanVoice Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">🎵 CleanVoice (Audio Enhancement)</p>
              <p className="text-xs font-medium text-gray-700">{cleanvoiceProgress.current}/{cleanvoiceProgress.total}</p>
            </div>
            <Progress value={cleanvoicePercent} className="h-2" />
            <p className="text-xs text-gray-500">
              {cleanvoiceProgress.status === 'idle' && '⏸️ Waiting...'}
              {cleanvoiceProgress.status === 'processing' && cleanvoiceProgress.activeVideos.length > 0 && (
                <span>⏳ Processing {cleanvoiceProgress.activeVideos.length} video(s): {cleanvoiceProgress.activeVideos.slice(0, 2).join(', ')}{cleanvoiceProgress.activeVideos.length > 2 && ` +${cleanvoiceProgress.activeVideos.length - 2} more`}</span>
              )}
              {cleanvoiceProgress.status === 'complete' && '✅ Complete!'}
            </p>
          </div>

          {/* Overall Progress */}
          <div className="border-t pt-3">
            <p className="text-center text-sm font-semibold text-gray-800">
              📊 Total: {totalCompleted}/{totalVideos} videouri complete
            </p>
          </div>

          {/* Removed: Current Video and Step labels - batch processing makes this confusing */}

          {/* Estimated Time */}
          {totalCompleted < totalVideos && estimatedMinutes > 0 && (
            <p className="text-xs text-center text-gray-500">
              ⏱️ Timp estimat rămas: ~{estimatedMinutes} {estimatedMinutes === 1 ? 'minut' : 'minute'}
            </p>
          )}

          {/* Completion Message */}
          {totalCompleted === totalVideos && totalVideos > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-sm font-semibold text-green-900">
                ✅ Toate videouri procesate cu succes!
              </p>
              <p className="text-xs text-green-700 mt-1">
                Deschidere Step 8...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
