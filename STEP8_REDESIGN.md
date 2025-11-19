# Step 8 - Video Editing: Complete Workflow Redesign

## 🎯 Obiectiv
Procesare batch a tuturor videouri approved cu Whisper API ÎNAINTE de a intra în Step 8, cu progress modal și UI optimizat pentru 25+ videouri.

---

## 📋 Workflow Complet

### **STEP 7 → STEP 8 Transition**

#### 1. User apasă butonul "Video Editing" în Step 7

```typescript
onClick={async () => {
  const approvedVideos = videoResults.filter(v => 
    v.reviewStatus === 'accepted' && 
    v.status === 'success' && 
    v.videoUrl
  );
  
  if (approvedVideos.length === 0) {
    toast.error('Nu există videouri pentru editare');
    return;
  }
  
  // Deschide progress modal
  setShowProcessingModal(true);
  setProcessingProgress({ current: 0, total: approvedVideos.length });
  
  // Batch process ALL videos
  await batchProcessVideosWithWhisper(approvedVideos);
  
  // Închide modal
  setShowProcessingModal(false);
  
  // Go to Step 8
  setCurrentStep(8);
}
```

---

#### 2. Progress Modal Component

```tsx
<Dialog open={showProcessingModal}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>🎬 Procesare Videouri cu Whisper AI</DialogTitle>
      <DialogDescription>
        Analizăm fiecare video pentru a detecta textul roșu...
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Progress Bar */}
      <Progress value={(current / total) * 100} />
      
      {/* Status Text */}
      <p className="text-center text-sm text-gray-600">
        Video {current}/{total}: {currentVideoName}
      </p>
      
      {/* Current Operation */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {processingStep === 'download' && '📥 Descărcare video...'}
        {processingStep === 'extract' && '🎵 Extragere audio...'}
        {processingStep === 'whisper' && '🤖 Whisper API transcription...'}
        {processingStep === 'detect' && '🔍 Detectare text roșu...'}
        {processingStep === 'save' && '💾 Salvare timestamps...'}
      </div>
      
      {/* Estimated Time */}
      <p className="text-xs text-center text-gray-400">
        Timp estimat: ~{estimatedMinutes} minute
      </p>
    </div>
  </DialogContent>
</Dialog>
```

---

#### 3. Batch Processing Function

```typescript
async function batchProcessVideosWithWhisper(videos: VideoResult[]) {
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    
    setProcessingProgress({ 
      current: i + 1, 
      total: videos.length,
      currentVideoName: video.videoName 
    });
    
    try {
      // Step 1: Download video
      setProcessingStep('download');
      const videoPath = await downloadVideo(video.videoUrl);
      
      // Step 2: Extract audio
      setProcessingStep('extract');
      const audioPath = await extractAudio(videoPath);
      
      // Step 3: Whisper API
      setProcessingStep('whisper');
      const transcription = await transcribeWithWhisper(audioPath);
      
      // Step 4: Detect red text
      setProcessingStep('detect');
      const { startKeep, endKeep } = await detectRedText(
        transcription.words,
        video.redText
      );
      
      // Step 5: Save to DB
      setProcessingStep('save');
      await saveVideoEditingData(video.id, startKeep, endKeep, transcription);
      
      // Update videoResults state
      setVideoResults(prev => prev.map(v => 
        v.id === video.id 
          ? { ...v, startKeep, endKeep, editStatus: 'edited' }
          : v
      ));
      
    } catch (error) {
      console.error(`Error processing ${video.videoName}:`, error);
      toast.error(`Eroare la ${video.videoName}: ${error.message}`);
    }
  }
}
```

---

### **STEP 8 UI - Video Editing**

#### Layout pentru 25+ Videouri

```tsx
<div className="space-y-6 max-h-[80vh] overflow-y-auto pr-4">
  {approvedVideos.map((video, index) => (
    <Card key={video.id} className="p-4">
      <div className="flex gap-4">
        {/* Video Player - SMALL (300px) */}
        <div className="flex-shrink-0 w-[300px]">
          <ReactPlayer
            url={video.videoUrl}
            width="300px"
            height="533px"  // 9:16 aspect ratio
            controls
            playing={false}
          />
        </div>
        
        {/* Timeline Editor */}
        <div className="flex-1 space-y-4">
          <h3 className="font-semibold">{video.videoName}</h3>
          
          {/* Timeline with Sliders */}
          <div className="space-y-2">
            <label className="text-sm font-medium">START: {formatTime(startKeep)}</label>
            <Slider
              value={startKeep}
              onChange={(value) => setStartKeep(value)}
              min={0}
              max={duration}
              step={10}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">END: {formatTime(endKeep)}</label>
            <Slider
              value={endKeep}
              onChange={(value) => setEndKeep(value)}
              min={0}
              max={duration}
              step={10}
              className="w-full"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={seekToStart}>Seek to START</Button>
            <Button onClick={seekToEnd}>Seek to END</Button>
            <Button onClick={saveTimestamps}>Save</Button>
          </div>
          
          {/* Info */}
          <p className="text-xs text-gray-500">
            Trimmed duration: {formatTime(endKeep - startKeep)}
          </p>
        </div>
      </div>
    </Card>
  ))}
</div>
```

---

## 🔧 Backend API Endpoints

### 1. **POST /api/video-editing/batch-process**
Procesează toate videurile într-un singur request (sau stream cu progress)

**Request:**
```json
{
  "videos": [
    {
      "id": "video_1",
      "videoUrl": "https://...",
      "fullText": "...",
      "redText": "..."
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "videoId": "video_1",
      "startKeep": 2500,
      "endKeep": 12450,
      "whisperData": { ... }
    }
  ]
}
```

### 2. **POST /api/video-editing/process-single**
Procesează un singur video (pentru retry)

### 3. **POST /api/video-editing/save-timestamps**
Salvează timestamps editate manual

---

## 📊 Estimare Timp Procesare

**Per video:**
- Download: 2-5s
- Extract audio: 1-2s
- Whisper API: 5-10s (depinde de lungime)
- Detect red text: <1s
- Save DB: <1s

**Total per video: ~10-20s**

**Pentru 25 videouri: ~4-8 minute**

---

## ✅ Checklist Implementare

- [ ] Creare `ProcessingModal` component
- [ ] Implementare `batchProcessVideosWithWhisper()` function
- [ ] Modificare buton "Video Editing" cu batch processing
- [ ] Fix `VideoEditor` component: small player (300px)
- [ ] Remove auto-process din `VideoEditor`
- [ ] Update Step 8 layout pentru scroll vertical
- [ ] Backend: implement batch processing endpoint
- [ ] Testing cu 25 videouri
- [ ] Error handling și retry logic

---

## 🎨 UI Improvements

1. **Progress Modal**: Arată exact ce se întâmplă
2. **Video Player Size**: 300px width (ca în Step 7)
3. **Vertical Scroll**: Pentru 25+ videouri
4. **Compact Layout**: Player + Timeline side-by-side
5. **Save All Button**: La sfârșitul paginii
