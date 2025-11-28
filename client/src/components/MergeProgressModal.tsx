import React from 'react';

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
  onRetryFailed?: () => void;
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
  onRetryFailed,
  onClose
}: MergeProgressModalProps) {
  if (!isOpen) return null;

  const isComplete = status === 'complete' || status === 'partial';
  const hasFailures = (failedItems?.length || 0) > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            🔄 STEP 2: Prepare for Merge
          </h2>
          <p className="text-sm text-gray-600 mt-1">{message}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Summary */}
          {totalMerges !== undefined && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📦 Total Merges: {totalMerges}</h3>
              <div className="text-sm text-blue-800 space-y-1">
                {bodyInfo && <div>• 1 BODY merge ({bodyInfo.totalVideos} videos)</div>}
                {hookGroups && hookGroups.length > 0 && (
                  <div>• {hookGroups.length} HOOK merges</div>
                )}
              </div>
            </div>
          )}

          {/* Countdown */}
          {countdown !== undefined && countdown > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-yellow-900 font-semibold">⏳ FFmpeg Rate Limit</span>
                <span className="text-2xl font-bold text-yellow-900">{countdown}s</span>
              </div>
              <div className="mt-2 bg-yellow-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-yellow-600 h-full transition-all duration-1000"
                  style={{ width: `${(countdown / 60) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* BODY Section */}
          {bodyInfo && (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-purple-100 px-4 py-3 border-b border-gray-300">
                <h3 className="font-semibold text-purple-900">
                  📺 BODY ({bodyInfo.totalVideos} videos → 1 merged video)
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Chunks Progress */}
                {bodyInfo.totalChunks > 1 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                      Chunks: {bodyInfo.currentChunk}/{bodyInfo.totalChunks}
                    </div>
                    {bodyInfo.chunkResults.map((chunk) => (
                      <div
                        key={chunk.chunkNum}
                        className={`flex items-center justify-between p-2 rounded ${
                          chunk.status === 'success'
                            ? 'bg-green-50 text-green-900'
                            : 'bg-red-50 text-red-900'
                        }`}
                      >
                        <span className="text-sm">
                          {chunk.status === 'success' ? '✅' : '❌'} Chunk {chunk.chunkNum}
                        </span>
                        {chunk.error && (
                          <span className="text-xs text-red-600">{chunk.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Final Status */}
                <div
                  className={`p-3 rounded-lg ${
                    bodyInfo.status === 'success'
                      ? 'bg-green-100 text-green-900'
                      : bodyInfo.status === 'failed'
                      ? 'bg-red-100 text-red-900'
                      : bodyInfo.status === 'processing'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="font-semibold">
                    {bodyInfo.status === 'success' && '✅ BODY COMPLETE'}
                    {bodyInfo.status === 'failed' && '❌ BODY FAILED'}
                    {bodyInfo.status === 'processing' && '⏳ Processing...'}
                    {bodyInfo.status === 'pending' && '⏸️ Pending...'}
                  </div>
                  {bodyInfo.finalUrl && (
                    <div className="text-xs mt-1 truncate">{bodyInfo.finalUrl}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* HOOKS Section */}
          {hookGroups && hookGroups.length > 0 && (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-orange-100 px-4 py-3 border-b border-gray-300">
                <h3 className="font-semibold text-orange-900">
                  🎣 HOOKS ({hookGroups.length} groups)
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {hookGroups.map((group, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 ${
                      group.status === 'success'
                        ? 'border-green-300 bg-green-50'
                        : group.status === 'failed'
                        ? 'border-red-300 bg-red-50'
                        : group.status === 'processing'
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-gray-900">
                        {group.status === 'success' && '✅'}
                        {group.status === 'failed' && '❌'}
                        {group.status === 'processing' && '⏳'}
                        {group.status === 'pending' && '⏸️'}
                        {' '}
                        {group.baseName} ({group.videoCount} videos)
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      Videos: {group.videoNames.join(', ')}
                    </div>
                    {group.cdnUrl && (
                      <div className="text-xs text-green-700 truncate">
                        URL: {group.cdnUrl}
                      </div>
                    )}
                    {group.error && (
                      <div className="text-xs text-red-700 mt-1">
                        Error: {group.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Items */}
          {hasFailures && (
            <div className="border border-red-300 rounded-lg overflow-hidden bg-red-50">
              <div className="bg-red-100 px-4 py-3 border-b border-red-300">
                <h3 className="font-semibold text-red-900">
                  ❌ Failed Items ({failedItems?.length})
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {failedItems?.map((item, idx) => (
                  <div key={idx} className="bg-white border border-red-200 rounded p-3">
                    <div className="font-semibold text-red-900">
                      {item.type === 'body_chunk' && '📦 Body Chunk'}
                      {item.type === 'body_final' && '📺 Body Final'}
                      {item.type === 'hook' && '🎣 Hook'}
                      {': '}
                      {item.name}
                    </div>
                    <div className="text-sm text-red-700 mt-1">{item.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          {isComplete && hasFailures && onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
            >
              🔄 Retry {failedItems?.length} Failed Items
            </button>
          )}
          {isComplete && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              {hasFailures ? 'Close' : 'Continue'}
            </button>
          )}
          {!isComplete && (
            <div className="text-gray-600 text-sm">Processing...</div>
          )}
        </div>
      </div>
    </div>
  );
}
