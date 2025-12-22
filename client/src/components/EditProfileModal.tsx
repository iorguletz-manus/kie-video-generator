import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { id: number; username: string; profileImageUrl: string | null; kieApiKey: string | null; openaiApiKey: string | null; ffmpegApiKey: string | null; cleanvoiceApiKey: string | null; ffmpegBatchSize: number };
  onProfileUpdated: (user: { id: number; username: string; profileImageUrl: string | null; kieApiKey: string | null; openaiApiKey: string | null; ffmpegApiKey: string | null; cleanvoiceApiKey: string | null; ffmpegBatchSize: number }) => void;
}

export default function EditProfileModal({ isOpen, onClose, currentUser, onProfileUpdated }: EditProfileModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(currentUser.profileImageUrl);
  const [kieApiKey, setKieApiKey] = useState(currentUser.kieApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(currentUser.openaiApiKey || '');
  const [ffmpegApiKey, setFfmpegApiKey] = useState(currentUser.ffmpegApiKey || '');
  const [cleanvoiceApiKey, setCleanvoiceApiKey] = useState(currentUser.cleanvoiceApiKey || '');
  const [ffmpegBatchSize, setFfmpegBatchSize] = useState(currentUser.ffmpegBatchSize || 15);

  const updateProfileMutation = trpc.appAuth.updateProfile.useMutation();
  const uploadImageMutation = trpc.video.uploadImage.useMutation();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      
      // Preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      // Validate password
      if (newPassword && newPassword !== confirmPassword) {
        toast.error('Passwords do not match!');
        return;
      }

      let profileImageUrl = currentUser.profileImageUrl;

      // Upload profile image if changed
      if (profileImage) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const base64 = event.target?.result as string;
            const result = await uploadImageMutation.mutateAsync({
              imageData: base64,
              fileName: profileImage.name,
              userId: currentUser.id,
              sessionId: 'profile', // Special folder for profile images
            });

            profileImageUrl = result.imageUrl;

            // Update profile in database
            const updateResult = await updateProfileMutation.mutateAsync({
              userId: currentUser.id,
              password: newPassword || undefined,
              profileImageUrl: profileImageUrl || undefined,
              kieApiKey: kieApiKey || undefined,
              openaiApiKey: openaiApiKey || undefined,
              ffmpegApiKey: ffmpegApiKey || undefined,
              cleanvoiceApiKey: cleanvoiceApiKey || undefined,
              ffmpegBatchSize: ffmpegBatchSize,
            });

            if (updateResult.success && updateResult.user) {
              toast.success('Profile updated!');
              onProfileUpdated(updateResult.user);
              onClose();
            }
          } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Error uploading image!');
          }
        };
        reader.readAsDataURL(profileImage);
      } else {
        // Update password and/or API key
        const updateResult = await updateProfileMutation.mutateAsync({
          userId: currentUser.id,
          password: newPassword || undefined,
          kieApiKey: kieApiKey || undefined,
          openaiApiKey: openaiApiKey || undefined,
          ffmpegApiKey: ffmpegApiKey || undefined,
          cleanvoiceApiKey: cleanvoiceApiKey || undefined,
          ffmpegBatchSize: ffmpegBatchSize,
        });

        if (updateResult.success && updateResult.user) {
          toast.success('Profile updated!');
          onProfileUpdated(updateResult.user);
          onClose();
        }
      }
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error.message || 'Error updating profile!');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-900">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Image */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              Profile Picture
            </label>
            <div className="flex items-center gap-4">
              {profileImagePreview && (
                <img
                  src={profileImagePreview}
                  alt="Profile Preview"
                  className="w-20 h-20 rounded-full border-2 border-blue-300 object-cover"
                />
              )}
              {!profileImagePreview && (
                <div className="w-20 h-20 rounded-full border-2 border-blue-300 bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-900 font-bold text-2xl">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="flex-1 text-sm text-blue-900"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              New Password (optional)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leave empty to keep current password"
            />
          </div>

          {/* Confirm Password */}
          {newPassword && (
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm new password"
              />
            </div>
          )}

          {/* Kie API Key */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              Kie API Key
            </label>
            <input
              type="text"
              value={kieApiKey}
              onChange={(e) => setKieApiKey(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your API key from kie.ai"
            />
          </div>

          {/* OpenAI API Key */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              OpenAI API Key
            </label>
            <input
              type="text"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your API key from OpenAI"
            />
          </div>

          {/* FFMPEG API Key */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              FFMPEG API Key
            </label>
            <input
              type="text"
              value={ffmpegApiKey}
              onChange={(e) => setFfmpegApiKey(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your API key from FFMPEG API"
            />
          </div>

          {/* FFmpeg Batch Size */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              FFmpeg Batch Size
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={ffmpegBatchSize}
              onChange={(e) => setFfmpegBatchSize(parseInt(e.target.value) || 15)}
              className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Default: 15"
            />
            <p className="text-xs text-gray-600 mt-1">
              Number of videos to process simultaneously (default: 15)
            </p>
          </div>

          {/* CleanVoice API Key */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              CleanVoice API Key
            </label>
            <input
              type="text"
              value={cleanvoiceApiKey}
              onChange={(e) => setCleanvoiceApiKey(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your API key from CleanVoice"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={updateProfileMutation.isPending || uploadImageMutation.isPending}
            >
              {updateProfileMutation.isPending || uploadImageMutation.isPending
                ? 'Saving...'
                : 'Save'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
