# STEP 8 - Video Trim Editor Implementation Plan

## Obiectiv
Implementare interfață de editare video cu timeline waveform (stil CapCut) pentru ajustare precisă a punctelor de tăiere (trim) folosind Peaks.js.

---

## 1. Backend - Audio Processing & Waveform Generation

### 1.1 Install audiowaveform CLI tool
```bash
# Ubuntu/Debian
sudo apt-get install audiowaveform

# Or build from source
git clone https://github.com/bbc/audiowaveform.git
cd audiowaveform
mkdir build && cd build
cmake ..
make && sudo make install
```

### 1.2 Modify `server/videoEditing.ts`

**Funcție nouă: `generateWaveformData()`**
```typescript
async function generateWaveformData(audioPath: string): Promise<string> {
  const outputPath = audioPath.replace('.wav', '.json');
  
  // Generate waveform JSON with audiowaveform CLI
  await exec(`audiowaveform -i "${audioPath}" -o "${outputPath}" --pixels-per-second 50 -b 8`);
  
  // Upload JSON to BunnyCDN (same as video/audio)
  const jsonUrl = await uploadToBunnyCDN(outputPath, 'waveforms');
  
  return jsonUrl;
}
```

**Modificare: `processVideoForEditing()`**
- După extragere audio cu FFmpeg
- Generează waveform JSON cu `generateWaveformData()`
- Returnează `peaks_url` în răspuns

**API Response Structure:**
```typescript
{
  video_id: string,
  video_url: string,
  audio_url: string,      // Already extracted for Whisper
  peaks_url: string,      // NEW - waveform JSON
  suggested_start: number, // From Whisper (seconds)
  suggested_end: number,   // From Whisper (seconds)
  duration: number,
  whisper_transcript: any
}
```

---

## 2. Database Schema Updates

### 2.1 Add columns to `video_results` table (if not exists)
```sql
ALTER TABLE video_results ADD COLUMN audio_url TEXT;
ALTER TABLE video_results ADD COLUMN peaks_url TEXT;
ALTER TABLE video_results ADD COLUMN trim_start REAL;  -- User-adjusted start (seconds)
ALTER TABLE video_results ADD COLUMN trim_end REAL;    -- User-adjusted end (seconds)
```

---

## 3. Frontend - New VideoEditor Component with Peaks.js

### 3.1 Install Dependencies
```bash
pnpm add peaks.js
pnpm add @types/peaks.js --save-dev
```

### 3.2 Create New Component: `VideoEditorV2.tsx`

**Imports:**
```typescript
import Peaks, { PeaksInstance, Segment } from 'peaks.js';
import ReactPlayer from 'react-player';
```

**Component Structure:**
```typescript
interface VideoEditorV2Props {
  video: {
    id: string;
    videoName: string;
    videoUrl: string;
    audioUrl: string;
    peaksUrl: string;
    suggestedStart: number;  // seconds
    suggestedEnd: number;    // seconds
    duration: number;
  };
  onTrimChange: (videoId: string, trimStart: number, trimEnd: number) => void;
}

export function VideoEditorV2({ video, onTrimChange }: VideoEditorV2Props) {
  const videoRef = useRef<ReactPlayer>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const zoomviewRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [peaksInstance, setPeaksInstance] = useState<PeaksInstance | null>(null);
  const [trimSegment, setTrimSegment] = useState<Segment | null>(null);
  const [trimStart, setTrimStart] = useState(video.suggestedStart);
  const [trimEnd, setTrimEnd] = useState(video.suggestedEnd);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Initialize Peaks.js on mount
  useEffect(() => {
    initializePeaks();
    return () => peaksInstance?.destroy();
  }, []);
  
  // ... implementation details below
}
```

---

## 4. Peaks.js Configuration

### 4.1 Initialize Peaks.js
```typescript
const initializePeaks = async () => {
  const options = {
    containers: {
      overview: overviewRef.current!,
      zoomview: zoomviewRef.current!,
    },
    mediaElement: audioRef.current!,  // Use audio element for waveform
    dataUri: {
      json: video.peaksUrl,  // Load waveform JSON
    },
    keyboard: true,
    pointMarkerColor: '#00ff00',
    showPlayheadTime: true,
    zoomLevels: [128, 256, 512, 1024, 2048, 4096],  // Fine zoom levels
  };
  
  Peaks.init(options, (err, peaks) => {
    if (err) {
      console.error('Peaks.js init error:', err);
      return;
    }
    
    setPeaksInstance(peaks);
    
    // Create initial trim segment
    const segment = peaks.segments.add({
      startTime: video.suggestedStart,
      endTime: video.suggestedEnd,
      editable: true,
      color: '#ff0000',
      labelText: 'TRIM',
    });
    
    setTrimSegment(segment);
    
    // Listen to segment updates
    peaks.on('segments.dragend', handleSegmentUpdate);
    peaks.on('segments.dragged', handleSegmentUpdate);
  });
};
```

### 4.2 Sync Video with Waveform
```typescript
// When user clicks in waveform → seek video
peaksInstance.on('player.seeked', (time: number) => {
  if (videoRef.current) {
    videoRef.current.seekTo(time, 'seconds');
  }
});

// When video plays → update waveform playhead
const handleVideoProgress = (state: { playedSeconds: number }) => {
  if (peaksInstance && audioRef.current) {
    audioRef.current.currentTime = state.playedSeconds;
  }
};
```

