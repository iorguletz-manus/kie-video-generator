# Project TODO

## Completed Features
- [x] Adăugare API KEY Kie.ai ca secret în proiect
- [x] Implementare endpoint pentru upload imagine pe Manus CDN
- [x] Implementare endpoint pentru generare video cu Kie.ai API
- [x] Implementare endpoint pentru verificare status video
- [x] Configurare cache în memorie pentru taskId-uri
- [x] Design interfață albastră cu tema personalizată
- [x] Implementare text area pentru prompt video
- [x] Implementare upload de imagine cu preview
- [x] Implementare buton "Generate Video"
- [x] Afișare loading state după generare (așteptare taskId)
- [x] Afișare buton "Check Video Status" după primirea taskId
- [x] Afișare link video extern când video este gata
- [x] Gestionare stări: pending, success, failed
- [x] Testare flow complet de generare video
- [x] Testare upload imagine
- [x] Testare verificare status
- [x] Verificare design albastru
- [x] Creare checkpoint final
- [x] Rezolvare eroare "You do not have access permissions" - API KEY cu litere mici
- [x] Redimensionare thumbnail imagine la max 150px
- [x] Corectare extragere URL din output manus-upload-file
- [x] Adăugare variabile de mediu pentru manus-upload-file
- [x] Adăugare logging detaliat pentru debugging
- [x] Fix verificare status video - folosește successFlag și resultUrls

## New Advanced Features - Multi-Step Workflow

### STEP 1 - Text Ad Upload
- [x] Implementare drag & drop pentru upload document ad (.docx)
- [x] Parser document ad: extrage linii text și elimină keywords (HOOKS, H1-HX, MIRROR, etc.)
- [x] Elimină contoare caractere (ex: "- 119 chars")
- [x] Salvare linii text procesate în state

### STEP 2 - Prompt Upload
- [x] Implementare drag & drop pentru upload document prompt (.docx)
- [x] Parser document prompt: găsește zona "Dialogue: [INSERT TEXT]"
- [x] Funcție pentru înlocuire [INSERT TEXT] cu linie din ad
- [x] Textarea editabilă pentru prompt manual (opțional)

### STEP 3 - Images Upload
- [x] Implementare drag & drop multi-imagine "Drop image here"
- [x] Afișare thumbnail-uri pentru fiecare imagine
- [x] Buton X pentru ștergere imagine cu AJAX
- [x] Suport pentru multiple imagini

### STEP 4 - Mapping
- [x] Buton "Mapare" pentru creeare combinații text-imagine
- [x] Afișare listă cu toate liniile din ad
- [x] Selector imagine pentru fiecare linie (thumbnail în stânga)
- [x] Textarea editabilă pentru fiecare linie
- [x] Buton delete pentru fiecare combinație
- [x] Statistici: număr total videouri de generat
- [x] Preview combinații înainte de generare

### STEP 5 - Generate Videos
- [x] Generare paralelă multiple videouri
- [x] Progress bar pentru fiecare video în generare
- [x] Afișare status individual pentru fiecare video
- [x] Lista cu toate videouri generate (cu link-uri)
- [x] Buton download pentru fiecare video

## Backend Implementation
- [x] Endpoint pentru parsare document .docx (ad)
- [x] Endpoint pentru parsare document .docx (prompt)
- [x] Endpoint pentru generare paralelă multiple videouri
- [x] Sistem de queue pentru gestionare generări multiple (Promise.allSettled)
- [x] Cache pentru tracking status multiple videouri (videoCache.ts existent)

## Frontend Implementation
- [x] Design cu 5 pași vizibili (STEP 1 - STEP 5)
- [x] Delimitare vizuală între pași
- [x] Componente drag & drop reutilizabile
- [x] Gestionare state complex pentru workflow
- [x] Validare la fiecare pas înainte de a trece la următorul


## New Improvements & Bug Fixes

### UI/UX Improvements
- [x] Fix buton verifică status: afișează buton "Download" când video este success
- [x] Culori status: roșu (failed), portocaliu (pending), verde (success)
- [x] Afișare link video când status = success
- [x] Text suport format gri italic pentru toate step-urile (ex: "Suportă .docx, .doc")
- [x] Thumbnail-uri 9:16 peste tot (nu 16:9)
- [x] Buton UNDO la ștergere combinație în step 4
- [x] Statistici jos deasupra butonului "Generează X videouri"

### Navigation & Breadcrumbs
- [x] Implementare breadcrumbs navigabile
- [x] Click pe breadcrumb pentru navigare directă
- [x] Buton back pentru navigare înapoi
- [x] Ascundere step completat când se trece la următorul
- [x] Afișare doar step curent + breadcrumbs

### Multi-Prompt System
- [x] Upload 3 prompturi în step 2 (în loc de 1)
- [x] Salvare nume document pentru fiecare prompt
- [x] Select prompt la mapare (în loc de textarea)
- [x] Denumiri prompturi: $PROMPT_NEUTRAL, $PROMPT_SMILING, $PROMPT_CTA

### Intelligent Mapping
- [x] Detectare secțiuni în document ad (HOOKS, TRANSFORMATION, CTA, etc.)
- [x] Mapare automată: secțiuni până la TRANSFORMATION → $PROMPT_NEUTRAL
- [x] Mapare automată: TRANSFORMATION + CTA → $PROMPT_SMILING
- [x] Mapare automată: CTA cu keywords "carte"/"cartea" → $PROMPT_CTA
- [x] Backend: funcție pentru detectare secțiune din linie text


## Critical Bug Fixes & Improvements

### Prompt Matching
- [x] Fix căutare prompt: verifică numele exact (nu includes, ci match exact sau partial corect)
- [x] Asigură că prompturile cu nume "neutral", "smiling", "cta" sunt găsite corect

### CTA Image Mapping Intelligence
- [x] Detectare poze cu "CTA" în nume fișier
- [x] Mapare automată: poze CTA → linii cu "carte"/"cartea"
- [x] După prima linie cu carte, toate liniile de jos primesc aceeași poză CTA by default

### Image Ordering
- [x] Ordonare poze în perechi: normale + CTA (ex: Alina_1, Alina_1CTA, Alina_2, Alina_2CTA)
- [x] Algoritm sortare: grupează după prefix, apoi pune CTA după normală

### UI Fixes
- [x] Thumbnail-uri 50% mai mici la step 3 (w-1/2 în loc de w-full)
- [x] Thumbnail-uri 50% mai mici la step 4 (w-16 în loc de w-32)
- [x] Text editabil la step 4 (textarea în loc de div grey)
- [x] Selector imagine: afișează numele real al fișierului (img.fileName)
- [x] Salvare nume fișier original pentru fiecare imagine (fileName + isCTA)
