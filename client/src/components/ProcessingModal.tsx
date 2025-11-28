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
  countdown?: number;
  estimatedMinutes?: number;
  successVideos?: string[];
  failedVideos?: Array<{ videoName: string; error: string }>;
  onRetryFailed?: () => void;
}

export function ProcessingModal({
  open,
  ffmpegProgress,
  whisperProgress,
  cleanvoiceProgress,
  currentVideoName,
  processingStep,
  countdown = 0,
  estimatedMinutes = 0,
  successVideos = [],
  failedVideos = [],
  onRetryFailed
}: ProcessingModalProps) {
  const ffmpegPercent = ffmpegProgress.total > 0 ? (ffmpegProgress.current / ffmpegProgress.total) * 100 : 0;
  const whisperPercent = whisperProgress.total > 0 ? (whisperProgress.current / whisperProgress.total) * 100 : 0;
  const cleanvoicePercent = cleanvoiceProgress.total > 0 ? (cleanvoiceProgress.current / cleanvoiceProgress.total) * 100 : 0;
  const totalCompleted = Math.min(ffmpegProgress.current, whisperProgress.current, cleanvoiceProgress.current);
  const totalVideos = ffmpegProgress.total;
  
  // Use provided estimatedMinutes (calculated in batchProcessVideosWithWhisper)

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

          {/* Countdown Timer (during FFmpeg batch wait) */}
          {countdown > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-900">{countdown}s</p>
              <p className="text-xs text-blue-700 mt-1">
                ⏳ FFmpeg rate limit - waiting before next batch
              </p>
            </div>
          )}

          {/* Estimated Time */}
          {totalCompleted < totalVideos && countdown === 0 && estimatedMinutes > 0 && (
            <p className="text-xs text-center text-gray-500">
              ⏱️ Timp estimat rămas: ~{estimatedMinutes} {estimatedMinutes === 1 ? 'minute' : 'minutes'}
            </p>
          )}

          {/* Success/Failed Summary */}
          {(successVideos.length > 0 || failedVideos.length > 0) && (
            <div className="space-y-2">
              {successVideos.length > 0 && (
                <p className="text-xs text-green-600">
                  ✅ Success: {successVideos.length}
                </p>
              )}
              {failedVideos.length > 0 && (
                <p className="text-xs text-red-600">
                  ❌ Failed: {failedVideos.length}
                </p>
              )}
            </div>
          )}

          {/* Retry Failed Button - Only show when ALL processing is complete */}
          {totalCompleted === totalVideos && totalVideos > 0 && failedVideos.length > 0 && onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              🔄 Retry {failedVideos.length} Failed Video{failedVideos.length > 1 ? 's' : ''}
            </button>
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
