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


## New Features: STEP 6 & STEP 7

### STEP 6 - Check Videos
- [x] Layout 3 coloane pentru video players (grid responsive)
- [x] Încărcare videouri direct de pe URL Kie.ai (nu download local)
- [x] Afișare nume video deasupra player-ului
- [x] Afișare text dialogue sub nume
- [x] Organizare videouri pe categorii (HOOKS, MIRROR, DCS, TRANZITION, NEW_CAUSE, MECHANISM, EMOTIONAL_PROOF, TRANSFORMATION, CTA)
- [x] Nume categorie bold pentru separare vizuală
- [x] Buton verde "ACCEPT" pentru fiecare video
- [x] Buton roșu "REGENERATE" pentru fiecare video
- [x] Buton "UNDO" global pentru anulare ultima acțiune
- [x] Sistem de tracking status: accepted/regenerate/pending
- [x] Breadcrumbs actualizat cu STEP 6
- [x] Buton "Check Videos" la STEP 5 pentru tranziție

### Video Naming Convention
- [ ] Format nume: "CB1_A1_$CATEGORY$NUMBER" (ex: "CB1_A1_MIRROR1", "CB1_A1_TRANZITION1")
- [ ] Extragere număr categorie din document (MIRROR1 → 1, TRANZITION2 → 2)
- [ ] Excepție HOOKS: H3 cu 2 propoziții → "CB1_A1_HOOK3" și "CB1_A1_HOOK3B"
- [ ] Adăugare litere A, B, C, D pentru videouri multiple din aceeași categorie
- [ ] Salvare mapping categorie → număr din document

### STEP 7 - Regenerate
- [ ] Afișare doar videouri marcate pentru regenerare
- [ ] Selector prompt: alegere din liste sau manual
- [ ] Textarea pentru modificare prompt existent
- [ ] Selector imagine: schimbare poză pentru regenerare
- [ ] Radio button "Vrei să regenerezi mai multe videouri?" (Da/Nu, default: Nu)
- [ ] Când Da: selector număr regenerări (1-10)
- [ ] Afișare formulare multiple pentru fiecare variantă
- [ ] Buton "Regenerate" cu același proces ca Generate
- [ ] Tracking iterații regenerare până când toate sunt acceptate
- [ ] Buton download individual și bulk la final

### STEP 1 Improvements
- [x] Calcul live număr caractere pentru fiecare paragraf (charCount)
- [ ] Update dinamic la editare text (nu e cazul - nu se editează)
- [x] Afișare text roșu pentru anumite cuvinte/fraze (SKIP - limitați HTML)
- [x] Detectare și styling automat pentru text marcat roșu (SKIP)

### Final Step - Download All
- [ ] Afișare toate videouri acceptate cu check verde
- [ ] Buton download individual pentru fiecare video
- [ ] Buton "Descarcă toate" pentru bulk download
- [ ] Export CSV cu toate detaliile (nume, text, categorie, URL)


## Bug Fix
- [x] Fix keywords to remove: suport pentru orice număr HOOKS (H1-H999, nu doar H1-H9)


## New Bug Fixes & Improvements (Latest)

### STEP 2 - Prompturi
- [x] Hardcodare 3 prompturi din documente atașate (server/hardcodedPrompts.ts)
- [x] Opțiune să adaugi noi prompturi sau să folosești cele hardcodate (toggle button)
- [x] Skip STEP 2 dacă folosești prompturile hardcodate (buton direct la STEP 3)

### STEP 1 - UI
- [x] Padding mai mare la zona "STEP 1 - Text Ad Upload" (pt-8 px-8 pb-8)

### STEP 3 - Layout Imagini
- [x] Fix layout: X pe imagine (absolute top-1 right-1)
- [x] Poze una lângă alta (grid-cols-3 md:grid-cols-6)
- [x] Bug: upload imagine nu funcționează - fix cu Promise.all pentru așteptare corectă

### STEP 4 - Mapare
- [x] Text roșu în textarea pentru cuvinte importante (SKIP - limitați HTML textarea)
- [x] Fix mapare CTA: poze cu "CTA" în nume → DOAR pe text cu "carte"/"rescrie"/"lacrimi"
- [x] Dacă nu e "carte"/"rescrie"/"lacrimi", folosește poză fără CTA

