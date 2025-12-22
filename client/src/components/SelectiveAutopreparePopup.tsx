import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';

interface VideoResult {
  videoName: string;
  audioUrl?: string;
  [key: string]: any;
}

interface SelectiveAutopreparePopupProps {
  open: boolean;
  onClose: () => void;
  videoResults: VideoResult[];
  onConfirm: (selectedVideoNames: string[]) => void;
}

export const SelectiveAutopreparePopup: React.FC<SelectiveAutopreparePopupProps> = ({
  open,
  onClose,
  videoResults,
  onConfirm,
}) => {
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [enableReprocessing, setEnableReprocessing] = useState(false);

  // Separate videos into processed and unprocessed
  const unprocessedVideos = videoResults.filter(v => !v.audioUrl);
  const processedVideos = videoResults.filter(v => v.audioUrl);

  // Reset selections when popup opens
  useEffect(() => {
    if (open) {
      // By default, select all unprocessed videos
      setSelectedVideos(unprocessedVideos.map(v => v.videoName));
      setEnableReprocessing(false);
    }
  }, [open]);

  const handleSelectAll = () => {
    const allVideos = [...unprocessedVideos, ...(enableReprocessing ? processedVideos : [])];
    setSelectedVideos(allVideos.map(v => v.videoName));
  };

  const handleDeselectAll = () => {
    setSelectedVideos([]);
  };

  const handleToggleVideo = (videoName: string, checked: boolean) => {
    if (checked) {
      setSelectedVideos([...selectedVideos, videoName]);
    } else {
      setSelectedVideos(selectedVideos.filter(v => v !== videoName));
    }
  };

  const handleConfirm = () => {
    if (selectedVideos.length === 0) {
      return; // Nothing selected
    }
    onConfirm(selectedVideos);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-green-900">
            Select Videos to Process
          </DialogTitle>
          <DialogDescription>
            Some videos have already been processed. Select which ones you want to process or re-process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Select All / Deselect All Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSelectAll}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Select All
            </Button>
            <Button
              onClick={handleDeselectAll}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Deselect All
            </Button>
          </div>

          {/* Unprocessed Videos Section */}
          {unprocessedVideos.length > 0 && (
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <h3 className="font-semibold text-green-900 mb-3">
                Unprocessed Videos ({unprocessedVideos.length})
              </h3>
              <p className="text-xs text-green-700 mb-3">
                These videos don't have audio processing yet (no audioUrl)
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unprocessedVideos.map((video) => {
                  const isSelected = selectedVideos.includes(video.videoName);
                  return (
                    <div key={video.videoName} className="flex items-center space-x-3">
                      <Checkbox
                        id={`unprocessed-${video.videoName}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleVideo(video.videoName, checked as boolean)}
                      />
                      <label
                        htmlFor={`unprocessed-${video.videoName}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {video.videoName}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Processed Videos Section */}
          {processedVideos.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">
                  Processed Videos ({processedVideos.length})
                </h3>
                <Button
                  onClick={() => {
                    setEnableReprocessing(!enableReprocessing);
                    if (enableReprocessing) {
                      // Remove all processed videos from selection when disabling
                      setSelectedVideos(selectedVideos.filter(name => 
                        unprocessedVideos.some(v => v.videoName === name)
                      ));
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className={enableReprocessing ? 'bg-orange-100 border-orange-300' : ''}
                >
                  {enableReprocessing ? '🔓 Enabled' : '🔒 Enable Reprocessing'}
                </Button>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                These videos already have audio processing (have audioUrl). Enable reprocessing to select them.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {processedVideos.map((video) => {
                  const isSelected = selectedVideos.includes(video.videoName);
                  const isDisabled = !enableReprocessing;
                  return (
                    <div key={video.videoName} className="flex items-center space-x-3">
                      <Checkbox
                        id={`processed-${video.videoName}`}
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={(checked) => handleToggleVideo(video.videoName, checked as boolean)}
                      />
                      <label
                        htmlFor={`processed-${video.videoName}`}
                        className={`text-sm font-medium leading-none ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {video.videoName}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Selected:</span>{' '}
              {selectedVideos.length} video{selectedVideos.length !== 1 ? 's' : ''}
              {selectedVideos.length === 0 ? ' (None)' : ''}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {selectedVideos.filter(name => unprocessedVideos.some(v => v.videoName === name)).length} unprocessed, {' '}
              {selectedVideos.filter(name => processedVideos.some(v => v.videoName === name)).length} reprocessing
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedVideos.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Confirm & Process ({selectedVideos.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
