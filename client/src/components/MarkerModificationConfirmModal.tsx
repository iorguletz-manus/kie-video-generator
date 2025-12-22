import { X } from 'lucide-react';
import { Button } from './ui/button';

interface MarkerModificationConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  videoName: string;
}

export default function MarkerModificationConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  videoName,
}: MarkerModificationConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              ⚠️
            </div>
            <div>
              <h2 className="text-xl font-bold">Modify Markers?</h2>
              <p className="text-sm text-white/90">{videoName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-6">
            <p className="text-gray-800 leading-relaxed">
              Are you sure you want to modify the markers?
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              If you modify them, this video will need to be{' '}
              <span className="font-semibold text-orange-600">re-trimmed using the red button below</span>{' '}
              to appear correctly in Step 10.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              Yes, Modify Markers
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
