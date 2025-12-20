import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { Loader2 } from 'lucide-react';

interface DownloadZipProgressModalProps {
  open: boolean;
  total: number;
  current: number;
  status: 'downloading' | 'generating' | 'complete';
  message: string;
}

export function DownloadZipProgressModal({
  open,
  total,
  current,
  status,
  message
}: DownloadZipProgressModalProps) {
  // Calculate progress percentage
  const progressPercent = total > 0 ? (current / total) * 100 : 0;
  
  const isProcessing = status === 'downloading' || status === 'generating';

  return (
    <Dialog open={open} onOpenChange={() => {}} >
      <DialogContent className="max-w-md w-[95vw] sm:w-full" onInteractOutside={(e) => {
        if (isProcessing) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-green-600" />}
            📦 Downloading Videos
          </DialogTitle>
          <DialogDescription>
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Main Progress Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">📥 Videos</p>
              <p className="text-sm font-medium text-gray-600">{current}/{total}</p>
            </div>
            <Progress value={progressPercent} className="h-3 bg-green-100" />
            
            {/* Status Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                {status === 'downloading' && `⏳ Downloading ${current}/${total} videos...`}
                {status === 'generating' && '📦 Generating ZIP file...'}
                {status === 'complete' && '✅ Download complete!'}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DownloadZipProgressModal;
