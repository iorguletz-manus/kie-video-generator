import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { id: number; username: string; profileImageUrl: string | null };
  onProfileUpdated: (user: { id: number; username: string; profileImageUrl: string | null }) => void;
}

export default function EditProfileModal({ isOpen, onClose, currentUser, onProfileUpdated }: EditProfileModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(currentUser.profileImageUrl);

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
        toast.error('Password-urile nu coincid!');
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
            });

            if (updateResult.success && updateResult.user) {
              toast.success('Profil actualizat!');
              onProfileUpdated(updateResult.user);
              onClose();
            }
          } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Eroare la upload imagine!');
          }
        };
        reader.readAsDataURL(profileImage);
      } else {
        // Update only password
        const updateResult = await updateProfileMutation.mutateAsync({
          userId: currentUser.id,
          password: newPassword || undefined,
        });

        if (updateResult.success && updateResult.user) {
          toast.success('Profil actualizat!');
          onProfileUpdated(updateResult.user);
          onClose();
        }
      }
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error.message || 'Eroare la actualizare profil!');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-900">Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Image */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              Poză Profil
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
              Password Nou (opțional)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Lasă gol pentru a păstra password-ul actual"
            />
          </div>

          {/* Confirm Password */}
          {newPassword && (
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Confirmă Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirmă password-ul nou"
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={updateProfileMutation.isPending || uploadImageMutation.isPending}
            >
              {updateProfileMutation.isPending || uploadImageMutation.isPending
                ? 'Se salvează...'
                : 'Salvează'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Anulează
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