### STEP 5 - Generate
- [x] Afișare nume prompt folosit lângă taskId și text
- [x] Auto-check status la 80 secunde după generare (useEffect)
- [x] Apoi check din 10 în 10 secunde până la success/failed (setInterval)
- [x] Update automat UI fără să apese user "Verifică Status"
- [x] Success → checkbox verde + text "Success" (fundal verde)
- [x] Failed → buton "Regenerate" în loc de "Verifică Status" (buton roșu)
- [ ] Click pe "Regenerate" → pornește proces nou de generare (placeholder)

### STEP 6 - Video Player
- [x] Fix video player să apară și să funcționeze (tag <video> cu controls)
- [x] Butoane Accept/Regenerate mai mici (size="sm", text-xs, py-1)


## New User Requests - Fix STEP 2, 3, 4

### STEP 2 - Prompturi
- [x] Prompturile hardcodate (NEUTRAL, SMILING, CTA) sunt ÎNTOTDEAUNA active
- [x] Utilizatorul poate adăuga și prompturi manual (nu mai e toggle on/off)
- [x] Afișare prompturi hardcodate + prompturi custom împreună

### STEP 3 - UI Imagini
- [x] Thumbnail-uri 50% mai mici decât sunt acum (grid-cols-4 md:grid-cols-8)
- [x] X-uri mai mari și mai frumoase pentru ștergere imagine (w-5 h-5, hover:scale-110)

### STEP 4 - Validare
- [x] Fix eroare "te rog adaugă cel puțin un prompt" care blochează trecerea la STEP 4
- [x] Validare corectă: acceptă prompturi hardcodate ca valide
- [x] Backend: suport HARDCODED_PROMPT_TYPE pentru a folosi prompturi hardcodate automat


## New User Requests - Fix STEP 5 & 6

### STEP 6 - Video Player
- [x] Fix încărcare videouri de la STEP 5 în STEP 6 (filtrare cu videoUrl)
- [x] Layout corect: TITLE → Text → VIDEO PLAYER → Butoane Accept/Regenerate
- [x] Video player funcțional pentru fiecare video generat

### STEP 5 - Auto-check Status
- [x] Verificare cod: primul check la 80 secunde după generare (există deja)
- [x] Check-uri ulterioare din 10 în 10 secunde (există deja)
- [x] Video DONE: border verde + mesaj "Generated" (verde frumos) în loc de buton
- [x] Video FAILED: mesaj roșu cu eroarea exactă primită de la Kie.ai
- [x] Afișare eroare: "Rejected by Google's content policy..." cu roșu

### STEP 5 - Regenerate Failed
- [x] Buton "Regenerate ALL Failed" jos deasupra "Check Videos"
- [ ] Regenerare automată toate videouri failed (placeholder implementat)
- [x] Buton "Modify & Regenerate" pentru fiecare video failed
- [x] Modal/Form pentru Modify & Regenerate cu:
  - [x] Select prompt (NEUTRAL/SMILING/CTA)
  - [x] Textarea editabil prompt (temporar, nu modifică hardcoded)
  - [x] Textarea editabil text
  - [x] Char count live când scrii/ștergi
  - [x] Text roșu "125 caractere depășite!" când depășește 125


## New User Requests - Fix Drag & Drop, STEP 4, STEP 5

### STEP 1 & 2 - Drag & Drop Fix
- [x] Adăugare buton "Șterge document" pentru a putea șterge documentul încărcat (STEP 1)
- [x] Permite re-upload document după ștergere (STEP 1)
- [x] Fix funcționalitate drag & drop pentru re-upload (STEP 1)
- [x] Buton "Șterge toate" pentru prompturi custom (STEP 2)

### STEP 4 - Auto-select PROMPT_CTA
- [x] Regula automată: dacă textul conține "carte", "cartea", "rescrie", "lacrimi" → selectează PROMPT_CTA by default
- [x] Verificare case-insensitive pentru cuvinte cheie
- [x] Modificare getPromptForSection() în documentParser.ts

### STEP 4 - UNDO Fix
- [x] Când faci UNDO, secțiunea ștearsă apare exact în locul original (nu la final)
- [x] Salvare index original pentru fiecare secțiune ștearsă (originalIndex)
- [x] Restaurare cu splice() la poziția corectă

