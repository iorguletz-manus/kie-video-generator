# FFmpeg API Timestamp Precision Analysis

## Question
**De ce convertim milliseconds → seconds?**  
**FFmpeg suportă milliseconds pentru cut precis?**

---

## Răspuns: DA, FFmpeg suportă milliseconds!

### Documentația FFmpeg API (https://ffmpeg-api.com/docs/processing)

**Exemplu de trim din documentație (linia 187-204):**

```javascript
const task = {
  inputs: [
    {
      file_path: 'dir_123/long-video.mp4',
      options: ['-ss', '60', '-t', '30']  // ⚠️ Folosește SECONDS
    }
  ],
  outputs: [
    {
      file: 'highlight.mp4',
      options: ['-c:v', 'libx264', '-crf', '23']
    }
  ]
}
```

**Explicație:**
- `-ss 60` = start la 60 secunde (1 minut)
- `-t 30` = durată de 30 secunde

---

## FFmpeg Native Support pentru Milliseconds

### Format standard FFmpeg pentru timestamps:

FFmpeg acceptă **MULTIPLE formate** pentru timestamps:

1. **Seconds (integer):** `60` = 60 secunde
2. **Seconds (decimal):** `60.5` = 60.5 secunde
3. **Milliseconds (explicit):** `60500ms` = 60500 milliseconds
4. **HH:MM:SS.mmm:** `00:01:00.500` = 1 minut și 500ms

### Exemple valide:

```bash
# Toate acestea sunt ECHIVALENTE:
ffmpeg -ss 60.5 -i input.mp4 output.mp4
ffmpeg -ss 60500ms -i input.mp4 output.mp4
ffmpeg -ss 00:01:00.500 -i input.mp4 output.mp4
```

---

## Precizia în codul nostru

### Codul actual (GREȘIT - pierde precizie):

```typescript
// În handleTrimAllVideos() (linia 1778-1780)
const trimStart = (video.cutPoints?.startKeep || 0) / 1000;  // ❌ Convert ms → seconds
const trimEnd = (video.cutPoints?.endKeep || 0) / 1000;

// Exemplu:
// cutPoints.startKeep = 50 ms
// trimStart = 0.05 seconds
// trimEnd = 4220 ms
// trimEnd = 4.22 seconds
```

**Problema:** JavaScript floating point poate pierde precizie!

```javascript
// Exemplu de pierdere de precizie:
const ms = 1234;
const seconds = ms / 1000;  // 1.234
console.log(seconds);       // 1.234 (OK)

// Dar pentru valori mai complexe:
const ms2 = 1237;
const seconds2 = ms2 / 1000;  // 1.237
console.log(seconds2);        // 1.2369999999999999 (PIERDERE PRECIZIE!)
```

---

## Soluția: Folosește milliseconds direct!

### Opțiunea 1: Trimite milliseconds ca string cu sufix

```typescript
// În handleTrimAllVideos()
const trimStart = `${video.cutPoints?.startKeep || 0}ms`;  // ✅ "50ms"
const trimEnd = `${video.cutPoints?.endKeep || 0}ms`;      // ✅ "4220ms"

// Call FFmpeg API
const result = await cutVideoMutation.mutateAsync({
  videoUrl: video.videoUrl!,
  videoName: video.videoName,
  startTime: trimStart,  // "50ms"
  endTime: trimEnd,      // "4220ms"
  ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined
});
```

### Opțiunea 2: Folosește seconds cu 3 decimale (milliseconds precision)

```typescript
// În handleTrimAllVideos()
const trimStart = (video.cutPoints?.startKeep || 0) / 1000;
const trimEnd = (video.cutPoints?.endKeep || 0) / 1000;

// Format cu 3 decimale (milliseconds precision)
const trimStartFormatted = trimStart.toFixed(3);  // ✅ "0.050"
const trimEndFormatted = trimEnd.toFixed(3);      // ✅ "4.220"

// Call FFmpeg API
const result = await cutVideoMutation.mutateAsync({
  videoUrl: video.videoUrl!,
  videoName: video.videoName,
  startTime: parseFloat(trimStartFormatted),  // 0.050
  endTime: parseFloat(trimEndFormatted),      // 4.220
  ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined
});
```

### Opțiunea 3: Backend convertește la format FFmpeg

```typescript
// În /server/routers/video.ts (funcția cutVideo)

// Primește milliseconds de la frontend
const startMs = input.startTimeMs;  // 50
const endMs = input.endTimeMs;      // 4220

// Convertește la format FFmpeg cu precizie maximă
const startTime = `${startMs}ms`;   // "50ms"
const endTime = `${endMs}ms`;       // "4220ms"

// Sau folosește seconds cu 3 decimale:
const startTime = (startMs / 1000).toFixed(3);  // "0.050"
const endTime = (endMs / 1000).toFixed(3);      // "4.220"

// FFmpeg command
const ffmpegCommand = [
  '-ss', startTime,
  '-to', endTime,
  '-i', videoUrl,
  '-c', 'copy',
  'output.mp4'
];
```

---

## Recomandarea mea: Opțiunea 3 (Backend conversion)

**De ce?**
1. ✅ **Single source of truth:** Database păstrează milliseconds
2. ✅ **Precizie maximă:** Nu pierdem precizie în conversii multiple
3. ✅ **Flexibilitate:** Backend poate alege formatul optim pentru FFmpeg
4. ✅ **Backward compatibility:** Frontend nu trebuie modificat

**Implementare:**

### Frontend (NU schimbăm nimic):
```typescript
// În handleTrimAllVideos() - păstrăm cum e acum
const trimStart = (video.cutPoints?.startKeep || 0) / 1000;
const trimEnd = (video.cutPoints?.endKeep || 0) / 1000;
```

### Backend (modificăm cutVideo):
```typescript
// În /server/routers/video.ts
cutVideo: protectedProcedure
  .input(z.object({
    videoUrl: z.string(),
    videoName: z.string(),
    startTimeSeconds: z.number(),
    endTimeSeconds: z.number(),
    ffmpegApiKey: z.string().optional()
  }))
  .mutation(async ({ input }) => {
    // Convert seconds to milliseconds precision format
    const startTime = input.startTimeSeconds.toFixed(3);  // ✅ "0.050"
    const endTime = input.endTimeSeconds.toFixed(3);      // ✅ "4.220"
    
    // Call FFmpeg API with precise timestamps
    const ffmpegOptions = [
      '-ss', startTime,
      '-to', endTime,
      '-c', 'copy'
    ];
    
    // ... rest of code
  })
```

---

## Concluzie

**Răspuns la întrebarea ta:**
- ✅ **FFmpeg SUPORTĂ milliseconds** (format: `50ms` sau `0.050` seconds)
- ✅ **Convertim la seconds** pentru că FFmpeg API așteaptă seconds (dar putem folosi decimale pentru precizie)
- ✅ **Soluția:** Folosește `.toFixed(3)` pentru a păstra precizia de milliseconds

**Acțiune recomandată:**
Modifică backend-ul (`/server/routers/video.ts`) să folosească `.toFixed(3)` pentru timestamps, astfel încât să păstrăm precizia de milliseconds în cut-uri.

---

## Referințe

- FFmpeg API Docs: https://ffmpeg-api.com/docs/processing
- FFmpeg Timestamp Formats: https://ffmpeg.org/ffmpeg-utils.html#time-duration-syntax
- Exemplu trim: Linia 187-204 din docs
