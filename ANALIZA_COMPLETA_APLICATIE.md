# Analiză Completă - KIE Video Generator

## Rezumat General

**KIE Video Generator** este o aplicație full-stack complexă pentru generarea automată de videoclipuri publicitare folosind AI. Aplicația folosește React + TypeScript (frontend), Express + tRPC (backend), MySQL (bază de date), și integrează multiple API-uri externe (Kie.ai, OpenAI Whisper, FFMPEG API, BunnyCDN).

---

## 1. Arhitectura Tehnică

### Stack Tehnologic

| Componentă | Tehnologie |
|------------|------------|
| **Frontend** | React 19 + TypeScript + Vite 7 |
| **Styling** | TailwindCSS 4 + shadcn/ui |
| **Backend** | Express.js + TypeScript |
| **API Layer** | tRPC 11 (typesafe API) |
| **Bază de Date** | MySQL (Railway) + Drizzle ORM |
| **Package Manager** | pnpm |
| **Video Player** | react-player |
| **Waveform Editor** | Peaks.js + WaveSurfer.js |

### Structura Proiectului

```
kie-video-generator/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/       # Componente UI
│   │   │   ├── steps/       # Componente pentru fiecare step
│   │   │   ├── VideoEditorV2.tsx  # Editor video cu Peaks.js
│   │   │   └── ProcessingModal.tsx
│   │   ├── pages/
│   │   │   └── Home.tsx     # Componenta principală (workflow 9 steps)
│   │   └── lib/trpc.ts      # Client tRPC
│   └── index.html
├── server/                    # Backend Express
│   ├── _core/
│   │   ├── index.ts         # Entry point server
│   │   ├── trpc.ts          # Configurare tRPC
│   │   └── context.ts       # Context tRPC
│   ├── routers.ts           # API endpoints (tRPC)
│   ├── db.ts                # Funcții acces bază de date
│   ├── videoEditing.ts      # Procesare video (FFMPEG, Whisper)
│   ├── documentParser.ts    # Parsare documente .docx
│   └── hardcodedPrompts.ts  # Prompturi default
├── drizzle/                  # Schema bază de date
│   └── schema.ts
└── .env                      # Variabile de mediu
```

---

## 2. Baza de Date (MySQL + Drizzle ORM)

### Tabele Principale

#### **app_users** - Utilizatori aplicație
- `id`, `username`, `password` (plain text)
- `profileImageUrl`, `kieApiKey`, `openaiApiKey`, `ffmpegApiKey`, `cleanvoiceApiKey`
- Fiecare user poate avea propriile API keys

#### **context_sessions** - Sesiuni de lucru (CRUCIAL!)
- Stochează **tot workflow-ul** pentru fiecare context (TAM + Core Belief + Emotional Angle + Ad + Character)
- Câmpuri JSON:
  - `adLines` - liniile de text procesate
  - `prompts` - prompturile folosite
  - `images` - imaginile încărcate
  - `combinations` - combinații text + imagine + prompt
  - `videoResults` - rezultatele generării video
  - `hookMergedVideos`, `bodyMergedVideoUrl`, `finalVideos` - videoclipuri merge-uite
- Permite **salvare/restaurare automată** a progresului

#### **user_images** - Librărie imagini
- Imagini reutilizabile organizate pe `characterName`
- `imageUrl` (BunnyCDN), `imageName`, `displayOrder`

#### **user_prompts** - Librărie prompturi
- Prompturi default (`isDefault=1`) + custom
- `promptName`, `promptTemplate`

#### **Ierarhie Categorii** (5 niveluri)
1. **tams** (Target Audience Market)
2. **core_beliefs** (sub TAM)
3. **emotional_angles** (sub Core Belief)
4. **ads** (sub Emotional Angle)
5. **characters** (opțional, sub Ad)

---

## 3. Backend - API Endpoints (tRPC)

### Routere Principale

