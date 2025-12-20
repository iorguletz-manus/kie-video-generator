import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Loader2 } from 'lucide-react';

interface MergeFinalProgressModalProps {
  open: boolean;
  status: 'countdown' | 'processing' | 'complete' | 'partial' | 'error';
  message: string;
  countdown?: number;
  total: number;
  current: number;
  currentBatch: number;
  totalBatches: number;
  
  // Success tracking
  successVideos: Array<{ name: string; hookName: string; bodyName: string }>;
  // Failed tracking
  failedVideos: Array<{ name: string; error: string }>;
  // In-progress tracking
  inProgressVideos: Array<{ name: string }>;
  
  // Callbacks
  onSkipCountdown?: () => void;
  onRetryFailed?: () => void;
  onContinue?: () => void;
  onClose?: () => void;
}

export function MergeFinalProgressModal({
  open,
  status,
  message,
  countdown = 0,
  total,
  current,
  currentBatch,
  totalBatches,
  successVideos = [],
  failedVideos = [],
  inProgressVideos = [],
  onSkipCountdown,
  onRetryFailed,
  onContinue,
  onClose
}: MergeFinalProgressModalProps) {
  // Calculate progress percentage
  const totalVideos = successVideos.length + failedVideos.length + inProgressVideos.length;
  const progressPercent = totalVideos > 0 ? ((successVideos.length + failedVideos.length) / total) * 100 : 0;
  
  // Collapsible log states
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isFailedOpen, setIsFailedOpen] = useState(false);
  
  // Auto-open failed logs
  useEffect(() => {
    if (failedVideos.length > 0) setIsFailedOpen(true);
  }, [failedVideos.length]);
  
  const isProcessing = status === 'processing' || status === 'countdown';
  const isComplete = status === 'complete' || status === 'partial';
  const hasFailures = failedVideos.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !isProcessing && onClose) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full" onInteractOutside={(e) => {
        if (isProcessing) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-green-600" />}
            🎬 Merge Final Videos
          </DialogTitle>
          <DialogDescription>
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Countdown Timer */}
          {countdown !== undefined && countdown > 0 && (
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg px-6 py-4">
                <p className="text-center text-4xl font-bold text-orange-600 tabular-nums">
                  ⏳ {countdown}s
                </p>
                <p className="text-center text-xs text-orange-500 mt-2">
                  Waiting before {currentBatch === 0 ? 'starting merge' : 'next batch'}...
                </p>
              </div>
              {onSkipCountdown && (
                <Button
                  onClick={onSkipCountdown}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                >
                  ⏩ Skip Countdown
                </Button>
              )}
            </div>
          )}

          {/* Main Progress Section */}
          {total > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">🎬 Final Videos</p>
                <p className="text-sm font-medium text-gray-600">{successVideos.length + failedVideos.length}/{total}</p>
              </div>
              <Progress value={progressPercent} className="h-3 bg-green-100" />
              
              {/* Success Log - COLLAPSIBLE */}
              {successVideos.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsSuccessOpen(!isSuccessOpen)}
                    className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                  >
                    <span>✅ Success ({successVideos.length})</span>
                    <span className="text-blue-600 underline text-xs">View log</span>
                  </button>
                  {isSuccessOpen && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                      {successVideos.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                          <span className="text-green-600">✓</span>
                          <div>
                            <div className="font-medium">{v.name}</div>
                            <div className="text-xs text-gray-500">
                              {v.hookName} + {v.bodyName}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Failed Log - COLLAPSIBLE */}
              {failedVideos.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsFailedOpen(!isFailedOpen)}
                    className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                  >
                    <span>❌ Failed ({failedVideos.length})</span>
                    <span className="text-blue-600 underline text-xs">View log</span>
                  </button>
                  {isFailedOpen && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                      {failedVideos.map((f, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-red-600">✗</span>
                            <div className="flex-1">
                              <div className="font-medium text-red-700">{f.name}</div>
                              <div className="text-xs text-red-600 mt-0.5">Error: {f.error}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* In Progress - LIVE LIST */}
              {inProgressVideos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    ⏳ Processing ({inProgressVideos.length}):
                  </p>
                  <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                    {inProgressVideos.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{v.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {isComplete && (
            <div className="flex gap-3 pt-4 border-t">
              {hasFailures && onRetryFailed && (
                <Button
                  onClick={onRetryFailed}
                  variant="outline"
                  className="flex-1"
                >
                  🔄 Retry Failed
                </Button>
              )}
              {onContinue && (
                <Button
                  onClick={onContinue}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  ✅ Continue to Next Step
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MergeFinalProgressModal;
