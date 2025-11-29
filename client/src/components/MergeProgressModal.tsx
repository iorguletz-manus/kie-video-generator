import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface MergeProgressModalProps {
  isOpen: boolean;
  status: 'countdown' | 'processing' | 'complete' | 'partial' | 'error';
  message: string;
  countdown?: number;
  totalMerges?: number;
  bodyInfo?: {
    totalVideos: number;
    totalChunks: number;
    currentChunk: number;
    chunkResults: Array<{ chunkNum: number; status: 'success' | 'failed'; url?: string; error?: string }>;
    finalUrl: string | null;
    status: 'pending' | 'processing' | 'success' | 'failed';
  } | null;
  hookGroups?: Array<{
    baseName: string;
    videoCount: number;
    videoNames: string[];
    status: 'pending' | 'processing' | 'success' | 'failed';
    cdnUrl: string | null;
    error: string | null;
  }>;
  failedItems?: Array<{
    type: 'body_chunk' | 'body_final' | 'hook';
    name: string;
    error: string;
  }>;
  // NEW: Detailed tracking
  bodySuccessVideos?: Array<{name: string; chunkNum: number}>;
  bodyFailedVideos?: Array<{name: string; chunkNum: number; error: string; retries: number}>;
  bodyInProgressVideos?: Array<{name: string; chunkNum: number}>;
  hookSuccessGroups?: Array<{baseName: string; videoCount: number; videoNames: string[]; batchNum: number}>;
  hookFailedGroups?: Array<{baseName: string; videoCount: number; videoNames: string[]; error: string; retries: number; batchNum: number}>;
  hookInProgressGroups?: Array<{baseName: string; videoCount: number; videoNames: string[]; batchNum: number}>;
  bodyChunksCurrent?: number;
  bodyChunksTotal?: number;
  hooksCurrent?: number;
  hooksTotal?: number;
  hookBatchesCurrent?: number;
  hookBatchesTotal?: number;
  onRetryFailed?: () => void;
  onContinue?: () => void;
  onClose?: () => void;
}

