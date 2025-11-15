import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, X, Edit2, Trash2, Search, User, Image as ImageIcon } from "lucide-react";

interface ImagesLibraryModalProps {
  open: boolean;
  onClose: () => void;
  userId: number;
}

export function ImagesLibraryModal({ open, onClose, userId }: ImagesLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editingImageName, setEditingImageName] = useState("");
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);

  // Queries
  const { data: images = [], refetch: refetchImages } = trpc.imageLibrary.list.useQuery({
    userId,
    characterName: selectedCharacter || undefined,
  });

  const { data: characters = [], refetch: refetchCharacters } = trpc.imageLibrary.getCharacters.useQuery({
    userId,
  });

  // Mutations
  const uploadMutation = trpc.imageLibrary.upload.useMutation({
    onSuccess: () => {
      refetchImages();
      refetchCharacters();
      toast.success("Image uploaded successfully!");
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const updateNameMutation = trpc.imageLibrary.updateName.useMutation({
    onSuccess: () => {
      refetchImages();
      refetchCharacters();
      setEditingImageId(null);
      toast.success("Image name updated!");
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  const deleteMutation = trpc.imageLibrary.delete.useMutation({
    onSuccess: () => {
      refetchImages();
      refetchCharacters();
      toast.success("Image deleted!");
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
  
  const batchDeleteMutation = trpc.imageLibrary.batchDelete.useMutation({
    onSuccess: (data) => {
      refetchImages();
      refetchCharacters();
      setSelectedImageIds([]);
      toast.success(`${data.count} image(s) deleted!`);
    },
    onError: (error) => {
      toast.error(`Batch delete failed: ${error.message}`);
    },
  });

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploadingFiles(files);
    }
  }, []);

  // Handle bulk upload
  const handleBulkUpload = useCallback(async () => {
    if (uploadingFiles.length === 0) return;

    const characterName = selectedCharacter || newCharacterName || "Unnamed";
    
    setUploadProgress(0);
    
    for (let i = 0; i < uploadingFiles.length; i++) {
      const file = uploadingFiles[i];
      
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      const imageData = await base64Promise;
      
      // Upload
      await uploadMutation.mutateAsync({
        userId,
        characterName,
        imageName: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        imageData,
      });
      
      // Update progress
      setUploadProgress(Math.round(((i + 1) / uploadingFiles.length) * 100));
    }
    
    setUploadingFiles([]);
    setNewCharacterName("");
    setIsCreatingCharacter(false);
    toast.success(`${uploadingFiles.length} images uploaded!`);
  }, [uploadingFiles, selectedCharacter, newCharacterName, userId, uploadMutation]);

  // Filtered images based on search
  const filteredImages = images.filter((img) => {
    const query = searchQuery.toLowerCase();
    return (
      img.imageName.toLowerCase().includes(query) ||
      img.characterName.toLowerCase().includes(query)
    );
  });

  // Group images by character for Characters tab
  const imagesByCharacter = characters.reduce((acc, char) => {
    acc[char] = images.filter((img) => img.characterName === char);
    return acc;
  }, {} as Record<string, typeof images>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Images Library
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All Images</TabsTrigger>
            <TabsTrigger value="characters">Characters</TabsTrigger>
          </TabsList>

          {/* All Images Tab */}
          <TabsContent value="all" className="space-y-4">
            {/* Batch Actions Toolbar */}
            {selectedImageIds.length > 0 && (
              <div className="p-3 bg-blue-50 border-2 border-blue-300 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-blue-900">
                    {selectedImageIds.length} image(s) selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedImageIds([])}
                    className="text-xs"
                  >
                    Deselect All
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Delete ${selectedImageIds.length} selected image(s)?`)) {
                      batchDeleteMutation.mutate({ ids: selectedImageIds });
                    }
                  }}
                  disabled={batchDeleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
            
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search images by name or character..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {filteredImages.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selectedImageIds.length === filteredImages.length) {
                      setSelectedImageIds([]);
                    } else {
                      setSelectedImageIds(filteredImages.map(img => img.id));
                    }
                  }}
                  className="text-xs"
                >
                  {selectedImageIds.length === filteredImages.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
              <Button
                onClick={() => setIsCreatingCharacter(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Images
              </Button>
            </div>

            {/* Upload Section */}
            {isCreatingCharacter && (
              <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-3">
                <div className="space-y-2">
                  <Label>Character Name (optional)</Label>
                  <Input
                    placeholder="e.g., Alina, John, or leave empty for 'Unnamed'"
                    value={newCharacterName}
                    onChange={(e) => setNewCharacterName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Select Images</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                  />
                  {uploadingFiles.length > 0 && (
                    <p className="text-sm text-gray-600">
                      {uploadingFiles.length} file(s) selected
                    </p>
                  )}
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 text-center">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleBulkUpload}
                    disabled={uploadingFiles.length === 0 || uploadMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Upload {uploadingFiles.length} Image(s)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreatingCharacter(false);
                      setUploadingFiles([]);
                      setNewCharacterName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Images Grid */}
            {filteredImages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No images yet. Upload your first image!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {filteredImages.map((img) => (
                  <div
                    key={img.id}
                    className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIds.includes(img.id)
                        ? 'border-blue-500 ring-2 ring-blue-300'
                        : 'border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedImageIds.includes(img.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (selectedImageIds.includes(img.id)) {
                            setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                          } else {
                            setSelectedImageIds(prev => [...prev, img.id]);
                          }
                        }}
                        className="w-5 h-5 cursor-pointer accent-blue-600"
                      />
                    </div>
                    
                    <img
                      src={img.imageUrl}
                      alt={img.imageName}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      {editingImageId === img.id ? (
                        <div className="w-full space-y-2">
                          <Input
                            value={editingImageName}
                            onChange={(e) => setEditingImageName(e.target.value)}
                            className="text-xs"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => {
                                updateNameMutation.mutate({
                                  id: img.id,
                                  imageName: editingImageName,
                                });
                              }}
                              className="flex-1 text-xs"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingImageId(null)}
                              className="flex-1 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-white text-xs font-bold text-center truncate w-full">
                            {img.imageName}
                          </p>
                          <p className="text-blue-300 text-xs text-center truncate w-full">
                            {img.characterName}
                          </p>
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingImageId(img.id);
                                setEditingImageName(img.imageName);
                              }}
                              className="bg-white/20 hover:bg-white/30 border-white/50"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm("Delete this image?")) {
                                  deleteMutation.mutate({ id: img.id });
                                }
                              }}
                              className="bg-red-500/80 hover:bg-red-600 border-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Characters Tab */}
          <TabsContent value="characters" className="space-y-4">
            {characters.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No characters yet. Create your first character!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {characters.map((char) => (
                  <div key={char} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <h3 className="font-bold text-lg">{char}</h3>
                      <span className="text-sm text-gray-500">
                        ({imagesByCharacter[char]?.length || 0} images)
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                      {imagesByCharacter[char]?.map((img) => (
                        <div
                          key={img.id}
                          className="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-all"
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.imageName}
                            className="w-full h-full object-cover"
                          />
                          
                          {/* Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-white text-xs font-bold text-center px-2">
                              {img.imageName}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
