import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronLeft, Upload, Edit2, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";

interface ImagesLibraryPageProps {
  currentUser: {
    id: number;
    username: string;
    profileImageUrl?: string | null;
  };
}

export default function ImagesLibraryPage({ currentUser }: ImagesLibraryPageProps) {
  const [, setLocation] = useLocation();
  
  // Safety check: if currentUser is null, show loading
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="text-purple-900 text-xl">Loading...</div>
      </div>
    );
  }
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all");
  const [uploadCharacterSelection, setUploadCharacterSelection] = useState<string>("No Character");
  const [newCharacterName, setNewCharacterName] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editImageName, setEditImageName] = useState("");
  const [draggedImageId, setDraggedImageId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: allImages = [], refetch } = trpc.imageLibrary.list.useQuery({
    userId: currentUser.id,
  });

  const { data: characters = [] } = trpc.imageLibrary.getCharacters.useQuery({
    userId: currentUser.id,
  });

  // Mutations
  const uploadMutation = trpc.imageLibrary.upload.useMutation();
  const updateMutation = trpc.imageLibrary.updateName.useMutation({
    onSuccess: () => {
      refetch();
      setEditingImageId(null);
      toast.success("Image updated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to update image: ${error.message}`);
    },
  });

  const deleteMutation = trpc.imageLibrary.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Image deleted successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to delete image: ${error.message}`);
    },
  });

  // Filter images by character
  const filteredImages =
    selectedCharacter === "all"
      ? allImages
      : allImages.filter((img) => img.characterName === selectedCharacter);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadingFiles(files);
      handleBulkUpload(files);
    }
  };

  const handleBulkUpload = async (files: File[]) => {
    // Validate new character name for duplicates before starting upload
    if (uploadCharacterSelection === "__new__") {
      const trimmedName = (newCharacterName || "").trim();
      if (trimmedName && trimmedName !== "No Character") {
        const isDuplicate = characters.some(char => char.toLowerCase() === trimmedName.toLowerCase());
        if (isDuplicate) {
          toast.error(`Character "${trimmedName}" already exists!`);
          return;
        }
      }
    }

    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      await new Promise<void>((resolve) => {
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;

          try {
            // Determine final character name based on selection
            let finalCharacterName: string;
            if (uploadCharacterSelection === "__new__") {
              // New character: use input value or fallback to "No Character"
              finalCharacterName = (newCharacterName || "").trim() || "No Character";
            } else {
              // Existing character or "No Character"
              finalCharacterName = uploadCharacterSelection;
            }
            
            await uploadMutation.mutateAsync({
              userId: currentUser.id,
              characterName: finalCharacterName,
              imageName: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
              imageData: base64,
            });
          } catch (error) {
            console.error("Upload failed:", error);
          }

          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
          resolve();
        };

        reader.readAsDataURL(file);
      });
    }

    refetch();
    setUploadingFiles([]);
    setUploadProgress(0);
    toast.success(`Uploaded ${files.length} images!`);
  };

  const handleEditName = (imageId: number) => {
    const image = allImages.find((img) => img.id === imageId);
    if (!image) return;

    setEditingImageId(imageId);
    setEditImageName(image.imageName);
  };

  const handleUpdateName = () => {
    if (!editingImageId || !editImageName.trim()) return;

    updateMutation.mutate({
      id: editingImageId,
      imageName: editImageName,
    });
  };

  const handleDelete = (imageId: number) => {
    const image = allImages.find((img) => img.id === imageId);
    if (!image) return;

    const confirmed = confirm(`Delete image "${image.imageName}"?`);
    if (!confirmed) return;

    deleteMutation.mutate({ id: imageId });
  };

  // Drag & Drop handlers
  const handleDragStart = (imageId: number) => {
    setDraggedImageId(imageId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetCharacter: string) => {
    if (!draggedImageId) return;

    const image = allImages.find((img) => img.id === draggedImageId);
    if (!image || image.characterName === targetCharacter) {
      setDraggedImageId(null);
      return;
    }

    updateMutation.mutate({
      id: draggedImageId,
      characterName: targetCharacter,
    });

    setDraggedImageId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-3 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-purple-900 mb-2">
                Images Library
              </h1>
              <p className="text-sm md:text-base text-purple-700">
                Manage your character images and avatars
              </p>
            </div>

            <div className="flex gap-3">
              {/* Character Filter */}
              <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Characters</SelectItem>
                  {characters
                    .filter((char) => char && char.trim() !== "") // Filter empty strings
                    .map((char) => (
                      <SelectItem key={char} value={char}>
                        {char}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Upload Section */}
          <Card className="border-2 border-purple-300 bg-purple-50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Character</Label>
                    <Select value={uploadCharacterSelection} onValueChange={setUploadCharacterSelection}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No Character">No Character</SelectItem>
                        {characters
                          .filter((char) => char && char.trim() !== "" && char !== "No Character")
                          .map((char) => (
                            <SelectItem key={char} value={char}>
                              {char}
                            </SelectItem>
                          ))}
                        <SelectItem value="__new__">+ New Character</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {uploadCharacterSelection === "__new__" && (
                    <div>
                      <Label>New Character Name</Label>
                      <Input
                        placeholder="e.g., Alina, Maria"
                        value={newCharacterName}
                        onChange={(e) => setNewCharacterName(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="flex items-end">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFiles.length > 0}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {uploadingFiles.length > 0 ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading... {uploadProgress}%
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Images
                        </>
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {uploadingFiles.length > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Character Sections with Drag & Drop */}
        {selectedCharacter === "all" ? (
          <div className="space-y-8">
            {characters.map((character) => {
              const characterImages = allImages.filter(
                (img) => img.characterName === character
              );

              return (
                <div
                  key={character}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(character)}
                  className={`border-2 rounded-lg p-6 transition-all ${
                    draggedImageId
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <h2 className="text-2xl font-bold text-purple-900 mb-4">
                    {character}
                    <span className="text-sm text-purple-600 ml-2">
                      ({characterImages.length} images)
                    </span>
                  </h2>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                    {characterImages.map((image) => (
                      <div
                        key={image.id}
                        draggable
                        onDragStart={() => handleDragStart(image.id)}
                        className="relative cursor-move"
                      >
                        {/* Image Thumbnail */}
                        <div className="relative aspect-[9/16] bg-gray-100 rounded overflow-hidden">
                          <img
                            src={image.imageUrl}
                            alt={image.imageName}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Image name and icons below */}
                        {editingImageId === image.id ? (
                          <div className="mt-1 space-y-1">
                            <Input
                              value={editImageName}
                              onChange={(e) => setEditImageName(e.target.value)}
                              className="text-xs h-6 px-1"
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={handleUpdateName}
                                className="flex-1 h-6 text-xs bg-green-600 hover:bg-green-700"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingImageId(null)}
                                className="flex-1 h-6 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <p className="text-xs text-purple-900 truncate flex-1">
                              {image.imageName}
                            </p>
                            <div className="flex gap-0.5 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditName(image.id)}
                                className="w-5 h-5 p-0 hover:bg-blue-100"
                              >
                                <Edit2 className="w-3 h-3 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(image.id)}
                                className="w-5 h-5 p-0 hover:bg-red-100"
                              >
                                <Trash2 className="w-3 h-3 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Single Character View
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
            {filteredImages.map((image) => (
              <div
                key={image.id}
                className="relative"
              >
                {/* Image Thumbnail */}
                <div className="relative aspect-[9/16] bg-gray-100 rounded overflow-hidden">
                  <img
                    src={image.imageUrl}
                    alt={image.imageName}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Image name and icons below */}
                {editingImageId === image.id ? (
                  <div className="mt-1 space-y-1">
                    <Input
                      value={editImageName}
                      onChange={(e) => setEditImageName(e.target.value)}
                      className="text-xs h-6 px-1"
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={handleUpdateName}
                        className="flex-1 h-6 text-xs bg-green-600 hover:bg-green-700"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingImageId(null)}
                        className="flex-1 h-6 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <p className="text-xs text-purple-900 truncate flex-1">
                      {image.imageName}
                    </p>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditName(image.id)}
                        className="w-5 h-5 p-0 hover:bg-blue-100"
                      >
                        <Edit2 className="w-3 h-3 text-blue-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(image.id)}
                        className="w-5 h-5 p-0 hover:bg-red-100"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredImages.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No images yet. Upload your first image!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
