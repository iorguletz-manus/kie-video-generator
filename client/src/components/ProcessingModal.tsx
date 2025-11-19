import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { Loader2 } from 'lucide-react';

interface ProcessingModalProps {
  open: boolean;
  current: number;
  total: number;
  currentVideoName: string;
  processingStep: 'download' | 'extract' | 'whisper' | 'detect' | 'save' | null;
}

export function ProcessingModal({
  open,
  current,
  total,
  currentVideoName,
  processingStep
}: ProcessingModalProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;
  const estimatedMinutes = Math.ceil((total - current) * 15 / 60); // ~15s per video

  const getStepLabel = () => {
    switch (processingStep) {
      case 'extract':
        return '🎵 Step 1: Extracting Audio with FFmpeg API...';
      case 'whisper':
        return '🤖 Step 2: Extracting Timestamps with Whisper API...';
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
            🎬 Procesare Videouri cu Whisper AI
          </DialogTitle>
          <DialogDescription>
            Analizăm fiecare video pentru a detecta textul roșu și a calcula timestamps...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-3" />
            <p className="text-center text-sm font-medium text-gray-700">
              {current}/{total} videouri procesate
            </p>
          </div>

          {/* Current Video */}
          {current < total && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-purple-900 mb-1">
                Video curent: {currentVideoName}
              </p>
              <div className="flex items-center gap-2 text-xs text-purple-700">
                <Loader2 className="w-3 h-3 animate-spin" />
                {getStepLabel()}
              </div>
            </div>
          )}

          {/* Estimated Time */}
          {current < total && estimatedMinutes > 0 && (
            <p className="text-xs text-center text-gray-500">
              ⏱️ Timp estimat rămas: ~{estimatedMinutes} {estimatedMinutes === 1 ? 'minut' : 'minute'}
            </p>
          )}

          {/* Completion Message */}
          {current === total && total > 0 && (
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
