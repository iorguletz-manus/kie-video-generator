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
            ✂️ Prepare for Cutting
          </DialogTitle>
          <DialogDescription>
            Procesăm audio și generăm timestamps pentru fiecare video...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* FFmpeg Progress Bar - FIRST */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">🎬 FFmpeg (WAV Extraction)</p>
              <p className="text-xs font-medium text-gray-700">{ffmpegProgress.current}/{ffmpegProgress.total}</p>
            </div>
            <Progress value={ffmpegPercent} className="h-2" />
          </div>

          {/* CleanVoice Progress Bar - SECOND */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">🎤 CleanVoice (Audio Processing)</p>
              <p className="text-xs font-medium text-gray-700">{cleanvoiceProgress.current}/{cleanvoiceProgress.total}</p>
            </div>
            <Progress value={cleanvoicePercent} className="h-2" />
          </div>

          {/* Whisper Progress Bar - THIRD */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">📝 Whisper (Transcription)</p>
              <p className="text-xs font-medium text-gray-700">{whisperProgress.current}/{whisperProgress.total}</p>
            </div>
            <Progress value={whisperPercent} className="h-2" />
          </div>

          {/* Removed: Current Video and Step labels - batch processing makes this confusing */}

          {/* Estimated Time - Hardcoded */}
          {totalCompleted < totalVideos && (
            <p className="text-xs text-center text-gray-500">
              ⏱️ Timp estimat rămas: ~30 seconds
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
