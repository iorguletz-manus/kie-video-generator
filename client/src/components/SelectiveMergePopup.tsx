import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';

interface SelectiveMergePopupProps {
  open: boolean;
  onClose: () => void;
  hookMergedVideos: Record<string, string>;
  bodyMergedVideoUrl: string | null;
  allHookGroups?: Record<string, number>; // All hook groups with video count (including single videos)
  onConfirm: (selectedHooks: string[], selectedBody: boolean) => void;
}

export const SelectiveMergePopup: React.FC<SelectiveMergePopupProps> = ({
  open,
  onClose,
  hookMergedVideos,
  bodyMergedVideoUrl,
  allHookGroups,
  onConfirm,
}) => {
  const [selectedHooks, setSelectedHooks] = useState<string[]>([]);
  const [selectedBody, setSelectedBody] = useState(false);

  // Reset selections when popup opens
  useEffect(() => {
    if (open) {
      setSelectedHooks([]);
      setSelectedBody(false);
    }
  }, [open]);

  // Get ALREADY merged hooks (from hookMergedVideos) - remove 'M' suffix for display
  const mergedHookNames = hookMergedVideos ? Object.keys(hookMergedVideos).map(name => name.replace(/M$/, '')) : [];
  
  // Get NEW hooks that NEED merging (from allHookGroups with count > 1)
  const newHooksToMerge = allHookGroups
    ? Object.entries(allHookGroups)
        .filter(([hookName, count]) => count > 1 && !mergedHookNames.includes(hookName))
        .map(([hookName]) => hookName)
    : [];
  
  // Combine BOTH and remove duplicates using Set
  const allHooksSet = new Set([...mergedHookNames, ...newHooksToMerge]);
  const allHooksToShow = Array.from(allHooksSet).sort((a, b) => {
    // Extract HOOK number from names
    const hookNumA = a.match(/HOOK(\d+)/)?.[1];
    const hookNumB = b.match(/HOOK(\d+)/)?.[1];
    
    if (hookNumA && hookNumB) {
      return parseInt(hookNumA) - parseInt(hookNumB);
    }
    
    // Fallback to alphabetical
    return a.localeCompare(b);
  });
  
  const hookNames = allHooksToShow;
  const hasBody = bodyMergedVideoUrl !== null;

  // Calculate hooks that don't need merge (only 1 video in group)
  const hooksNoMerge = allHookGroups 
    ? Object.entries(allHookGroups)
        .filter(([hookName, count]) => count === 1)
        .map(([hookName]) => hookName)
    : [];

  const handleSelectAll = () => {
    setSelectedHooks(hookNames);
    setSelectedBody(hasBody);
  };

  const handleDeselectAll = () => {
    setSelectedHooks([]);
    setSelectedBody(false);
  };

  const handleConfirm = () => {
    if (selectedHooks.length === 0 && !selectedBody) {
      return; // Nothing selected
    }
    onConfirm(selectedHooks, selectedBody);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-purple-900">
            Select Videos to Re-Merge
          </DialogTitle>
          <DialogDescription>
            You already have merged videos in Step 10. Select which ones you want to re-merge.
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

          {/* Body Section */}
          {hasBody && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">Body Video</h3>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="body-checkbox"
                  checked={selectedBody}
                  onCheckedChange={(checked) => setSelectedBody(checked as boolean)}
                />
                <label
                  htmlFor="body-checkbox"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  BODY (Merged)
                </label>
              </div>
            </div>
          )}

          {/* Hooks Section */}
          {hookNames.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">
                Hook Videos ({hookNames.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {hookNames.map((hookName) => {
                  const isSelected = selectedHooks.includes(hookName);
                  return (
                    <div key={hookName} className="flex items-center space-x-3">
                      <Checkbox
                        id={`hook-${hookName}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedHooks([...selectedHooks, hookName]);
                          } else {
                            setSelectedHooks(selectedHooks.filter(h => h !== hookName));
                          }
                        }}
                      />
                      <label
                        htmlFor={`hook-${hookName}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {hookName}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hooks that don't need merge (only 1 video) */}
          {hooksNoMerge.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">
                The following videos don't need merge:
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {hooksNoMerge.map((hookName) => (
                  <div key={hookName} className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700">
                      {hookName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Selected:</span>{' '}
              {selectedBody ? '1 Body' : '0 Body'}
              {selectedBody && selectedHooks.length > 0 ? ', ' : ''}
              {selectedHooks.length > 0 ? `${selectedHooks.length} Hook${selectedHooks.length > 1 ? 's' : ''}` : ''}
              {!selectedBody && selectedHooks.length === 0 ? 'None' : ''}
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
              disabled={selectedHooks.length === 0 && !selectedBody}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Confirm & Re-Merge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