#### **appAuth** - Autentificare
- `register`, `login`, `getMe`, `updateProfile`
- Suportă API keys per user (Kie.ai, OpenAI, FFMPEG, CleanVoice)

#### **video** - Generare video
- `uploadImage` - upload imagine pe BunnyCDN
- `generateVideos` - apel Kie.ai API pentru generare batch
- `checkVideoStatus` - polling status taskuri Kie.ai
- `regenerateVideo` - regenerare video individual

#### **videoEditing** - Procesare video (Step 8)
- `processVideoForEditing` - pipeline complet:
  1. Upload video la FFMPEG API
  2. Extragere audio (MP3)
  3. Transcripție Whisper (word-level timestamps)
  4. Procesare CleanVoice (opțional)
  5. Generare waveform (audiowaveform)
  6. Detectare cut points automate
- `cutVideoWithFFmpegAPI` - tăiere video cu timestamps precise
- `batchProcessVideos` - procesare batch pentru toate videoclipurile

#### **contextSession** - Management sesiuni
- `getContextSession`, `upsertContextSession`, `deleteContextSession`
- Auto-save la fiecare modificare în UI

#### **CRUD Routers**
- `tams`, `coreBeliefs`, `emotionalAngles`, `ads`, `characters`
- `imageLibrary`, `promptLibrary`

---

## 4. Frontend - Workflow 9 Steps

### Componenta Principală: `Home.tsx`

Aceasta este **componenta monolitică** care gestionează tot workflow-ul. Conține:
- **~3000+ linii de cod**
- State management pentru toate cele 9 steps
- Auto-save în `context_sessions` la fiecare modificare
- Navigare liberă între steps (fără lock system)

### Workflow Detaliat

#### **Step 1: Prepare Text Ad**
- Selectare context: TAM → Core Belief → Emotional Angle → Ad → Character
- Upload document .docx / Paste text / Import Google Doc
- Procesare text cu `documentParser.ts`:
  - Identificare secțiuni (HOOKS, MIRROR, DCS, TRANZITION, NEW_CAUSE, MECHANISM, EMOTIONAL_PROOF, TRANSFORMATION, CTA)
  - Detectare text adăugat (roșu) cu `redStart`/`redEnd`
  - Generare `videoName` automat (ex: `T1_C1_E1_AD1_HOOK1_ALINA`)

#### **Step 2: Text Ad Lines**
- Afișare linii procesate cu secțiuni colorate
- Edit inline per linie
- DELETE linie + UNDO functionality
- Asociere `promptType` per linie (NEUTRAL/SMILING/CTA)

#### **Step 3: Prompts Configuration**
- Mod hardcoded (3 prompturi default)
- Mod custom (upload .docx cu prompturi)
- Mod manual (textarea)
- Prompturi stocate în `user_prompts`

#### **Step 4: Images Upload/Library**
- Upload imagini noi → BunnyCDN
- Selectare din librărie (`user_images`)
- Organizare pe `characterName`
- Marcare imagini CTA

#### **Step 5: Image-Line Mapping**
- Generare automată combinații: `adLine × image × prompt`
- Fiecare combinație = 1 video de generat
- DELETE combinații nedorite
- Preview combinații

#### **Step 6: Video Generation (Kie.ai API)**
- Batch generation cu Kie.ai API:
  - Model: `veo3_fast`
  - `generationType`: `FIRST_AND_LAST_FRAMES_2_VIDEO`
  - `aspectRatio`: `9:16`
- Polling status taskuri (pending → success/failed)
- Retry failed videos
- Modify & Regenerate cu custom prompts
- Duplicate videos (ex: `_D1`, `_D2`)

#### **Step 7: Review Generated Videos**
- Preview toate videoclipurile
- Accept / Regenerate per video
- Internal notes per video
- Filtrare: all / accepted / regenerate

#### **Step 8: Video Editing (VideoEditorV2 cu Peaks.js)**
**Aceasta este partea CRUCIALĂ pentru tine!**