export default function MergeProgressModal({
  isOpen,
  status,
  message,
  countdown,
  totalMerges,
  bodyInfo,
  hookGroups,
  failedItems,
  bodySuccessVideos = [],
  bodyFailedVideos = [],
  bodyInProgressVideos = [],
  hookSuccessGroups = [],
  hookFailedGroups = [],
  hookInProgressGroups = [],
  bodyChunksCurrent = 0,
  bodyChunksTotal = 0,
  hooksCurrent = 0,
  hooksTotal = 0,
  hookBatchesCurrent = 0,
  hookBatchesTotal = 0,
  onRetryFailed,
  onContinue,
  onClose
}: MergeProgressModalProps) {
  const [isBodySuccessOpen, setIsBodySuccessOpen] = useState(false);
  const [isBodyFailedOpen, setIsBodyFailedOpen] = useState(true); // Auto-open failures
  const [isHooksSuccessOpen, setIsHooksSuccessOpen] = useState(false);
  const [isHooksFailedOpen, setIsHooksFailedOpen] = useState(true); // Auto-open failures

  if (!isOpen) return null;

  const isProcessing = status === 'processing' || status === 'countdown';
  const isComplete = status === 'complete' || status === 'partial';
  const hasFailures = (failedItems?.length || 0) > 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center gap-3">
            {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-red-600" />}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                🔗 STEP 2: Prepare for Merge
              </h2>
              <p className="text-sm text-gray-600 mt-1">{message}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Progress Bars */}
          {(bodyChunksTotal > 0 || hooksTotal > 0) && (
            <div className="space-y-4">
              {/* BODY Chunks Progress */}
              {bodyChunksTotal > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">✂️ BODY Chunks</p>
                    <p className="text-sm font-medium text-green-700">{bodyChunksCurrent}/{bodyChunksTotal} chunks</p>
                  </div>
                  <div className="w-full bg-green-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-green-600 h-full transition-all duration-300"
                      style={{ width: `${(bodyChunksCurrent / bodyChunksTotal) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* HOOKS Progress */}
              {hooksTotal > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      🔗 HOOKS Groups
                      {hookBatchesTotal > 1 && ` (Batch ${hookBatchesCurrent}/${hookBatchesTotal})`}
                    </p>
                    <p className="text-sm font-medium text-purple-700">{hooksCurrent}/{hooksTotal} groups</p>
                  </div>
                  <div className="w-full bg-purple-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-purple-600 h-full transition-all duration-300"
                      style={{ width: `${(hooksCurrent / hooksTotal) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Countdown Timer */}
          {countdown !== undefined && countdown > 0 && (
            <div className="flex items-center justify-center">
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg px-6 py-4">
                <p className="text-center text-4xl font-bold text-orange-600 tabular-nums">
                  ⏳ {countdown}s
                </p>
                <p className="text-center text-xs text-orange-500 mt-2">
                  Waiting for FFmpeg rate limit...
                </p>
              </div>
            </div>
          )}

          {/* HOOKS Section */}
          {hookGroups && hookGroups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">🎣 HOOKS ({hookGroups.length} groups{hookBatchesTotal > 1 ? ` → ${hookBatchesTotal} batches` : ''})</p>
                <p className="text-sm font-medium text-gray-600">{hookSuccessGroups.length + hookFailedGroups.length}/{hookGroups.length}</p>
              </div>
              <Progress value={hookPercent} className="h-3 bg-purple-100" />
                {/* Success Log */}
                {hookSuccessGroups.length > 0 && (
                  <div>
                    <button
                      onClick={() => setIsHooksSuccessOpen(!isHooksSuccessOpen)}
                      className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                    >
                      <span>✅ Success ({hookSuccessGroups.length})</span>
                      <span className="text-blue-600 underline text-xs">View log</span>
                    </button>
                    {isHooksSuccessOpen && (
                      <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                        {hookSuccessGroups.map((g, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-green-700">
                              <span className="text-green-600">✓</span>
                              <div>
                                <span>{g.baseName}</span>
                                <span className="text-gray-500 text-xs ml-2">({g.videoCount} videos)</span>
                                {hookBatchesTotal > 1 && (
                                  <span className="text-gray-500 text-xs ml-2">Batch {g.batchNum}</span>
                                )}
                              </div>
                            </div>
                            {/* Individual videos */}
                            <div className="ml-6 space-y-0.5">
                              {g.videoNames.map((vName, vi) => (
                                <div key={vi} className="text-xs text-gray-600">
                                  └─ {vName}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Failed Log */}
                {hookFailedGroups.length > 0 && (
                  <div>
                    <button
                      onClick={() => setIsHooksFailedOpen(!isHooksFailedOpen)}
                      className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                    >
                      <span>❌ Failed ({hookFailedGroups.length})</span>
                      <span className="text-blue-600 underline text-xs">View log</span>
                    </button>
                    {isHooksFailedOpen && (
                      <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                        {hookFailedGroups.map((g, i) => (
                          <div key={i} className="text-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-red-600">✗</span>
                              <div className="flex-1">
                                <div className="font-medium text-red-700">{g.baseName}</div>
                                <div className="text-xs text-gray-500">
                                  {g.videoCount} videos
                                  {hookBatchesTotal > 1 && ` • Batch ${g.batchNum}`}
                                </div>
                                <div className="text-xs text-red-600 mt-0.5">Error: {g.error}</div>
                                {g.retries > 0 && (
                                  <div className="text-xs text-orange-600 mt-1">Retries: {g.retries}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* In Progress */}
                {hookInProgressGroups.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-2">
                      ⏳ Processing ({hookInProgressGroups.length}):
                    </p>
                    <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                      {hookInProgressGroups.map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{g.baseName}</span>
                          <span className="text-xs text-gray-500">({g.videoCount} videos)</span>
                          {hookBatchesTotal > 1 && (
                            <span className="text-xs text-gray-500">Batch {g.batchNum}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* BODY Section */}
          {bodyInfo && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">📺 BODY ({bodyInfo.totalVideos} videos → {bodyInfo.totalChunks} chunks)</p>
                <p className="text-sm font-medium text-gray-600">{bodySuccessVideos.length + bodyFailedVideos.length}/{bodyInfo.totalVideos}</p>
              </div>
              <Progress value={bodyPercent} className="h-3 bg-green-100" />
                {/* Success Log */}
                {bodySuccessVideos.length > 0 && (
                  <div>
                    <button
                      onClick={() => setIsBodySuccessOpen(!isBodySuccessOpen)}
                      className="w-full flex items-center justify-between text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                    >
                      <span>✅ Success ({bodySuccessVideos.length})</span>
                      <span className="text-blue-600 underline text-xs">View log</span>
                    </button>
                    {isBodySuccessOpen && (
                      <div className="mt-2 max-h-32 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                        {bodySuccessVideos.map((v, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                            <span className="text-green-600">✓</span>
                            <span>{v.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Failed Log */}
                {bodyFailedVideos.length > 0 && (
                  <div>
                    <button
                      onClick={() => setIsBodyFailedOpen(!isBodyFailedOpen)}
                      className="w-full flex items-center justify-between text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                    >
                      <span>❌ Failed ({bodyFailedVideos.length})</span>
                      <span className="text-blue-600 underline text-xs">View log</span>
                    </button>
                    {isBodyFailedOpen && (
                      <div className="mt-2 max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                        {bodyFailedVideos.map((v, i) => (
                          <div key={i} className="text-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-red-600">✗</span>
                              <div className="flex-1">
                                <div className="font-medium text-red-700">{v.name}</div>
                                <div className="text-xs text-red-600 mt-0.5">Error: {v.error}</div>
                                {v.retries > 0 && (
                                  <div className="text-xs text-orange-600 mt-1">Retries: {v.retries}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* In Progress */}
                {bodyInProgressVideos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-2">
                      ⏳ Processing ({bodyInProgressVideos.length}):
                    </p>
                    <div className="max-h-24 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                      {bodyInProgressVideos.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{v.name}</span>
                          <span className="text-xs text-gray-500">(Chunk {v.chunkNum})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Summary */}
          {isComplete && (
            <div className={`border-2 rounded-lg p-4 ${hasFailures ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
              <p className={`font-semibold ${hasFailures ? 'text-orange-900' : 'text-green-900'}`}>
                {hasFailures 
                  ? `⚠️ ${(totalMerges || 0) - (failedItems?.length || 0)} succeeded, ${failedItems?.length} failed`
                  : `✅ All ${totalMerges} merges completed successfully!`
                }
              </p>
            </div>
          )}
        </div>

        {/* Footer - Action Buttons */}
        {!isProcessing && (
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
            {/* Continue Button (only if no failures) */}
            {!hasFailures && onContinue && (
              <button
                onClick={onContinue}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ➡️ Continue to Step 10
              </button>
            )}

            {/* Retry Failed Button (only if failures exist) */}
            {hasFailures && onRetryFailed && (
              <button
                onClick={onRetryFailed}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                🔄 Retry Failed ({failedItems?.length})
              </button>
            )}

            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ❌ Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
