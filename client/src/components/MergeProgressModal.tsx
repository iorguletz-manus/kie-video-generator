import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Loader2 } from 'lucide-react';

interface MergeProgressModalProps {
  open: boolean;
  status: 'countdown' | 'processing' | 'complete' | 'partial' | 'error';
  message: string;
  countdown?: number;
  totalFinalVideos: number;
  currentFinalVideo: number;
  currentBatch: number;
  totalBatches: number;
  
  // HOOKS tracking
  hooksSuccess: Array<{ name: string; videoCount: number; videoNames: string[] }>;
  hooksFailed: Array<{ name: string; error: string }>;
  hooksInProgress: Array<{ name: string }>;
  
  // BODY tracking
  bodySuccess: Array<{ name: string }>;
  bodyFailed: Array<{ name: string; error: string }>;
  bodyInProgress: Array<{ name: string }>;
  
  // Callbacks
  onSkipCountdown?: () => void;
  onRetryFailed?: () => void;
  onContinue?: () => void;
  onClose?: () => void;
}

export function MergeProgressModal({
  open,
  status,
  message,
  countdown = 0,
  totalFinalVideos,
  currentFinalVideo,
  currentBatch,
  totalBatches,
  hooksSuccess = [],
  hooksFailed = [],
  hooksInProgress = [],
  bodySuccess = [],
  bodyFailed = [],
  bodyInProgress = [],
  onSkipCountdown,
  onRetryFailed,
  onContinue,
  onClose
}: MergeProgressModalProps) {
  // Calculate progress percentages
  const totalHooks = hooksSuccess.length + hooksFailed.length + hooksInProgress.length;
  const hooksPercent = totalHooks > 0 ? ((hooksSuccess.length + hooksFailed.length) / totalHooks) * 100 : 0;
  
  const totalBody = bodySuccess.length + bodyFailed.length + bodyInProgress.length;
  const bodyPercent = totalBody > 0 ? ((bodySuccess.length + bodyFailed.length) / totalBody) * 100 : 0;
  
  // Collapsible log states
  const [isHooksSuccessOpen, setIsHooksSuccessOpen] = useState(false);
  const [isHooksFailedOpen, setIsHooksFailedOpen] = useState(false);
  const [isBodySuccessOpen, setIsBodySuccessOpen] = useState(false);
  const [isBodyFailedOpen, setIsBodyFailedOpen] = useState(false);
  
  // Auto-open failed logs
  useEffect(() => {
    if (hooksFailed.length > 0) setIsHooksFailedOpen(true);
  }, [hooksFailed.length]);
  
  useEffect(() => {
    if (bodyFailed.length > 0) setIsBodyFailedOpen(true);
  }, [bodyFailed.length]);
  
  const isProcessing = status === 'processing' || status === 'countdown';
  const isComplete = status === 'complete' || status === 'partial';
  const hasFailures = hooksFailed.length > 0 || bodyFailed.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !isProcessing && onClose) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => {
        if (isProcessing) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-purple-600" />}
            🔗 STEP 2: Prepare for Merge
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

          {/* ========== HOOKS Section ========== */}
          {totalHooks > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">🎣 HOOKS (Groups)</p>
                <p className="text-sm font-medium text-gray-600">{hooksSuccess.length + hooksFailed.length}/{totalHooks}</p>
              </div>
              <Progress value={hooksPercent} className="h-3 bg-purple-100" />
              
              {/* Success Log */}
              {hooksSuccess.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsHooksSuccessOpen(!isHooksSuccessOpen)}
                    className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                  >
                    <span>✅ Success ({hooksSuccess.length})</span>
                    <span className="text-blue-600 underline text-xs">View log</span>
                  </button>
                  {isHooksSuccessOpen && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                      {hooksSuccess.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                          <span className="text-green-600">✓</span>
                          <div>
                            <div className="font-medium">{h.name}</div>
                            <div className="text-xs text-gray-500">
                              {h.videoCount} videos: {h.videoNames.join(', ')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Failed Log */}
              {hooksFailed.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsHooksFailedOpen(!isHooksFailedOpen)}
                    className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                  >
                    <span>❌ Failed ({hooksFailed.length})</span>
                    <span className="text-blue-600 underline text-xs">View log</span>
                  </button>
                  {isHooksFailedOpen && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                      {hooksFailed.map((f, i) => (
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
              
              {/* In Progress */}
              {hooksInProgress.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    ⏳ Processing ({hooksInProgress.length}):
                  </p>
                  <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                    {hooksInProgress.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{h.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== BODY Section ========== */}
          {totalBody > 0 && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">📺 BODY (Videos)</p>
                <p className="text-sm font-medium text-gray-600">{bodySuccess.length + bodyFailed.length}/{totalBody}</p>
              </div>
              <Progress value={bodyPercent} className="h-3 bg-green-100" />
              
              {/* Success Log */}
              {bodySuccess.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsBodySuccessOpen(!isBodySuccessOpen)}
                    className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                  >
                    <span>✅ Success ({bodySuccess.length})</span>
                    <span className="text-blue-600 underline text-xs">View log</span>
                  </button>
                  {isBodySuccessOpen && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                      {bodySuccess.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                          <span className="text-green-600">✓</span>
                          <span>{b.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Failed Log */}
              {bodyFailed.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsBodyFailedOpen(!isBodyFailedOpen)}
                    className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                  >
                    <span>❌ Failed ({bodyFailed.length})</span>
                    <span className="text-blue-600 underline text-xs">View log</span>
                  </button>
                  {isBodyFailedOpen && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                      {bodyFailed.map((f, i) => (
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
              
              {/* In Progress */}
              {bodyInProgress.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    ⏳ Processing ({bodyInProgress.length}):
                  </p>
                  <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                    {bodyInProgress.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{b.name}</span>
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

export default MergeProgressModal;