##### Pipeline Procesare (backend):
1. **Upload video** la FFMPEG API
2. **Extragere audio** (MP3) → upload BunnyCDN (persistență)
3. **Transcripție Whisper** (OpenAI):
   - Word-level timestamps (milliseconds)
   - Full transcript
4. **CleanVoice** (opțional):
   - Reducere zgomot de fundal
   - Upload audio procesat → BunnyCDN
5. **Generare waveform** cu `audiowaveform`:
   - JSON format pentru Peaks.js
   - Upload → BunnyCDN
6. **Detectare automată cut points**:
   - Algoritm detectare text roșu în transcript
   - `startKeep`, `endKeep` (milliseconds)

##### UI VideoEditorV2:
- **Peaks.js** pentru vizualizare waveform
- **Markeri START/END** (draggable)
- **Playhead** (black marker) - sincronizat cu video
- **Lock system**:
  - START locked → salvează `startKeep` în DB
  - END locked → salvează `endKeep` în DB
- **Fine-tune controls**: +/- 10ms, 50ms, 100ms
- **Zoom** waveform (8s window default)
- **Video preview** sincronizat cu waveform
- **Debug info** (Whisper transcript, cut points, errors)
- **Reprocess** button pentru re-procesare video

##### Funcții Importante:
- `processVideoForEditing()` - pipeline complet backend
- `cutVideoWithFFmpegAPI()` - tăiere video cu FFMPEG API
- `onTrimChange()` - callback pentru salvare cut points în DB
- `onCutAndMerge()` - test merge 3 videoclipuri (prev + current + next)

#### **Step 9: Trimmed Videos**
- Afișare videoclipuri tăiate
- Accept / Recut per video
- Download individual / batch ZIP
- Merge final: HOOK + BODY combinations

---

## 5. Integrări API Externe

### **Kie.ai API** (Generare Video)
- Endpoint: `https://api.kie.ai`
- Model: `veo3_fast`
- Input: `prompt` + `imageUrls` + `aspectRatio`
- Output: `taskId` → polling status → `videoUrl`

### **OpenAI Whisper** (Transcripție Audio)
- Model: `whisper-1`
- Input: audio file (MP3)
- Output: word-level timestamps + full transcript
- Folosit pentru: detectare cut points automate

### **FFMPEG API** (Procesare Video)
- Endpoint: `https://api.ffmpeg-api.com`
- Funcții:
  - Upload video
  - Extragere audio (MP3)
  - Tăiere video (trim cu timestamps precise)
  - Merge videoclipuri

### **BunnyCDN** (Storage)
- Storage Zone: `manus-storage`
- Pull Zone: `https://manus.b-cdn.net`
- Foldere:
  - `audio-files/` - audio extras din videoclipuri
  - `trimmed-videos/` - videoclipuri tăiate
  - `user-{userId}/` - imagini utilizatori

### **CleanVoice API** (Reducere Zgomot)
- Procesare audio pentru calitate îmbunătățită
- Upload audio procesat → BunnyCDN

---

## 6. Audiowaveform - Instalare și Utilizare

### Instalare (COMPLETĂ!)
```bash
# Dependențe sistem
sudo apt-get install -y git make cmake gcc g++ \
  libmad0-dev libid3tag0-dev libsndfile1-dev \
  libgd-dev libboost-filesystem-dev \
  libboost-program-options-dev libboost-regex-dev

# Clone + build
cd /tmp
git clone https://github.com/bbc/audiowaveform.git
cd audiowaveform
mkdir build && cd build
cmake -DENABLE_TESTS=0 ..
make
sudo make install

# Verificare
audiowaveform --version
# Output: AudioWaveform v1.10.3
```

### Utilizare în Backend
```typescript
// Generare waveform JSON pentru Peaks.js
const waveformPath = `/tmp/waveform-${videoName}.json`;
await exec(`audiowaveform -i ${audioPath} -o ${waveformPath} --pixels-per-second 100 -b 8`);
const waveformJson = fs.readFileSync(waveformPath, 'utf-8');
```

