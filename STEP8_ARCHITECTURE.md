# STEP 8 - Video Editing Architecture Plan

## Overview
Step 8 allows users to trim approved videos from Step 7 by identifying and removing red text using Aeneas forced alignment. Users can adjust START/END timestamps with a visual timeline editor.

## Backend Functions

### 1. Audio Extraction
```typescript
async function extractAudioFromVideo(videoUrl: string): Promise<string> {
  // Download video from URL
  // Run: ffmpeg -i video.mp4 -vn -acodec pcm_s16le -ac 1 -ar 22050 audio.wav -y
  // Return: path to WAV file
}
```

### 2. Text Preparation
```typescript
async function prepareTextForAeneas(fullText: string): Promise<string> {
  // Split text into words
  // Write one word per line
  // Return: path to text file
}
```

### 3. Aeneas Alignment
```typescript
async function runAeneasAlignment(audioPath: string, textPath: string): Promise<AeneasJSON> {
  // Run: python3 -m aeneas.tools.execute_task audio.wav text.txt "task_language=ron|is_text_type=plain|os_task_file_format=json" output.json
  // Return: JSON with timestamps for each word
}
```

### 4. Red Text Detection
```typescript
async function findRedTextTimestamps(aeneasJSON: AeneasJSON, redText: string): Promise<{startTime: number, endTime: number}> {
  // Normalize words (remove punctuation, lowercase)
  // Find sequence of red words in fragments
  // Return: {startTime, endTime} in milliseconds
}
```

### 5. Cut Points Calculation
```typescript
async function calculateCutPoints(
  fragments: Fragment[],
  redTextRange: {start: number, end: number},
  marginMs: number = 50
): Promise<{startKeep: number, endKeep: number}> {
  // Determine if red text is at START or END
  // Calculate START_KEEP and END_KEEP with margin
  // Return: timestamps in milliseconds
}
```

### 6. Save to Database
```typescript
async function saveVideoEditData(
  videoId: number,
  aeneasJSON: string,
  startKeep: number,
  endKeep: number
): Promise<void> {
  // Save to videoResults table
  // Update editStatus to 'edited'
}
```

## Database Schema

### videoResults Table (Add new fields)
```sql
ALTER TABLE videoResults ADD COLUMN aeneasJSON TEXT;
ALTER TABLE videoResults ADD COLUMN startKeep INTEGER;  -- milliseconds
ALTER TABLE videoResults ADD COLUMN endKeep INTEGER;    -- milliseconds
ALTER TABLE videoResults ADD COLUMN trimmedVideoUrl TEXT;
ALTER TABLE videoResults ADD COLUMN editStatus TEXT DEFAULT 'pending';  -- 'pending' | 'edited' | 'trimmed'
```

## Frontend UI Components

### VideoEditingPage.tsx
- List of approved videos from Step 7
- Video player with timeline editor
- START/END sliders with live preview
- Aeneas detection log
- Save & Next button

### Timeline Editor Features
- Visual waveform (wavesurfer.js)
- Draggable START/END markers
- Live video seek when dragging
- Display current time and duration
- Highlight red text region
- Reset button to restore Aeneas detection

### Video Library Choice
**Recommended: video.js + wavesurfer.js**
- ✅ Waveform visualization
- ✅ Precise frame-by-frame seeking
- ✅ Thumbnail preview on hover
- ✅ Custom markers for START/END
- ✅ Live preview during drag

**Alternative: React Player + rc-slider**
- ✅ Simpler implementation
- ✅ No waveform (just slider)
- ✅ Good for basic timeline

## User Flow

1. **Enter Step 8** from Step 7 (click "Video Editing" button)
2. **Load approved videos** (status='approved' from Step 7)
3. **For each video:**
   - Click "Process with Aeneas" button
   - Backend: extract audio → run Aeneas → detect red text → calculate cut points
   - Frontend: display timeline with pre-set START/END
4. **Adjust sliders:**
   - Drag START marker → video seeks to START position
   - Drag END marker → video seeks to END position
   - Live preview updates instantly
5. **Save:**
   - Click "Save & Next"
   - Save startKeep/endKeep to database
   - Mark as editStatus='edited'
   - Move to next video
6. **Finish:**
   - All videos edited
   - Button "Go to Step 9" appears

## API Endpoints

### POST /api/video-editing/process
```typescript
{
  videoId: number,
  videoUrl: string,
  fullText: string,
  redText: string,
  marginMs?: number  // default 50
}
→ Response: {
  aeneasJSON: string,
  startKeep: number,
  endKeep: number,
  redTextPosition: 'START' | 'END'
}
```

### POST /api/video-editing/save
```typescript
{
  videoId: number,
  startKeep: number,
  endKeep: number,
  aeneasJSON: string
}
→ Response: { success: boolean }
```

### GET /api/video-editing/list
```typescript
{
  userId: number,
  contextSessionId: number
}
→ Response: {
  videos: Array<{
    id: number,
    videoUrl: string,
    fullText: string,
    redText: string,
    startKeep: number | null,
    endKeep: number | null,
    editStatus: string
  }>
}
```

## Dependencies to Install

### Backend
```bash
pip install aeneas
apt-get install ffmpeg espeak libespeak-dev
```

### Frontend
```bash
pnpm add video.js wavesurfer.js
pnpm add @types/video.js
```

## Implementation Phases

1. ✅ Add "Video Editing" button in Step 7
2. ✅ Create Step 8 route and page
3. ✅ Install Aeneas in backend
4. ✅ Implement backend functions (extract audio, run Aeneas, detect red text)
5. ✅ Add database schema for timestamps
6. ✅ Create UI with video player and timeline
7. ✅ Implement live preview with sliders
8. ✅ Test and deploy

## Notes

- **Aeneas accuracy**: ~95% accurate, hence manual adjustment needed
- **Margin**: 50ms default (natural breath after word)
- **Video format**: MP4 with H.264 codec
- **Audio format**: WAV mono 22050Hz for Aeneas
- **Timestamps**: Store in milliseconds for precision
- **Step 9**: Will use startKeep/endKeep to trim videos with FFmpeg
