# Step 4 UX Redesign - Tabs Implementation

## 🎯 Obiectiv:
Separarea clară între **Manual Upload** și **Select from Library** cu tabs.

## 📋 State necesar:

```typescript
// În Home.tsx, adaugă:
const [step4ActiveTab, setStep4ActiveTab] = useState<'upload' | 'library'>('upload');

// Auto-filter by character când intri în Step 4
useEffect(() => {
  if (currentStep === 4 && selectedCharacterId) {
    const characterName = categoryCharacters?.find(c => c.id === selectedCharacterId)?.name;
    if (characterName) {
      setLibraryCharacterFilter(characterName);
      setStep4ActiveTab('library'); // Switch to library tab if character is selected
    }
  }
}, [currentStep, selectedCharacterId, categoryCharacters]);
```

## 🎨 UI Structure:

```tsx
{currentStep === 4 && (
  <Card className="mb-8 border-2 border-blue-200">
    <CardHeader className="bg-blue-50">
      <CardTitle>STEP 4 - Images</CardTitle>
      <CardDescription>Upload images or select from library (9:16 recommended)</CardDescription>
    </CardHeader>
    
    <CardContent className="pt-6">
      {/* Character Selector (always visible) */}
      <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
        <label className="block text-sm font-medium text-purple-900 mb-2">
          Select Character *
        </label>
        <Select value={selectedCharacterId?.toString() || ''} onValueChange={...}>
          {/* ... character options ... */}
        </Select>
      </div>
      
      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
        <button
          onClick={() => setStep4ActiveTab('upload')}
          className={`flex-1 py-3 px-6 font-semibold transition-all ${
            step4ActiveTab === 'upload'
              ? 'bg-blue-500 text-white border-b-4 border-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📤 Manual Upload
        </button>
        <button
          onClick={() => setStep4ActiveTab('library')}
          className={`flex-1 py-3 px-6 font-semibold transition-all ${
            step4ActiveTab === 'library'
              ? 'bg-green-500 text-white border-b-4 border-green-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📚 Select from Library ({libraryImages.length})
        </button>
      </div>
      
      {/* TAB CONTENT */}
      {step4ActiveTab === 'upload' && (
        <div>
          {/* Drag & Drop Upload */}
          <div
            onDrop={handleImageDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors ${
              selectedCharacterId ? 'cursor-pointer bg-blue-50' : 'cursor-not-allowed opacity-50 bg-gray-50'
            }`}
            onClick={() => selectedCharacterId && document.getElementById('image-upload')?.click()}
          >
            <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-blue-900 mb-2">
              Drop images here or click to upload
            </p>
            <p className="text-sm text-gray-500">
              Supports .jpg, .png, .webp (9:16 recommended)
            </p>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
              disabled={!selectedCharacterId}
            />
          </div>
          
          {/* Upload Progress */}
          {uploadingFiles.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Uploading {uploadingFiles.length} image(s)...
                </span>
                <span className="text-sm font-bold text-blue-900">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      
      {step4ActiveTab === 'library' && (
        <div>
          {/* Search + Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search images by name..."
                value={librarySearchQuery}
                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={libraryCharacterFilter} onValueChange={setLibraryCharacterFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by character" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Characters</SelectItem>
                {libraryCharacters
                  .filter((char) => char && char.trim() !== "")
                  .map((char) => (
                    <SelectItem key={char} value={char}>
                      {char}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Images Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[400px] overflow-y-auto mb-6 p-2 bg-green-50 rounded-lg">
            {libraryImages
              .filter((img) => {
                const query = librarySearchQuery.toLowerCase();
                const matchesSearch = img.imageName.toLowerCase().includes(query);
                const matchesCharacter = libraryCharacterFilter === "all" || img.characterName === libraryCharacterFilter;
                return matchesSearch && matchesCharacter;
              })
              .map((img) => (
                <div
                  key={img.id}
                  className={`relative group cursor-pointer rounded border-2 transition-all ${
                    selectedLibraryImages.includes(img.id)
                      ? 'border-green-500 ring-2 ring-green-300 shadow-lg'
                      : 'border-gray-200 hover:border-green-400 hover:shadow-md'
                  }`}
                  onClick={() => {
                    setSelectedLibraryImages((prev) =>
                      prev.includes(img.id)
                        ? prev.filter((id) => id !== img.id)
                        : [...prev, img.id]
                    );
                  }}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.imageName}
                    className="w-full aspect-[9/16] object-cover rounded"
                  />
                  {selectedLibraryImages.includes(img.id) && (
                    <div className="absolute top-1 right-1 bg-green-600 text-white rounded-full p-1">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                    {img.imageName}
                  </div>
                </div>
              ))}
          </div>
          
          {/* Add Selected Button */}
          {selectedLibraryImages.length > 0 && (
            <Button
              onClick={() => {
                // Filter out images that are already added
                const existingImageIds = images.map(img => img.id);
                const newImages = libraryImages
                  .filter((img) => selectedLibraryImages.includes(img.id))
                  .filter((img) => !existingImageIds.includes(`library-${img.id}`))
                  .map((img) => ({
                    id: `library-${img.id}`,
                    url: img.imageUrl,
                    file: null,
                    fileName: img.imageName,
                    isCTA: false,
                    fromLibrary: true,
                  }));
                
                if (newImages.length === 0) {
                  toast.warning('All selected images are already added!');
                  setSelectedLibraryImages([]);
                  return;
                }
                
                setImages((prev) => [...prev, ...newImages]);
                setSelectedLibraryImages([]);
                toast.success(`${newImages.length} images added from library!`);
              }}
              className="bg-green-600 hover:bg-green-700 w-full text-lg py-6"
            >
              <Check className="w-5 h-5 mr-2" />
              Add {selectedLibraryImages.length} Selected Image(s)
            </Button>
          )}
        </div>
      )}
      
      {/* SELECTED IMAGES PREVIEW (common for both tabs) */}
      {images.length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Selected Images ({images.length})
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.url}
                  alt={image.fileName}
                  className="w-full aspect-[9/16] object-cover rounded border-2 border-gray-300"
                />
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all shadow-lg hover:scale-110 border-2 border-white"
                >
                  <X className="w-4 h-4" />
                </button>
                {image.fromLibrary && (
                  <div className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-2 py-0.5 rounded">
                    Library
                  </div>
                )}
                <p className="text-xs text-center mt-1 text-gray-600 truncate">
                  {image.fileName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Next Button */}
      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => {
            if (images.length === 0) {
              toast.error('Please upload or select at least one image');
              return;
            }
            setCurrentStep(5);
          }}
          className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
        >
          Next: Create Mappings
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

## ✅ Benefits:

1. **Clear separation** - Upload vs Library în tabs separate
2. **Auto-filter** - Când selectezi character → filtrează automat library images
3. **Clean design** - Fără bordere confusing, layout simplu
4. **Better UX** - User știe exact unde să meargă pentru fiecare acțiune