---

## 7. Fluxul de Date - Step 8 (Video Editing)

### 1. User apasă "Process All Videos" în Step 8

### 2. Frontend → Backend: `batchProcessVideos`
```typescript
const result = await trpc.videoEditing.batchProcessVideos.mutate({
  userId: currentUser.id,
  videos: videoResults.map(v => ({
    videoName: v.videoName,
    videoUrl: v.videoUrl,
    text: v.text,
    redStart: v.redStart,
    redEnd: v.redEnd
  }))
});
```

### 3. Backend: Pipeline Procesare (per video)
```typescript
async function processVideoForEditing(
  videoUrl: string,
  videoName: string,
  text: string,
  redStart: number,
  redEnd: number,
  userApiKeys: { openai?, ffmpeg?, cleanvoice? }
): Promise<ProcessingResult>
```

**Pași:**
1. **Upload video** la FFMPEG API
2. **Extragere audio** (MP3) → download → upload BunnyCDN
3. **Transcripție Whisper**:
   ```typescript
   const transcription = await openai.audio.transcriptions.create({
     file: audioStream,
     model: 'whisper-1',
     response_format: 'verbose_json',
     timestamp_granularity: ['word']
   });
   ```
4. **CleanVoice** (dacă user are API key):
   - Upload audio la CleanVoice
   - Download audio procesat
   - Upload → BunnyCDN
5. **Generare waveform**:
   ```bash
   audiowaveform -i audio.mp3 -o waveform.json --pixels-per-second 100 -b 8
   ```
6. **Detectare cut points**:
   - Algoritm: caută text roșu în transcript Whisper
   - Returnează `startKeep`, `endKeep` (milliseconds)

### 4. Frontend: Update State + UI
```typescript
setVideoResults(prev => prev.map(v => 
  v.videoName === videoName ? {
    ...v,
    audioUrl: result.audioUrl,
    waveformData: result.waveformJson,
    words: result.words,
    cutPoints: result.cutPoints,
    whisperTranscript: result.whisperTranscript,
    editStatus: 'processed'
  } : v
));
```

### 5. User Editează în VideoEditorV2
- Drag START/END markers
- Lock markers → salvează în DB
- Fine-tune cu +/- 10ms

### 6. User apasă "Trim All Videos"
```typescript
await trpc.videoEditing.batchTrimVideos.mutate({
  videos: videoResults.map(v => ({
    videoName: v.videoName,
    videoUrl: v.videoUrl,
    cutPoints: v.cutPoints
  }))
});
```

### 7. Backend: Tăiere Video cu FFMPEG API
```typescript
async function cutVideoWithFFmpegAPI(
  videoUrl: string,
  startMs: number,
  endMs: number,
  outputFileName: string,
  ffmpegApiKey: string
): Promise<string>
```

**Pași:**
1. Upload video la FFMPEG API
2. Creare task trim:
   ```json
   {
     "file_path": "...",
     "start": 1.234,
     "end": 5.678,
     "output": "trimmed_video.mp4"
   }
   ```
3. Polling status task
4. Download video tăiat
5. Upload → BunnyCDN
6. Return public URL

---

## 8. Componente Cheie - Cod

### VideoEditorV2.tsx - Structură
```typescript
interface VideoEditorV2Props {
  video: {
    videoName: string;
    videoUrl: string;
    audioUrl: string;      // Audio extras (BunnyCDN)
    peaksUrl: string;      // Waveform JSON (BunnyCDN)
    cutPoints: { startKeep: number; endKeep: number };  // milliseconds
    duration: number;
    isStartLocked?: boolean;
    isEndLocked?: boolean;
  };
  onTrimChange?: (videoId, cutPoints, isStartLocked, isEndLocked) => void;
  onCutAndMerge?: (prev, current, next) => Promise<void>;
  onReprocess?: (videoName) => void;
}
```

