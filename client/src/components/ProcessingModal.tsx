import React, { useState, useEffect } from 'react';
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
  // Phase-specific tracking
  ffmpegSuccess?: string[];
  ffmpegFailed?: Array<{ videoName: string; error: string }>;
  whisperSuccess?: string[];
  whisperFailed?: Array<{ videoName: string; error: string }>;
  cleanvoiceSuccess?: string[];
  cleanvoiceFailed?: Array<{ videoName: string; error: string }>;
  // Callbacks
  onRetryFailed?: () => void;
  onClose?: () => void;
  onContinue?: () => void;
  onSampleMerge?: () => void;
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
  ffmpegSuccess = [],
  ffmpegFailed = [],
  whisperSuccess = [],
  whisperFailed = [],
  cleanvoiceSuccess = [],
  cleanvoiceFailed = [],
  onRetryFailed,
  onClose,
  onContinue,
  onSampleMerge
}: ProcessingModalProps) {
  const ffmpegPercent = ffmpegProgress.total > 0 ? (ffmpegProgress.current / ffmpegProgress.total) * 100 : 0;
  const whisperPercent = whisperProgress.total > 0 ? (whisperProgress.current / whisperProgress.total) * 100 : 0;
  const cleanvoicePercent = cleanvoiceProgress.total > 0 ? (cleanvoiceProgress.current / cleanvoiceProgress.total) * 100 : 0;
  const totalCompleted = Math.min(ffmpegProgress.current, whisperProgress.current, cleanvoiceProgress.current);
  const totalVideos = ffmpegProgress.total;
  
  // Collapsible log states
  const [isFFmpegSuccessOpen, setIsFFmpegSuccessOpen] = useState(false);
  const [isFFmpegFailedOpen, setIsFFmpegFailedOpen] = useState(false);
  const [isWhisperSuccessOpen, setIsWhisperSuccessOpen] = useState(false);
  const [isWhisperFailedOpen, setIsWhisperFailedOpen] = useState(false);
  const [isCleanVoiceSuccessOpen, setIsCleanVoiceSuccessOpen] = useState(false);
  const [isCleanVoiceFailedOpen, setIsCleanVoiceFailedOpen] = useState(false);
  
  // Auto-open failed logs
  useEffect(() => {
    if (ffmpegFailed.length > 0) setIsFFmpegFailedOpen(true);
  }, [ffmpegFailed.length]);
  
  useEffect(() => {
    if (whisperFailed.length > 0) setIsWhisperFailedOpen(true);
  }, [whisperFailed.length]);
  
  useEffect(() => {
    if (cleanvoiceFailed.length > 0) setIsCleanVoiceFailedOpen(true);
  }, [cleanvoiceFailed.length]);
  
  const isProcessing = ffmpegProgress.status === 'processing' || 
                      whisperProgress.status === 'processing' || 
                      cleanvoiceProgress.status === 'processing';

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
            {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-purple-600" />}
            ✂️ Prepare for Cutting
          </DialogTitle>
          <DialogDescription>
            Procesăm audio și generăm timestamps pentru fiecare video...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ========== FFmpeg Section ========== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">🎬 FFmpeg (WAV Extraction)</p>
              <p className="text-sm font-medium text-gray-600">{ffmpegProgress.current}/{ffmpegProgress.total}</p>
            </div>
            <Progress value={ffmpegPercent} className="h-3 bg-blue-100" />
            
            {/* Success Log */}
            {ffmpegSuccess.length > 0 && (
              <div>
                <button
                  onClick={() => setIsFFmpegSuccessOpen(!isFFmpegSuccessOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                >
                  <span>✅ Success ({ffmpegSuccess.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isFFmpegSuccessOpen && (
                  <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                    {ffmpegSuccess.map((name, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                        <span className="text-green-600">✓</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Failed Log */}
            {ffmpegFailed.length > 0 && (
              <div>
                <button
                  onClick={() => setIsFFmpegFailedOpen(!isFFmpegFailedOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                >
                  <span>❌ Failed ({ffmpegFailed.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isFFmpegFailedOpen && (
                  <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    {ffmpegFailed.map((f, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-red-600">✗</span>
                          <div className="flex-1">
                            <div className="font-medium text-red-700">{f.videoName}</div>
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
            {ffmpegProgress.activeVideos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-blue-700 mb-2">
                  ⏳ Processing ({ffmpegProgress.activeVideos.length}):
                </p>
                <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  {ffmpegProgress.activeVideos.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========== Whisper Section ========== */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">🎤 Whisper (Transcription)</p>
              <p className="text-sm font-medium text-gray-600">{whisperProgress.current}/{whisperProgress.total}</p>
            </div>
            <Progress value={whisperPercent} className="h-3 bg-purple-100" />
            
            {/* Success Log */}
            {whisperSuccess.length > 0 && (
              <div>
                <button
                  onClick={() => setIsWhisperSuccessOpen(!isWhisperSuccessOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                >
                  <span>✅ Success ({whisperSuccess.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isWhisperSuccessOpen && (
                  <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                    {whisperSuccess.map((name, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                        <span className="text-green-600">✓</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Failed Log */}
            {whisperFailed.length > 0 && (
              <div>
                <button
                  onClick={() => setIsWhisperFailedOpen(!isWhisperFailedOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                >
                  <span>❌ Failed ({whisperFailed.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isWhisperFailedOpen && (
                  <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    {whisperFailed.map((f, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-red-600">✗</span>
                          <div className="flex-1">
                            <div className="font-medium text-red-700">{f.videoName}</div>
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
            {whisperProgress.activeVideos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-blue-700 mb-2">
                  ⏳ Processing ({whisperProgress.activeVideos.length}):
                </p>
                <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  {whisperProgress.activeVideos.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========== CleanVoice Section ========== */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">🎵 CleanVoice (Audio Processing)</p>
              <p className="text-sm font-medium text-gray-600">{cleanvoiceProgress.current}/{cleanvoiceProgress.total}</p>
            </div>
            <Progress value={cleanvoicePercent} className="h-3 bg-orange-100" />
            
            {/* Success Log */}
            {cleanvoiceSuccess.length > 0 && (
              <div>
                <button
                  onClick={() => setIsCleanVoiceSuccessOpen(!isCleanVoiceSuccessOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                >
                  <span>✅ Success ({cleanvoiceSuccess.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isCleanVoiceSuccessOpen && (
                  <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                    {cleanvoiceSuccess.map((name, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                        <span className="text-green-600">✓</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Failed Log */}
            {cleanvoiceFailed.length > 0 && (
              <div>
                <button
                  onClick={() => setIsCleanVoiceFailedOpen(!isCleanVoiceFailedOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                >
                  <span>❌ Failed ({cleanvoiceFailed.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isCleanVoiceFailedOpen && (
                  <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    {cleanvoiceFailed.map((f, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-red-600">✗</span>
                          <div className="flex-1">
                            <div className="font-medium text-red-700">{f.videoName}</div>
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
            {cleanvoiceProgress.activeVideos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-blue-700 mb-2">
                  ⏳ Processing ({cleanvoiceProgress.activeVideos.length}):
                </p>
                <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  {cleanvoiceProgress.activeVideos.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========== Countdown Timer ========== */}
          {countdown > 0 && (
            <div className="border-t pt-4">
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 text-center">
                <p className="text-4xl font-bold text-orange-600 tabular-nums">
                  ⏳ {countdown}s
                </p>
                <p className="text-xs text-orange-500 mt-2">
                  FFmpeg rate limit - waiting before next batch
                </p>
              </div>
            </div>
          )}

          {/* ========== Estimated Time ========== */}
          {isProcessing && countdown === 0 && estimatedMinutes > 0 && (
            <p className="text-xs text-center text-gray-500">
              ⏱️ Timp estimat rămas: ~{estimatedMinutes} {estimatedMinutes === 1 ? 'minute' : 'minutes'}
            </p>
          )}

          {/* ========== Sample Merge Button ========== */}
          {!isProcessing && totalCompleted === totalVideos && totalVideos > 0 && onSampleMerge && (
            <>
              <div className="border-t pt-4 pb-2">
                <button
                  onClick={onSampleMerge}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-6 rounded-lg text-base font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  🎬 Sample Merge ALL Videos
                </button>
              </div>
              {/* Horizontal line separator */}
              <div className="border-t border-gray-300 my-2"></div>
            </>
          )}

          {/* ========== Action Buttons ========== */}
          <div className="flex gap-2 pt-4">
            {/* Continue Button - only if processing complete AND no failures */}
            {!isProcessing && totalCompleted === totalVideos && totalVideos > 0 && failedVideos.length === 0 && onContinue && (
              <button
                onClick={onContinue}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ➡️ Continue to Step 8
              </button>
            )}
            
            {/* Retry Failed - only if processing complete AND has failures */}
            {!isProcessing && totalCompleted === totalVideos && totalVideos > 0 && failedVideos.length > 0 && onRetryFailed && (
              <button
                onClick={onRetryFailed}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔄 Retry Failed ({failedVideos.length})
              </button>
            )}
            
            {/* Close - always visible when not processing */}
            {!isProcessing && onClose && (
              <button
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ❌ Close
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
