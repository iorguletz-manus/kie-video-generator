# Critical Fixes Summary

## 🎯 Probleme identificate:

### 1. Context pierdut când navighezi la Images Library ❌
**Problema:** Click pe "Images Library" din dropdown → `setLocation("/images-library")` → pierde character selection

**Fix:** 
- Schimbă `setLocation("/images-library")` cu `setIsImagesLibraryOpen(true)`
- Modal-ul `ImagesLibraryModal` deja există și păstrează context-ul

**Locație:** `Home.tsx` linia 2731

---

### 2. Batch limit 20 videos la Kie.ai ❌
**Problema:** Când ai 29 videos, API-ul eșuează (probabil rate limiting)

**Fix:**
- Split în batch-uri de max 20 videos
- Process secvențial: batch 1 (20 videos) → batch 2 (9 videos)
- Update ProcessingModal să arate "Batch 1/2: Processing video 5/20..."

**Locație:** `Home.tsx` funcția `generateVideos()`

---

### 3. Step 4 Images UX praf ❌
**Problema:**
- Manual Upload și Library Images sunt amestecate
- Prea multe bordere, confusing
- Nu filtrează by default pe character-ul selectat

**Fix:**
- **2 Tabs separate:**
  - Tab 1: "📤 Manual Upload" (drag & drop)
  - Tab 2: "📚 Select from Library" (grid cu imagini)
- **Default filter:** Când intri în Step 4, dacă ai character selectat → filtrează automat imaginile din library
- **Clean design:** Fiecare tab e separat, fără overlap

**Locație:** `Home.tsx` Step 4 section

---

## 📝 Implementation Plan:

### Fix #1: Context Preservation (5 min)
```typescript
// Linia 2731
<DropdownMenuItem onClick={() => setIsImagesLibraryOpen(true)} className="cursor-pointer">
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
  Images Library
</DropdownMenuItem>
```

### Fix #2: Batch Processing (30 min)
```typescript
const generateVideos = async () => {
  const BATCH_SIZE = 20;
  const totalVideos = combinations.length;
  const batches = [];
  
  // Split în batch-uri
  for (let i = 0; i < totalVideos; i += BATCH_SIZE) {
    batches.push(combinations.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Total videos: ${totalVideos}, Batches: ${batches.length}`);
  
  let allResults: VideoResult[] = [];
  
  // Process fiecare batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    setProcessingProgress({
      current: 0,
      total: batch.length,
      currentVideoName: '',
      batchNumber: batchIndex + 1,
      totalBatches: batches.length,
    });
    
    // Process batch-ul curent
    const batchResults = await processBatch(batch, batchIndex + 1, batches.length);
    allResults = [...allResults, ...batchResults];
    
    // Delay între batch-uri pentru rate limiting
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  setVideoResults(allResults);
};
```

### Fix #3: Step 4 UX Redesign (45 min)
```typescript
// State pentru tabs
const [step4ActiveTab, setStep4ActiveTab] = useState<'upload' | 'library'>('upload');

// Auto-filter by character când intri în Step 4
useEffect(() => {
  if (currentStep === 4 && selectedCharacterId) {
    const characterName = categoryCharacters?.find(c => c.id === selectedCharacterId)?.name;
    if (characterName) {
      setLibraryCharacterFilter(characterName);
    }
  }
}, [currentStep, selectedCharacterId]);

// JSX pentru Step 4
{currentStep === 4 && (
  <Card>
    <CardHeader>
      <CardTitle>Step 4: Upload Images</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          onClick={() => setStep4ActiveTab('upload')}
          variant={step4ActiveTab === 'upload' ? 'default' : 'outline'}
          className="flex-1"
        >
          📤 Manual Upload
        </Button>
        <Button
          onClick={() => setStep4ActiveTab('library')}
          variant={step4ActiveTab === 'library' ? 'default' : 'outline'}
          className="flex-1"
        >
          📚 Select from Library ({libraryImages.length})
        </Button>
      </div>
      
      {/* Tab Content */}
      {step4ActiveTab === 'upload' && (
        <div>
          {/* Drag & Drop Upload */}
          <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-purple-500" />
            <p className="text-lg font-semibold mb-2">Drag & Drop Images Here</p>
            <p className="text-sm text-gray-600 mb-4">or click to browse</p>
            <input type="file" multiple accept="image/*" onChange={handleImageUpload} />
          </div>
        </div>
      )}
      
      {step4ActiveTab === 'library' && (
        <div>
          {/* Search + Filter */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              placeholder="Search images..."
              value={librarySearchQuery}
              onChange={(e) => setLibrarySearchQuery(e.target.value)}
            />
            <Select value={libraryCharacterFilter} onValueChange={setLibraryCharacterFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by character" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Characters</SelectItem>
                {libraryCharacters.map(char => (
                  <SelectItem key={char} value={char}>{char}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Images Grid */}
          <div className="grid grid-cols-4 gap-4">
            {filteredLibraryImages.map(img => (
              <div key={img.id} onClick={() => toggleImageSelection(img.id)}>
                <img src={img.imageUrl} alt={img.imageName} />
                {selectedLibraryImages.includes(img.id) && <Check />}
              </div>
            ))}
          </div>
          
          {/* Add Button */}
          {selectedLibraryImages.length > 0 && (
            <Button onClick={addSelectedLibraryImages}>
              Add {selectedLibraryImages.length} Images
            </Button>
          )}
        </div>
      )}
      
      {/* Selected Images Preview (common for both tabs) */}
      <div className="mt-6">
        <h4 className="font-semibold mb-4">Selected Images ({images.length})</h4>
        <div className="grid grid-cols-6 gap-4">
          {images.map(img => (
            <div key={img.id}>
              <img src={img.url} alt={img.fileName} />
              <button onClick={() => removeImage(img.id)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

---

## ✅ Testing Checklist:

- [ ] Fix #1: Click "Images Library" → modal se deschide → character selection păstrată
- [ ] Fix #2: Generare 29 videos → split în 2 batch-uri (20 + 9) → toate success
- [ ] Fix #3: Step 4 → 2 tabs separate → filter by character funcționează