### 4.3 Handle Segment Updates
```typescript
const handleSegmentUpdate = (segment: Segment) => {
  setTrimStart(segment.startTime);
  setTrimEnd(segment.endTime);
  onTrimChange(video.id, segment.startTime, segment.endTime);
};
```

### 4.4 Manual Trim Markers
```typescript
const setStartMarker = () => {
  if (trimSegment && videoRef.current) {
    const currentTime = videoRef.current.getCurrentTime();
    trimSegment.update({ startTime: currentTime });
    setTrimStart(currentTime);
  }
};

const setEndMarker = () => {
  if (trimSegment && videoRef.current) {
    const currentTime = videoRef.current.getCurrentTime();
    trimSegment.update({ endTime: currentTime });
    setTrimEnd(currentTime);
  }
};
```

---

## 5. UI Layout

```tsx
<div className="video-editor-container">
  {/* Video Player */}
  <div className="video-player">
    <ReactPlayer
      ref={videoRef}
      url={video.videoUrl}
      onProgress={handleVideoProgress}
      width="100%"
      height="100%"
    />
  </div>
  
  {/* Hidden Audio Element for Peaks.js */}
  <audio ref={audioRef} src={video.audioUrl} style={{ display: 'none' }} />
  
  {/* Waveform Overview */}
  <div ref={overviewRef} className="waveform-overview" style={{ height: '80px' }} />
  
  {/* Waveform Zoomview */}
  <div ref={zoomviewRef} className="waveform-zoomview" style={{ height: '120px' }} />
  
  {/* Zoom Slider */}
  <input
    type="range"
    min="0"
    max="5"
    value={zoomLevel}
    onChange={(e) => {
      const level = parseInt(e.target.value);
      setZoomLevel(level);
      peaksInstance?.zoom.setZoom(level);
    }}
  />
  
  {/* Trim Controls */}
  <div className="trim-controls">
    <Button onClick={setStartMarker}>Set START</Button>
    <Button onClick={setEndMarker}>Set END</Button>
    <div>Start: {trimStart.toFixed(3)}s</div>
    <div>End: {trimEnd.toFixed(3)}s</div>
    <div>Duration: {(trimEnd - trimStart).toFixed(3)}s</div>
  </div>
</div>
```

---

## 6. Save Functionality

### 6.1 Update Home.tsx Step 8
```typescript
const handleSaveAllTrims = async () => {
  const trimData = videoResults
    .filter(v => v.reviewStatus === 'accepted')
    .map(v => ({
      video_id: v.id,
      trim_start: v.trimStart,
      trim_end: v.trimEnd,
    }));
  
  await saveVideoEditing.mutateAsync({ trimData });
  toast.success('✅ Trim points saved!');
};
```

### 6.2 Backend Save Endpoint
```typescript
// server/routers.ts
saveVideoEditing: protectedProcedure
  .input(z.object({
    trimData: z.array(z.object({
      video_id: z.string(),
      trim_start: z.number(),
      trim_end: z.number(),
    })),
  }))
  .mutation(async ({ input }) => {
    for (const trim of input.trimData) {
      await db.update(videoResults)
        .set({
          trim_start: trim.trim_start,
          trim_end: trim.trim_end,
        })
        .where(eq(videoResults.id, trim.video_id));
    }
    return { success: true };
  }),
```

---

## 7. Step 10 - FFmpeg Trim Execution

### 7.1 Use saved trim points
```typescript
const trimVideo = async (videoUrl: string, trimStart: number, trimEnd: number) => {
  const response = await fetch('https://ffmpeg-api.example.com/trim', {
    method: 'POST',
    body: JSON.stringify({
      video_url: videoUrl,
      start_time: trimStart,
      end_time: trimEnd,
    }),
  });
  
  const { trimmed_url } = await response.json();
  return trimmed_url;
};
```

---

## 8. Testing Checklist

- [ ] audiowaveform CLI installed and working
- [ ] Waveform JSON generated correctly
- [ ] Peaks.js loads waveform from JSON
- [ ] Click in waveform → video seeks to that position
- [ ] Video playback → waveform playhead moves
- [ ] Drag segment edges → trim values update
- [ ] "Set START" button → updates start marker to current video time
- [ ] "Set END" button → updates end marker to current video time
- [ ] Zoom slider → zooms waveform precisely
- [ ] Save → trim values persist in database
- [ ] Multiple videos → each has independent trim state

---

## 9. Known Issues & Solutions

### Issue: Video black screen
**Solution**: Check if `video.videoUrl` is valid and accessible. Add error handling in ReactPlayer.

### Issue: Waveform not loading
**Solution**: Verify `peaks_url` returns valid JSON. Check CORS headers on BunnyCDN.

### Issue: Sync lag between video and waveform
**Solution**: Use `progressInterval={50}` in ReactPlayer for smoother sync.

---

## 10. Next Steps

1. Install audiowaveform on server
2. Modify backend to generate waveform JSON
3. Create VideoEditorV2 component with Peaks.js
4. Test with single video
5. Deploy and test with multiple videos
6. Implement Step 10 FFmpeg trim execution

---

**Estimated Time**: 6-8 hours
**Priority**: High
**Dependencies**: audiowaveform CLI, peaks.js library