### STEP 5 - Check Status Fix
- [x] Schimbare: check din 10 în 10 secunde de la început (nu 80s)
- [x] Fix buton "Verifică Status" - adăugare console.log pentru debugging
- [x] Afișare eroare completă de la Kie.ai cu roșu (errorMessage din response)
- [x] Toast notifications pentru success/failed/pending


## New User Request - Implementare Funcționalitate Regenerare

### Regenerate Simplu (Individual)
- [x] Buton "Regenerate" pentru fiecare video failed
- [x] Retrimite video cu aceleași setări (text, imagine, prompt type)
- [x] Actualizare videoResults cu nou taskId
- [x] Reset status la 'pending' pentru video regenerat
- [x] Toast notification "Video retrimis pentru generare"
- [x] Funcție regenerateSingleVideo() implementată

### Regenerate ALL Failed (Batch)
- [x] Buton "Regenerate ALL Failed" jos deasupra "Check Videos"
- [x] Retrimite toate videouri failed în batch
- [x] Folosește același endpoint generateBatchVideos
- [x] Actualizare videoResults pentru toate videouri failed
- [x] Toast notification cu număr videouri retrimise
- [x] Funcție regenerateAllFailed() implementată
- [x] Loading state cu Loader2 pe buton

### Modify & Regenerate
- [x] Form expandabil cu toate opțiunile:
  - [x] Select Prompt Type (NEUTRAL/SMILING/CTA)
  - [x] Textarea prompt custom (opțional, override hardcoded)
  - [x] Textarea text dialogue (editabil)
  - [x] Char count live cu validare 125 caractere
- [x] Buton "Regenerate" care trimite cu setări modificate
- [x] Actualizare videoResults cu nou taskId
- [x] Actualizare combinations cu text și promptType modificate
- [x] Închidere form după regenerare
- [x] Toast notification "Video retrimis cu modificări"
- [x] Funcție regenerateWithModifications() implementată
- [x] Validare: disable buton dacă text > 125 caractere sau gol
- [x] Loading state cu Loader2 pe buton


## New User Request - STEP 2 Textarea Manual, STEP 7 Regenerare Avansată, STEP 6 Download

### STEP 2 - Textarea Manual Prompt
- [x] Adăugare textarea pentru prompt manual (pe lângă upload .docx)
- [x] Utilizatorul poate scrie direct promptul în textarea
- [x] Buton "Adaugă Prompt Manual" care salvează prompt în listă
- [x] Validare: prompt trebuie să conțină [INSERT TEXT]
- [x] Afișare prompt manual în lista de prompturi cu nume generic "Custom Prompt #N"
- [x] Fix TypeScript: UploadedPrompt.file poate fi null pentru prompturi manuale

### STEP 7 - Regenerare Avansată (NOU STEP)
- [ ] Creare STEP 7 între STEP 5 și STEP 6
- [ ] Afișare doar videouri care trebuie regenerate (failed sau selectate manual)
- [ ] Pentru fiecare video:
  - [ ] Select prompt din cele existente (hardcoded NEUTRAL/SMILING/CTA + custom)
  - [ ] SAU textarea prompt manual
  - [ ] SAU select prompt + textarea pentru modificare prompt
  - [ ] Select imagine diferită (dropdown cu toate imaginile)
  - [ ] Textarea editabil pentru text cu char count (125 max)
- [ ] Radio button "Vrei să regenerezi mai multe videouri?" (Da/Nu, default: Nu)
  - [ ] Dacă Nu: o singură variantă
  - [ ] Dacă Da: selector număr variante (1-10)
  - [ ] Pentru fiecare variantă: prompt, textarea, text, imagine independente
- [ ] Buton "Regenerate" care trimite toate variantele
- [ ] După regenerare: rămâi în STEP 7 pentru iterații multiple
- [ ] Buton "Finalizare" pentru a trece la STEP 6 când toate sunt OK

### STEP 6 - Îmbunătățiri Download
- [ ] Afișare toate videouri cu status vizual (verde check pentru acceptate)
- [ ] Buton download individual pentru fiecare video
- [ ] Buton "Download All Accepted Videos" pentru toate videouri acceptate
- [ ] Download cu nume corect (CB1_A1_MIRROR1.mp4, etc.)
