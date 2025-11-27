# Whisper Processing Versions

This document explains the two different approaches for Whisper transcription and how to switch between them.

---

## 🔀 **Two Versions Available:**

### **Version 1: Whisper uses ORIGINAL VIDEO (main branch)**
```bash
git checkout main
```

**Flow:**
```
┌─────────────┐
│   VIDEO     │
└─────┬───────┘
      │
      ├──────────────┐
      │              │
      ▼              ▼
┌──────────┐   ┌──────────┐
│CleanVoice│   │ Whisper  │  ← Parallel!
│(→ WAV)   │   │(← VIDEO) │
└─────┬────┘   └─────┬────┘
      │              │
      └──────┬───────┘
             ▼
       ┌──────────┐
       │ Waveform │
       │(← WAV)   │
       └──────────┘
```

**Pros:**
- ✅ Faster (CleanVoice + Whisper run in parallel)
- ✅ Whisper gets original video quality

**Cons:**
- ❌ Whisper may transcribe background noise/breaths
- ❌ Requires video format support (mp4, webm, etc.)

---

### **Version 2: Whisper uses CLEANVOICE AUDIO (whisper-cleanvoice-audio branch)**
```bash
git checkout whisper-cleanvoice-audio
```

**Flow:**
```
┌─────────────┐
│   VIDEO     │
└─────┬───────┘
      │
      ▼
┌──────────┐
│CleanVoice│
│(→ WAV)   │
└─────┬────┘
      │
      ├──────────────┐
      │              │
      ▼              ▼
┌──────────┐   ┌──────────┐
│ Whisper  │   │ Waveform │  ← Parallel!
│(← WAV)   │   │(← WAV)   │
└──────────┘   └──────────┘
```

**Pros:**
- ✅ Whisper transcribes CLEAN audio (no breaths, no noise)
- ✅ Better transcription quality
- ✅ Same audio source for Whisper + Waveform

**Cons:**
- ❌ Slower (CleanVoice must finish first)
- ❌ Depends on CleanVoice quality

---

## 🔧 **How to Switch:**

### **Switch to Version 1 (Original Video):**
```bash
cd /home/ubuntu/kie-video-generator
git checkout main
# Server will auto-restart (tsx watch)
```

### **Switch to Version 2 (CleanVoice Audio):**
```bash
cd /home/ubuntu/kie-video-generator
git checkout whisper-cleanvoice-audio
# Server will auto-restart (tsx watch)
```

---

## 📊 **Performance Comparison:**

| Version | CleanVoice | Whisper | Waveform | Total Time |
|---------|------------|---------|----------|------------|
| **Version 1** | 15s | 15s (parallel) | 3s | ~18s |
| **Version 2** | 15s | 10s (after) | 3s (parallel) | ~25s |

---

## 🧪 **Testing:**

1. **Test Version 1:**
   ```bash
   git checkout main
   # Process 6 videos in Step 7
   # Check logs for "Whisper uses original video"
   ```

2. **Test Version 2:**
   ```bash
   git checkout whisper-cleanvoice-audio
   # Process 6 videos in Step 7
   # Check logs for "Whisper uses CleanVoice audio (WAV)"
   ```

3. **Compare Results:**
   - Transcription accuracy
   - Processing speed
   - Waveform quality

---

## 📝 **Current Branch:**
```bash
git branch
```

---

## 🔙 **Rollback:**
If something breaks, return to main:
```bash
git checkout main
```
