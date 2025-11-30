import { useState, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronLeft, Upload, Edit2, Trash2, Image as ImageIcon, Loader2, Grid2x2, Grid3x3, LayoutGrid, Search, ArrowUpDown, CheckSquare, Square, Download, Star } from "lucide-react";
import AppHeader from "@/components/AppHeader";

// Romanian female names for auto-generation
const ROMANIAN_FEMALE_NAMES = [
  'Alina', 'Alexandra', 'Ana', 'Andreea', 'Adriana', 'Anca', 'Antonia',
  'Bianca', 'Camelia', 'Carmen', 'Claudia', 'Cosmina', 'Cristina',
  'Dana', 'Daniela', 'Daria', 'Diana', 'Doina', 'Dora',
  'Elena', 'Eliza', 'Emanuela', 'Emilia', 'Eva',
  'Florentina', 'Florina', 'Gabriela', 'Georgiana', 'Gina',
  'Ileana', 'Ilinca', 'Ioana', 'Ionela', 'Irina', 'Isabella', 'Iulia',
  'Laura', 'Lavinia', 'Larisa', 'Lidia', 'Liliana', 'Loredana', 'Lucia',
  'Madalina', 'Manuela', 'Maria', 'Mariana', 'Mihaela', 'Mirela', 'Monica',
  'Natalia', 'Nicoleta', 'Oana', 'Otilia', 'Paula', 'Petra', 'Raluca',
  'Ramona', 'Roxana', 'Sabina', 'Simona', 'Sofia', 'Stefania',
  'Tamara', 'Teodora', 'Valentina', 'Valeria', 'Vasilica', 'Veronica', 'Victoria'
];

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
  const [uploadCharacterSelection, setUploadCharacterSelection] = useState<string>("__new__");
  const [characterSearchQuery, setCharacterSearchQuery] = useState("");
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newCharacterNameError, setNewCharacterNameError] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editImageName, setEditImageName] = useState("");
  const [draggedImageId, setDraggedImageId] = useState<number | null>(null);
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [dragOverImageId, setDragOverImageId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: allImages = [], refetch } = trpc.imageLibrary.list.useQuery({
    userId: currentUser.id,
  });

  const { data: rawCharacters = [] } = trpc.imageLibrary.getCharacters.useQuery({
    userId: currentUser.id,
  });

  const { data: categoryCharacters = [], refetch: refetchCharacters } = trpc.categoryCharacters.list.useQuery({
    userId: currentUser.id,
  });

  // Get all context sessions to check for generated videos
  const { data: allContextSessions = [] } = trpc.contextSessions.listByUser.useQuery({
    userId: currentUser.id,
  });

  const updateCharacterMutation = trpc.categoryCharacters.update.useMutation();

  // Sort characters by creation date (newest first) - using reverse alphabetical as proxy since we don't have creation date
  const characters = useMemo(() => {
    return [...rawCharacters].sort((a, b) => {
      // Sort by name for now (alphabetical)
      return a.localeCompare(b);
    });
  }, [rawCharacters]);

  // Helper function to check if an image is used in generated videos
  const isImageUsedInGeneratedVideos = useCallback((imageUrl: string) => {
    for (const session of allContextSessions) {
      if (session.videoResults) {
        try {
          const videos = typeof session.videoResults === 'string' 
            ? JSON.parse(session.videoResults) 
            : session.videoResults;
          
          // Check if any video has generated status and uses this image
          const hasGeneratedVideo = Array.isArray(videos) && videos.some(
            (v: any) => {
              const isGenerated = v.status === 'success' || v.status === 'pending' || v.status === 'failed';
              const usesImage = v.imageUrl === imageUrl;
              return isGenerated && usesImage;
            }
          );
          
          if (hasGeneratedVideo) {
            return true;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    return false;
  }, [allContextSessions]);

  // Helper function to get character thumbnail
  const getCharacterThumbnail = useCallback((characterName: string) => {
    const character = categoryCharacters.find(c => c.name === characterName);
    return character?.thumbnailUrl || null;
  }, [categoryCharacters]);

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

  const updateOrderMutation = trpc.imageLibrary.updateOrder.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update order: ${error.message}`);
    },
  });

  const deleteCharacterMutation = trpc.categoryCharacters.delete.useMutation({
    onSuccess: async () => {
      await refetch();
      await refetchCharacters();
    },
  });

  // Filter, search, and sort images
  const filteredImages = useMemo(() => {
    let result = selectedCharacter === "all"
      ? allImages
      : allImages.filter((img) => img.characterName === selectedCharacter);

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter((img) =>
        img.imageName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') {
        const comparison = a.imageName.localeCompare(b.imageName);
        return sortOrder === 'asc' ? comparison : -comparison;
      } else {
        // Sort by date (assuming id is auto-increment, higher id = newer)
        const comparison = a.id - b.id;
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });

    return result;
  }, [allImages, selectedCharacter, searchQuery, sortBy, sortOrder]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      createPreviews(files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragOverUpload = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropUpload = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      createPreviews(files);
    }
  };

  const createPreviews = (files: File[]) => {
    const previews = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setPreviewFiles(previews);
  };

  const removePreview = (index: number) => {
    setPreviewFiles(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  const handleUploadPreviews = () => {
    const files = previewFiles.map(p => p.file);
    setUploadingFiles(files);
    handleBulkUpload(files);
    // Clear previews after upload starts
    previewFiles.forEach(p => URL.revokeObjectURL(p.preview));
    setPreviewFiles([]);
  };

  const toggleImageSelection = (imageId: number) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedImages(new Set(filteredImages.map(img => img.id)));
  };

  const deselectAll = () => {
    setSelectedImages(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedImages.size === 0) return;
    
    if (!confirm(`Delete ${selectedImages.size} selected image(s)?`)) return;

    try {
      for (const imageId of selectedImages) {
        await deleteMutation.mutateAsync({ id: imageId });
      }
      setSelectedImages(new Set());
      setIsSelectionMode(false);
      toast.success(`${selectedImages.size} image(s) deleted successfully!`);
    } catch (error: any) {
      toast.error(`Failed to delete images: ${error.message}`);
    }
  };

  const handleBulkDownload = () => {
    if (selectedImages.size === 0) return;

    selectedImages.forEach(imageId => {
      const image = allImages.find(img => img.id === imageId);
      if (image) {
        const link = document.createElement('a');
        link.href = image.imageUrl;
        link.download = image.imageName;
        link.click();
      }
    });

    toast.success(`Downloading ${selectedImages.size} image(s)...`);
  };

  const handleBulkUpload = async (files: File[]) => {
    // Validate new character name for duplicates before starting upload
    if (uploadCharacterSelection === "__new__") {
      const trimmedName = (newCharacterName || "").trim();
      if (trimmedName && trimmedName !== "No Character") {
        const isDuplicate = characters.some(char => char.toLowerCase() === trimmedName.toLowerCase());
        if (isDuplicate) {
          setNewCharacterNameError(`Character "${trimmedName}" already exists!`);
          toast.error(`Character "${trimmedName}" already exists!`);
          return;
        }
      }
    }
    
    // Prevent upload if there's an error
    if (newCharacterNameError) {
      toast.error('Please fix errors before uploading');
      return;
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
            
            // Auto-rename logic: $Nume_1, $Nume_1_CTA, $Nume_2, etc.
            const originalFileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
            const isCTA = originalFileName.toLowerCase().includes('cta');
            
            // Get existing images for this character
            const existingImages = allImages.filter(img => img.characterName === finalCharacterName);
            
            // Extract existing numbers from image names (e.g., "$Alina_1" -> 1, "$Alina_2_CTA" -> 2)
            const existingNumbers = existingImages
              .map(img => {
                const match = img.imageName.match(/_(\d+)(?:_CTA)?$/);
                return match ? parseInt(match[1]) : 0;
              })
              .filter(n => n > 0);
            
            // Find next available number
            const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
            
            // Generate new image name: $CharacterName_Number or $CharacterName_Number_CTA
            const newImageName = isCTA 
              ? `$${finalCharacterName}_${nextNumber}_CTA`
              : `$${finalCharacterName}_${nextNumber}`;
            
            await uploadMutation.mutateAsync({
              userId: currentUser.id,
              characterName: finalCharacterName,
              imageName: newImageName,
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

  const handleDeleteCharacter = async (characterName: string) => {
    const character = categoryCharacters.find(c => c.name === characterName);
    if (!character) {
      toast.error(`Caracterul "${characterName}" nu a fost găsit.`);
      return;
    }
    
    // Check if character has generated videos in database
    let hasGeneratedVideos = allContextSessions.some(session => {
      if (session.characterId === character.id && session.videoResults) {
        try {
          const videos = typeof session.videoResults === 'string' 
            ? JSON.parse(session.videoResults) 
            : session.videoResults;
            
          return Array.isArray(videos) && videos.some(
            (v: any) => v.status === 'success' || v.status === 'pending' || v.status === 'failed'
          );
        } catch (e) {
          return false;
        }
      }
      return false;
    });

    // Also check localStorage for current session videoResults
    if (!hasGeneratedVideos) {
      try {
        const savedContext = localStorage.getItem('savedContext');
        if (savedContext) {
          const context = JSON.parse(savedContext);
          if (context.characterId === character.id && context.videoResults) {
            const videos = Array.isArray(context.videoResults) 
              ? context.videoResults 
              : JSON.parse(context.videoResults);
            
            hasGeneratedVideos = videos.some(
              (v: any) => v.status === 'success' || v.status === 'pending' || v.status === 'failed'
            );
          }
        }
      } catch (e) {
        console.error('[Delete Character] Error checking localStorage:', e);
      }
    }

    if (hasGeneratedVideos) {
      toast.error(`Nu poți șterge caracterul "${characterName}" pentru că are videouri generate. Șterge mai întâi AD-urile cu videouri.`);
      return;
    }

    const characterImages = allImages.filter(img => img.characterName === characterName);
    const confirmed = confirm(`Ștergi caracterul "${characterName}" și toate cele ${characterImages.length} imagini asociate?`);
    if (!confirmed) return;

    try {
      // Delete all images for this character
      for (const image of characterImages) {
        await deleteMutation.mutateAsync({ id: image.id });
      }

      // Delete the character from categoryCharacters
      const character = categoryCharacters.find(c => c.name === characterName);
      if (character) {
        await deleteCharacterMutation.mutateAsync({ id: character.id });
      }

      await refetch();
      await refetchCharacters();
      toast.success(`Caracterul "${characterName}" și toate imaginile au fost șterse!`);
    } catch (error: any) {
      toast.error(`Eroare la ștergere: ${error.message}`);
    }
  };

  const handleSetThumbnail = async (imageId: number) => {
    const image = allImages.find((img) => img.id === imageId);
    if (!image) return;

    try {
      // Find character by name
      const character = categoryCharacters.find(c => c.name === image.characterName);
      if (!character) {
        toast.error('Character not found!');
        return;
      }

      // Update character thumbnail
      await updateCharacterMutation.mutateAsync({
        id: character.id,
        thumbnailUrl: image.imageUrl,
      });

      await refetchCharacters();
      toast.success(`Thumbnail set for ${image.characterName}!`);
    } catch (error: any) {
      toast.error(`Failed to set thumbnail: ${error.message}`);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (imageId: number) => {
    setDraggedImageId(imageId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragOverImage = (e: React.DragEvent, imageId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverImageId(imageId);
  };

  const handleDragLeaveImage = () => {
    setDragOverImageId(null);
  };

  const handleDropOnImage = (targetImageId: number) => {
    if (!draggedImageId || draggedImageId === targetImageId) {
      setDraggedImageId(null);
      setDragOverImageId(null);
      return;
    }

    // Get current character images
    const draggedImage = allImages.find(img => img.id === draggedImageId);
    const targetImage = allImages.find(img => img.id === targetImageId);

    if (!draggedImage || !targetImage) {
      setDraggedImageId(null);
      setDragOverImageId(null);
      return;
    }

    // Only allow reordering within same character
    if (draggedImage.characterName !== targetImage.characterName) {
      setDraggedImageId(null);
      setDragOverImageId(null);
      return;
    }

    // Get all images for this character
    const characterImages = allImages.filter(
      img => img.characterName === draggedImage.characterName
    );

    // Find indices
    const draggedIndex = characterImages.findIndex(img => img.id === draggedImageId);
    const targetIndex = characterImages.findIndex(img => img.id === targetImageId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedImageId(null);
      setDragOverImageId(null);
      return;
    }

    // Reorder array
    const reordered = [...characterImages];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Update displayOrder for all affected images
    const imageOrders = reordered.map((img, index) => ({
      id: img.id,
      displayOrder: index,
    }));

    updateOrderMutation.mutate({ imageOrders });

    setDraggedImageId(null);
    setDragOverImageId(null);
  };

  const handleDrop = (targetCharacter: string) => {
    // Block moving images between different characters
    if (!draggedImageId) return;

    const image = allImages.find((img) => img.id === draggedImageId);
    if (!image) {
      setDraggedImageId(null);
      return;
    }

    // If trying to move to different character, show error and block
    if (image.characterName !== targetCharacter) {
      toast.error('Nu poți muta imaginile între caractere diferite!');
      setDraggedImageId(null);
      return;
    }

    setDraggedImageId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* App Header */}
      <AppHeader
        currentUser={currentUser}
        onLogout={() => setLocation("/login")}
      />
      
      <div className="max-w-6xl mx-auto p-3 md:p-8">
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

            <div className="flex flex-wrap gap-3">
              {/* Selection Mode Toggle */}
              <Button
                variant={isSelectionMode ? 'default' : 'outline'}
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) {
                    setSelectedImages(new Set());
                  }
                }}
                className={isSelectionMode ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-300'}
              >
                {isSelectionMode ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                Select
              </Button>

              {/* Bulk Actions (show when in selection mode) */}
              {isSelectionMode && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAll}
                    className="border-purple-300"
                  >
                    Select All ({filteredImages.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={deselectAll}
                    className="border-purple-300"
                    disabled={selectedImages.size === 0}
                  >
                    Deselect All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDownload}
                    className="border-purple-300"
                    disabled={selectedImages.size === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download ({selectedImages.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDelete}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    disabled={selectedImages.size === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedImages.size})
                  </Button>
                </>
              )}
            </div>

            {!isSelectionMode && (
            <div className="flex flex-wrap gap-3">
              {/* Search Bar */}
              <div className="relative" style={{ width: '50%' }}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
                <Input
                  placeholder="Search images..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-purple-300 focus:border-purple-500 h-10"
                />
              </div>

              {/* Sort Controls */}
              <Select value={sortBy} onValueChange={(value: 'name' | 'date') => setSortBy(value)}>
                <SelectTrigger className="w-32 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="border-purple-300 h-10 px-3"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>

              {/* Grid Size Toggle */}
              <div className="flex gap-1 bg-white border border-purple-300 rounded-lg p-1 h-10">
                <Button
                  size="sm"
                  variant={gridSize === 'small' ? 'default' : 'ghost'}
                  onClick={() => setGridSize('small')}
                  className={`h-8 ${gridSize === 'small' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                  title="Large images"
                >
                  <Grid2x2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={gridSize === 'medium' ? 'default' : 'ghost'}
                  onClick={() => setGridSize('medium')}
                  className={`h-8 ${gridSize === 'medium' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                  title="Medium images"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={gridSize === 'large' ? 'default' : 'ghost'}
                  onClick={() => setGridSize('large')}
                  className={`h-8 ${gridSize === 'large' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                  title="Small images"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>

              {/* REMOVED: Character Filter select - using search instead */}
            </div>
            )}
          </div>

          {/* Upload Section */}
          <Card className="border-2 border-purple-300 bg-purple-50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Character Selection */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-purple-900 font-medium mb-2 block">Select Character</Label>
                    <div className="relative w-64">
                      <Input
                        placeholder="Search or select character..."
                        value={characterSearchQuery}
                        onChange={(e) => setCharacterSearchQuery(e.target.value)}
                        className="bg-white border-purple-300 focus:border-purple-500 focus:ring-purple-500 h-10"
                      />
                      {characterSearchQuery && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-purple-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {characters
                            .filter((char) => 
                              char && 
                              char.trim() !== "" && 
                              char !== "No Character" &&
                              char.toLowerCase().includes(characterSearchQuery.toLowerCase())
                            )
                            .map((char) => {
                              const thumbnail = getCharacterThumbnail(char);
                              return (
                                <div
                                  key={char}
                                  onClick={() => {
                                    setUploadCharacterSelection(char);
                                    setCharacterSearchQuery('');
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-purple-100 cursor-pointer"
                                >
                                  {thumbnail ? (
                                    <img 
                                      src={thumbnail} 
                                      alt={char} 
                                      className="w-6 h-6 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-xs font-semibold text-purple-700">
                                      {char.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span>{char}</span>
                                </div>
                              );
                            })}
                          <div
                            onClick={() => {
                              setUploadCharacterSelection('__new__');
                              setCharacterSearchQuery('');
                            }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-purple-100 cursor-pointer border-t border-purple-200"
                          >
                            <span className="text-purple-600 font-medium">+ New Character</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {uploadCharacterSelection && uploadCharacterSelection !== '__new__' && (
                      <p className="text-sm text-gray-600 mt-1">Selected: <span className="font-medium">{uploadCharacterSelection}</span></p>
                    )}
                  </div>
                  
                  {uploadCharacterSelection === "__new__" && (
                    <div>
                      <Label className="text-purple-900 font-medium mb-2 block">New Character Name</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="e.g., Alina, Maria"
                          value={newCharacterName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setNewCharacterName(value);
                            
                            // Validate for duplicates
                            if (value.trim()) {
                              const isDuplicate = characters.some(char => char.toLowerCase() === value.trim().toLowerCase());
                              if (isDuplicate) {
                                setNewCharacterNameError(`Character "${value.trim()}" already exists!`);
                              } else {
                                setNewCharacterNameError('');
                              }
                            } else {
                              setNewCharacterNameError('');
                            }
                          }}
                          className={`bg-white focus:border-purple-500 focus:ring-purple-500 h-10 w-64 ${
                            newCharacterNameError ? 'border-red-500' : 'border-purple-300'
                          }`}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            // Generate unique Romanian female name
                            let attempts = 0;
                            let generatedName = '';
                            while (attempts < 100) {
                              const randomName = ROMANIAN_FEMALE_NAMES[Math.floor(Math.random() * ROMANIAN_FEMALE_NAMES.length)];
                              const isDuplicate = characters.some(char => char.toLowerCase() === randomName.toLowerCase());
                              if (!isDuplicate) {
                                generatedName = randomName;
                                break;
                              }
                              attempts++;
                            }
                            if (generatedName) {
                              setNewCharacterName(generatedName);
                              setNewCharacterNameError('');
                            } else {
                              toast.error('Could not generate unique name. Please enter manually.');
                            }
                          }}
                          className="text-blue-600 underline text-sm hover:text-blue-800 whitespace-nowrap"
                        >
                          Fill
                        </button>
                      </div>
                      {newCharacterNameError && (
                        <p className="text-red-500 text-sm mt-1">{newCharacterNameError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Drag & Drop Zone */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOverUpload}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDropUpload}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDraggingOver
                      ? 'border-purple-600 bg-purple-100'
                      : 'border-purple-300 bg-white hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                  <p className="text-purple-900 font-medium mb-2">
                    {isDraggingOver ? 'Drop images here' : 'Drag & drop images here'}
                  </p>
                  <p className="text-sm text-purple-600">
                    or click to browse
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Preview Thumbnails */}
                {previewFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-purple-900 font-medium">
                        {previewFiles.length} image{previewFiles.length > 1 ? 's' : ''} selected
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          previewFiles.forEach(p => URL.revokeObjectURL(p.preview));
                          setPreviewFiles([]);
                        }}
                        className="text-xs"
                      >
                        Clear All
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
                      {previewFiles.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview.preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full aspect-[9/16] object-cover rounded border border-purple-200"
                          />
                          <button
                            onClick={() => removePreview(index)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={handleUploadPreviews}
                      disabled={uploadingFiles.length > 0}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {uploadingFiles.length > 0 ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Uploading... {uploadProgress}%
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mr-2" />
                          Upload {previewFiles.length} Image{previewFiles.length > 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                )}

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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-purple-900">
                      {character}
                      <span className="text-sm text-purple-600 ml-2">
                        ({characterImages.length} images)
                      </span>
                    </h2>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteCharacter(character)}
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Șterge Caracterul
                    </Button>
                  </div>

                  <div className={`grid gap-2 ${
                    gridSize === 'small' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' :
                    gridSize === 'medium' ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12' :
                    'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14'
                  }`}>
                    {characterImages.map((image) => (
                      <div
                        key={image.id}
                        draggable={!isSelectionMode}
                        onDragStart={() => handleDragStart(image.id)}
                        onDragOver={(e) => handleDragOverImage(e, image.id)}
                        onDragLeave={handleDragLeaveImage}
                        onDrop={() => handleDropOnImage(image.id)}
                        className={`relative ${!isSelectionMode ? 'cursor-move' : 'cursor-pointer'} ${
                          dragOverImageId === image.id ? 'ring-2 ring-purple-600' : ''
                        }`}
                      >
                        {/* Image Thumbnail */}
                        <div 
                          className="relative aspect-[9/16] bg-gray-100 rounded overflow-hidden"
                          onClick={() => isSelectionMode && toggleImageSelection(image.id)}
                        >
                          <img
                            src={image.imageUrl}
                            alt={image.imageName}
                            className="w-full h-full object-cover"
                          />
                          {isSelectionMode && (
                            <div className="absolute top-1 left-1">
                              {selectedImages.has(image.id) ? (
                                <CheckSquare className="w-6 h-6 text-purple-600 bg-white rounded" />
                              ) : (
                                <Square className="w-6 h-6 text-gray-400 bg-white rounded" />
                              )}
                            </div>
                          )}
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
                                onClick={() => handleSetThumbnail(image.id)}
                                className="w-5 h-5 p-0 hover:bg-yellow-100"
                                title="Set as Character Thumbnail"
                              >
                                <Star className="w-3 h-3 text-yellow-600" />
                              </Button>
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
                                disabled={isImageUsedInGeneratedVideos(image.imageUrl)}
                                className="w-5 h-5 p-0 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isImageUsedInGeneratedVideos(image.imageUrl) ? "Nu poți șterge această imagine pentru că are videouri generate. Șterge mai întâi AD-urile cu videouri." : "Șterge imaginea"}
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
          <div>
            {selectedCharacter !== "all" && (
              <h2 className="text-2xl font-bold text-purple-900 mb-4">
                {selectedCharacter}
                <span className="text-sm text-purple-600 ml-2">
                  ({filteredImages.length} images)
                </span>
              </h2>
            )}
            <div className={`grid gap-2 ${
            gridSize === 'small' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' :
            gridSize === 'medium' ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12' :
            'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14'
          }`}>
            {filteredImages.map((image) => (
              <div
                key={image.id}
                draggable={!isSelectionMode}
                onDragStart={() => handleDragStart(image.id)}
                onDragOver={(e) => handleDragOverImage(e, image.id)}
                onDragLeave={handleDragLeaveImage}
                onDrop={() => handleDropOnImage(image.id)}
                className={`relative ${!isSelectionMode ? 'cursor-move' : 'cursor-pointer'} ${
                  dragOverImageId === image.id ? 'ring-2 ring-purple-600' : ''
                }`}
              >
                {/* Image name and edit icon ABOVE thumbnail */}
                {editingImageId === image.id ? (
                  <div className="mb-1 space-y-1">
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
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <p className="text-xs text-purple-900 truncate flex-1">
                      {image.imageName}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditName(image.id)}
                      className="w-5 h-5 p-0 hover:bg-blue-100 flex-shrink-0"
                      title="Edit name"
                    >
                      <Edit2 className="w-3 h-3 text-blue-600" />
                    </Button>
                  </div>
                )}

                {/* Image Thumbnail */}
                <div 
                  className="relative aspect-[9/16] bg-gray-100 rounded overflow-hidden"
                  onClick={() => isSelectionMode && toggleImageSelection(image.id)}
                >
                  <img
                    src={image.imageUrl}
                    alt={image.imageName}
                    className="w-full h-full object-cover"
                  />
                  {isSelectionMode && (
                    <div className="absolute top-1 left-1">
                      {selectedImages.has(image.id) ? (
                        <CheckSquare className="w-6 h-6 text-purple-600 bg-white rounded" />
                      ) : (
                        <Square className="w-6 h-6 text-gray-400 bg-white rounded" />
                      )}
                    </div>
                  )}
                </div>

                {/* Delete and Star icons BELOW thumbnail */}
                <div className="mt-1 flex gap-0.5 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetThumbnail(image.id)}
                    className="w-5 h-5 p-0 hover:bg-yellow-100"
                    title="Set as Character Thumbnail"
                  >
                    <Star className="w-3 h-3 text-yellow-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(image.id)}
                    disabled={isImageUsedInGeneratedVideos(image.imageUrl)}
                    className="w-5 h-5 p-0 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isImageUsedInGeneratedVideos(image.imageUrl) ? "Nu poți șterge această imagine pentru că are videouri generate. Șterge mai întâi AD-urile cu videouri." : "Șterge imaginea"}
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
            </div>
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
