import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface RegenerateVideoConfirmModalProps {
  isOpen: boolean;
  videoName: string;
  isHook: boolean;
  hasProcessingData: boolean;
  mergedVideoName: string | null; // HOOKXM or null
  finalVideosCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RegenerateVideoConfirmModal({
  isOpen,
  videoName,
  isHook,
  hasProcessingData,
  mergedVideoName,
  finalVideosCount,
  onConfirm,
  onCancel,
}: RegenerateVideoConfirmModalProps) {
  if (!isOpen) return null;

  // Determine which bullet points to show
  const showProcessingData = hasProcessingData;
  const showMergedVideo = mergedVideoName !== null;
  const showFinalVideos = finalVideosCount > 0;
  const showRemergeNote = showMergedVideo || showFinalVideos;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow-2xl max-w-md w-full border-2 border-orange-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-lg flex items-center gap-3">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="text-lg font-bold">Warning: Regenerate Video</h3>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-800 font-medium">
            Regenerating <span className="font-bold text-orange-700">{videoName}</span> will delete:
          </p>

          <ul className="space-y-2 text-sm text-gray-700">
            {showProcessingData && (
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold mt-0.5">•</span>
                <span>All processing data for this video (audio, markers, trimmed video)</span>
              </li>
            )}

            {showMergedVideo && (
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold mt-0.5">•</span>
                <span>
                  {isHook ? (
                    <>Merged HOOK video: <span className="font-semibold">{mergedVideoName}</span> in Step 10</>
                  ) : (
                    <>BODY merged video in Step 10</>
                  )}
                </span>
              </li>
            )}

            {showFinalVideos && (
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold mt-0.5">•</span>
                <span>
                  {isHook ? (
                    <>Final video in Step 11 that uses {videoName}</>
                  ) : (
                    <>ALL final videos in Step 11 ({finalVideosCount} {finalVideosCount === 1 ? 'video' : 'videos'}) - they all use the merged body</>
                  )}
                </span>
              </li>
            )}
          </ul>

          {showRemergeNote && (
            <p className="text-sm text-gray-600 italic mt-4">
              {isHook ? 'These videos' : 'All final videos'} will need to be re-merged and re-processed.
            </p>
          )}

          <p className="text-gray-800 font-medium mt-6">
            Are you sure you want to regenerate this video?
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-orange-100/50 rounded-b-lg flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-gray-400 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            Yes, Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
