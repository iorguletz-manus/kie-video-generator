# TRIM ALL VIDEOS - Logica Completă

## Locație Buton
**File:** `/client/src/pages/Home.tsx`  
**Linie:** 7382-7402  
**Step:** 8 (Video Editor)

---

## Flow Complet

### 1. **Click pe Buton** (linia 7383-7388)
```typescript
onClick={() => {
  // Deschide modal-ul de progress
  setIsTrimmingModalOpen(true);
  // Start trimming process
  handleTrimAllVideos();
}}
```

**Ce afișează butonul:**
- Dacă există deja videouri trimmed → `✂️ TRIM ALL VIDEOS (X)` unde X = număr de videouri cu `recutStatus === 'recut'`
- Dacă e prima dată → `✂️ TRIM ALL VIDEOS (Y)` unde Y = număr total de videouri approved

---

### 2. **Funcția `handleTrimAllVideos()`** (linia 1696-1843)

#### **2.1. Determină ce videouri să trimeze**

**Scenariul 1: Prima dată (nu există trimmedVideoUrl)**
```typescript
videosToTrim = videoResults.filter(v => 
  v.reviewStatus === 'accepted' &&  // Approved în Step 7
  v.status === 'success' &&         // Generat cu succes
  v.videoUrl                        // Are URL video
);
```
→ **Trimează TOATE videourile approved**

**Scenariul 2: A doua oară (există trimmedVideoUrl)**
```typescript
videosToTrim = videoResults.filter(v => 
  v.reviewStatus === 'accepted' && 
  v.status === 'success' && 
  v.videoUrl &&
  v.recutStatus === 'recut'  // Doar cele marcate pentru recut
);
```
→ **Trimează DOAR videourile cu status "Recut"** (marcate în Step 9)

---

#### **2.2. Validare: Verifică lock-urile**

```typescript
const unlockedVideos = videosToTrim.filter(v => 
  !v.isStartLocked || !v.isEndLocked
);

if (unlockedVideos.length > 0) {
  toast.error(
    `❌ Următoarele videouri nu sunt locked:\n\n${unlockedNames}\n\n` +
    `Te rog să blochezi START și END pentru toate videourile înainte de trimming!`
  );
  return;
}
```

**Condiție obligatorie:** Toate videourile trebuie să aibă **START ȘI END locked** înainte de trimming!

---

#### **2.3. Loop prin fiecare video**

```typescript
for (let i = 0; i < videosToTrim.length; i++) {
  const video = videosToTrim[i];
  
  // Update progress modal
  setTrimmingProgress({
    current: i + 1,
    total: videosToTrim.length,
    currentVideo: video.videoName,
    status: 'processing',
    message: `Trimming video ${i + 1}/${videosToTrim.length}...`
  });
  
  try {
    // 1) Get trim timestamps from cutPoints (milliseconds → seconds)
    const trimStart = (video.cutPoints?.startKeep || 0) / 1000;
    const trimEnd = (video.cutPoints?.endKeep || 0) / 1000;
    
    // 2) Call FFmpeg API via tRPC
    const result = await cutVideoMutation.mutateAsync({
      videoUrl: video.videoUrl!,
      videoName: video.videoName,
      startTimeSeconds: trimStart,
      endTimeSeconds: trimEnd,
      ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined
    });
    
    if (!result.success || !result.downloadUrl) {
      throw new Error('Failed to trim video');
    }
    
    // 3) Update state with trimmed video URL
    setVideoResults(prev => prev.map(v =>
      v.videoName === video.videoName
        ? {
            ...v,
            trimmedVideoUrl: result.downloadUrl,  // ✅ Salvează URL-ul trimmed
          }
        : v
    ));
    
    successCount++;
    
  } catch (error) {
    failCount++;
    toast.error(`❌ ${video.videoName}: ${error.message}`);
  }
}
```

---

#### **2.4. Finalizare**

```typescript
// Update progress modal
setTrimmingProgress({
  current: videosToTrim.length,
  total: videosToTrim.length,
  currentVideo: '',
  status: 'complete',
  message: `✅ Complete! Success: ${successCount}, Failed: ${failCount}`
});

toast.success(`✂️ Trimming complete! ${successCount}/${videosToTrim.length} videos trimmed`);

// Navigate to Step 9 after 2 seconds
setTimeout(() => {
  setIsTrimmingModalOpen(false);
  setCurrentStep(9);  // ✅ Merge automat la Step 9
}, 2000);
```

---

## Date Importante

### **Sursa datelor de trim:**
```typescript
const trimStart = (video.cutPoints?.startKeep || 0) / 1000;
const trimEnd = (video.cutPoints?.endKeep || 0) / 1000;
```
- `cutPoints` vine din **database** (salvat via `onTrimChange` în VideoEditorV2)
- Format: **milliseconds** în database → convertit la **seconds** pentru FFmpeg

### **Matching video-urilor:**
```typescript
v.videoName === video.videoName
```
- Folosește `videoName` pentru matching (funcționează și pentru duplicate-uri)

### **API Call:**
- **Endpoint:** `cutVideoMutation` (tRPC)
- **Backend:** `/server/routers/video.ts` → funcția `cutVideo`
- **FFmpeg API:** External service (necesită `ffmpegApiKey`)

---

## Fluxul complet (vizual)

```
User Click "TRIM ALL VIDEOS"
    ↓
Deschide modal de progress
    ↓
Determină videouri de trimmed (Scenariul 1 sau 2)
    ↓
Validare: Toate locked? (START + END)
    ↓ DA
Loop prin fiecare video:
    ├─ Extrage cutPoints (startKeep, endKeep)
    ├─ Convert ms → seconds
    ├─ Call FFmpeg API (cutVideoMutation)
    ├─ Primește trimmedVideoUrl
    └─ Update state (setVideoResults)
    ↓
Afișează rezultat (success/fail count)
    ↓
După 2s → Navigate la Step 9
```

---

## Condiții de Succes

✅ **Toate videourile trebuie:**
1. `reviewStatus === 'accepted'` (approved în Step 7)
2. `status === 'success'` (generat cu succes)
3. `videoUrl` există
4. `isStartLocked === true` ȘI `isEndLocked === true`
5. `cutPoints.startKeep` și `cutPoints.endKeep` sunt setate

❌ **Dacă lipsește oricare → video-ul e skipped sau apare eroare**

---

## Backend API

**File:** `/server/routers/video.ts`  
**Funcție:** `cutVideo`

**Input:**
```typescript
{
  videoUrl: string,
  videoName: string,
  startTimeSeconds: number,
  endTimeSeconds: number,
  ffmpegApiKey?: string
}
```

**Output:**
```typescript
{
  success: boolean,
  downloadUrl: string,  // URL-ul video-ului trimmed
  message?: string
}
```

**FFmpeg Command (aproximativ):**
```bash
ffmpeg -i input.mp4 -ss {startTimeSeconds} -to {endTimeSeconds} -c copy output.mp4
```

---

## Observații Importante

1. **Database = Single Source of Truth**
   - `cutPoints` sunt salvate în database via `onTrimChange`
   - NU se folosește localStorage

2. **Duplicate-uri**
   - Funcționează corect pentru duplicate-uri (matching pe `videoName`)

3. **Recut Logic**
   - În Step 9, user poate marca videouri cu `recutStatus = 'recut'`
   - La al doilea trim, doar acestea sunt retrimmed

4. **Progress Modal**
   - Afișează progress în timp real
   - Nu blochează UI-ul (async operations)

5. **Error Handling**
   - Dacă un video eșuează, continuă cu următorul
   - Afișează toast error pentru fiecare fail
   - La final, arată success/fail count
