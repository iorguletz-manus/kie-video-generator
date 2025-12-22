# Selective Autoprepare Processing - Step 7

## 🎯 Feature Overview

Added selective video processing logic to Step 7 "Autoprepare for Cutting" button, similar to Step 9 "Prepare for Merge".

---

## ✅ What Changed

### **Before:**
- Clicked "Autoprepare" → Processed ALL videos (even if already processed)
- No way to skip videos that already have audio/whisper/cleanvoice data
- Wasted time and FFmpeg API calls

### **After:**
- **Scenario 1:** NO videos have audio → Process ALL directly (no popup)
- **Scenario 2:** SOME videos have audio → Show selection popup

---

## 🎨 Selection Popup Design

### **GRUPUL 1: Unprocessed Videos**
- ✅ Checkboxes ENABLED (active)
- ✅ ALL selected by default
- ✅ Buttons: "Select All" / "Deselect All"
- ✅ Green header: "🆕 Unprocessed Videos (X)"

### **GRUPUL 2: Processed Videos**
- ⚪ Checkboxes DISABLED (grey) by default
- ⚪ ALL deselected by default
- 🔓 Button: "Unlock for Reprocessing" → enables checkboxes
- 🔒 Button: "Lock" → disables checkboxes again
- ✅ Blue header: "✅ Processed Videos (X)"

---

## 🔧 Technical Implementation

### **1. New State Variables:**
```typescript
const [showVideoSelectionModal, setShowVideoSelectionModal] = useState(false);
const [unprocessedVideos, setUnprocessedVideos] = useState<VideoResult[]>([]);
const [processedVideos, setProcessedVideos] = useState<VideoResult[]>([]);
const [selectedUnprocessed, setSelectedUnprocessed] = useState<Set<string>>(new Set());
const [selectedProcessed, setSelectedProcessed] = useState<Set<string>>(new Set());
const [processedVideosUnlocked, setProcessedVideosUnlocked] = useState(false);
```

### **2. Detection Logic:**
```typescript
// Check if videos have audio (FFmpeg processed)
const videosWithAudio = approvedVideos.filter(v => v.audioUrl);
const videosWithoutAudio = approvedVideos.filter(v => !v.audioUrl);

// CASE 1: No processed videos → Process all directly
if (videosWithAudio.length === 0) {
  await batchProcessVideosWithWhisper(videosWithoutAudio);
  return;
}

// CASE 2: Some processed → Show selection popup
setUnprocessedVideos(videosWithoutAudio);
setProcessedVideos(videosWithAudio);
setSelectedUnprocessed(new Set(videosWithoutAudio.map(v => v.videoName)));
setShowVideoSelectionModal(true);
```

### **3. Selection Modal:**
- 2 groups with checkboxes
- Select/Deselect All buttons for unprocessed
- Unlock/Lock button for processed
- Start Processing button (shows count)
- Cancel button

### **4. Processing:**
```typescript
const selectedVideos = [
  ...unprocessedVideos.filter(v => selectedUnprocessed.has(v.videoName)),
  ...processedVideos.filter(v => selectedProcessed.has(v.videoName))
];

await batchProcessVideosWithWhisper(selectedVideos);
```

---

## 📊 User Flow

### **Scenario 1: First Time (No Processed Videos)**
1. Click "Autoprepare for Cutting"
2. **NO popup** → Directly opens ProcessingModal
3. Processes all videos
4. Shows progress bar

### **Scenario 2: Some Videos Already Processed**
1. Click "Autoprepare for Cutting"
2. **Selection popup appears**
3. See 2 groups:
   - Unprocessed (all selected, green)
   - Processed (disabled, grey, blue)
4. Options:
   - Process only unprocessed → Click "Start Processing"
   - Reprocess some processed → Click "Unlock" → Select → "Start Processing"
   - Cancel → Click "Cancel"
5. After selection → ProcessingModal opens
6. Shows progress bar

---

## 🎯 Benefits

### **1. Saves Time**
- Skip videos that are already processed
- No need to wait for re-processing

### **2. Saves FFmpeg API Calls**
- Avoid hitting rate limits
- Reduce 403 Forbidden errors

### **3. Flexible Reprocessing**
- Can still reprocess if needed
- Just unlock processed videos group

### **4. Better UX**
- Clear visual distinction (green vs blue)
- Easy to see what's processed vs not
- Similar to Step 9 (consistent UX)

---

## 🚀 Deployment

**Commit:** `93311a7`
```
feat: Add selective video processing popup for Step 7 Autoprepare

- Add video selection modal with 2 groups (unprocessed/processed)
- Unprocessed videos: selected by default, can select/deselect
- Processed videos: disabled by default, can unlock for reprocessing
- If no videos have audio, process all directly (no popup)
- If some have audio, show selection popup
- Similar UX to Step 9 Prepare for Merge
```

**Files Changed:**
- `client/src/pages/Home.tsx` (+198, -14)

---

## 🧪 Testing Checklist

### **Test 1: First Time (No Processed)**
- [ ] Go to Step 7
- [ ] All videos have NO audio
- [ ] Click "Autoprepare for Cutting"
- [ ] **Expected:** ProcessingModal opens directly (no selection popup)
- [ ] All videos processed

### **Test 2: Some Processed**
- [ ] Go to Step 7
- [ ] Some videos have audio, some don't
- [ ] Click "Autoprepare for Cutting"
- [ ] **Expected:** Selection popup appears
- [ ] Unprocessed group: all selected (green)
- [ ] Processed group: disabled (grey, blue)
- [ ] Click "Start Processing"
- [ ] Only unprocessed videos processed

### **Test 3: Reprocess Processed Videos**
- [ ] In selection popup
- [ ] Click "🔓 Unlock for Reprocessing"
- [ ] **Expected:** Processed checkboxes enabled
- [ ] Select some processed videos
- [ ] Click "Start Processing"
- [ ] Both unprocessed AND selected processed videos processed

### **Test 4: Select/Deselect All**
- [ ] In selection popup
- [ ] Click "Deselect All" for unprocessed
- [ ] **Expected:** All unprocessed deselected
- [ ] Click "Select All"
- [ ] **Expected:** All unprocessed selected again

### **Test 5: Cancel**
- [ ] In selection popup
- [ ] Click "Cancel"
- [ ] **Expected:** Popup closes, nothing processed

---

## 📝 Notes

- Detection uses `audioUrl` field (FFmpeg WAV output)
- Similar logic to Step 9 "Prepare for Merge"
- Processed videos stay locked by default (safe)
- User must explicitly unlock to reprocess

---

**Railway Deployment:** Auto-deployed via GitHub push  
**ETA:** ~5-10 minutes after commit

**Test after deployment with hard refresh!** 🚀