**State Important:**
- `previewStart`, `previewEnd` - poziții markeri (milliseconds)
- `isStartLocked`, `isEndLocked` - status lock
- `peaksInstance` - instanță Peaks.js
- `trimSegment` - segment Peaks.js pentru markeri

**Funcții Cheie:**
- `initializePeaks()` - inițializare Peaks.js cu waveform JSON
- `handleStartLock()` - salvează `startKeep` în DB
- `handleEndLock()` - salvează `endKeep` în DB
- `handleFineTune()` - ajustare +/- milliseconds

### videoEditing.ts - Backend
```typescript
export async function processVideoForEditing(
  videoUrl: string,
  videoName: string,
  text: string,
  redStart: number,
  redEnd: number,
  userOpenAIKey?: string,
  userFFmpegKey?: string,
  userCleanVoiceKey?: string
): Promise<ProcessingResult>
```

**Return Type:**
```typescript
interface ProcessingResult {
  words: WhisperWord[];           // Word-level timestamps
  cutPoints: CutPoints | null;    // Auto-detected cut points
  whisperTranscript: any;         // Full Whisper response
  audioUrl: string;               // Audio URL (BunnyCDN)
  waveformJson: string;           // Waveform JSON data
  editingDebugInfo: EditingDebugInfo;  // Debug info
  cleanvoiceAudioUrl?: string;    // CleanVoice audio (optional)
}
```

---

## 9. Known Issues & Workarounds

### TypeScript Errors în Step Components
- **Fișiere:** `Step2.tsx`, `Step3.tsx`, `Step4.tsx`, `Step5.tsx`, `Step7.tsx`
- **Status:** 22 erori TypeScript, dar **NU afectează runtime**
- **Motiv:** Componente placeholder nefolosite în producție
- **Soluție:** Vite le ignoră la compilare

### Vite Dev Server Blocking
- **Simptom:** Server pornește dar nu răspunde la HTTP requests
- **Cauză:** Necunoscută (posibil issue Vite middleware)
- **Workaround:**
  ```bash
  killall node
  rm -rf node_modules/.vite
  pnpm run dev
  ```

### Database Connection
- **NU rula** `pnpm run db:push` - baza de date este deja configurată
- Connection string în `.env` → Railway MySQL

---

## 10. Comenzi Utile

### Development
```bash
cd /home/ubuntu/kie-video-generator
pnpm install
pnpm run dev
# Server: http://localhost:3000
```

### Git Push
```bash
git add .
git commit -m "Your message"
git push https://iorguletz-manus:YOUR_GITHUB_TOKEN@github.com/iorguletz-manus/kie-video-generator.git main
```

### Login Test
- **Username:** iorguletz
- **Password:** 1234

### Check Port
```bash
lsof -i :3000
kill -9 <PID>
```

---

## 11. Concluzie - Sunt Gata Să Codez!

**Am înțeles complet arhitectura aplicației:**

✅ **Stack tehnologic:** React + Express + tRPC + MySQL + Drizzle ORM  
✅ **Workflow 9 steps:** De la upload text ad până la videoclipuri tăiate  
✅ **Baza de date:** Schema completă cu `context_sessions` pentru auto-save  
✅ **API endpoints:** tRPC routers pentru video, editing, auth, CRUD  
✅ **Integrări externe:** Kie.ai, OpenAI Whisper, FFMPEG API, BunnyCDN  
✅ **VideoEditorV2:** Peaks.js + waveform + cut points + lock system  
✅ **Pipeline procesare:** Upload → Extract audio → Whisper → Waveform → Cut points → Trim  
✅ **Audiowaveform:** Instalat și funcțional (v1.10.3)  
✅ **Dependențe:** Toate instalate cu `pnpm install`  
✅ **Environment:** `.env` configurat cu toate API keys  

**Pot începe să lucrez la orice feature sau bug fix!**
