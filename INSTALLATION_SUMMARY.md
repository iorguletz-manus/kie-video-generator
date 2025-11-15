# Instalare kie-video-generator - Rezumat

## Status Instalare

✅ **Repository clonat cu succes** de pe GitHub  
✅ **Dependențe instalate** folosind pnpm  
✅ **Fișier .env creat** cu configurația de bază  

## Detalii Proiect

**Nume:** kie-video-generator  
**Locație:** `/home/ubuntu/kie-video-generator`  
**Repository:** `iorguletz-manus/kie-video-generator`  
**Package Manager:** pnpm v10.4.1  

## Tehnologii Utilizate

- **Frontend:** React 19, Vite, TailwindCSS, Radix UI
- **Backend:** Express.js, tRPC
- **Database:** MySQL (Drizzle ORM)
- **Autentificare:** OAuth + sistem propriu de username/password
- **API:** OpenAI, Kling AI (video generation)

## Structura Proiectului

```
kie-video-generator/
├── client/          # Frontend React
├── server/          # Backend Express + tRPC
├── drizzle/         # Database schema și migrații
├── shared/          # Cod partajat între client și server
├── prompts/         # Template-uri pentru generare video
└── patches/         # Patch-uri pentru dependențe
```

## Configurare Necesară

Am creat un fișier `.env` cu următoarele variabile care trebuie configurate:

### Obligatorii pentru funcționare completă:

1. **DATABASE_URL** - Connection string MySQL
   - Format: `mysql://user:password@host:port/database`
   - Aplicația folosește MySQL cu Drizzle ORM
   - Schema include tabele pentru: users, app_users, app_sessions, user_images, user_prompts

2. **JWT_SECRET** - Secret pentru encriptarea cookie-urilor
   - Deja setat: `kie-video-generator-secret-key`
   - Poate fi schimbat cu o valoare mai sigură

### Opționale (pentru funcții avansate):

3. **OAUTH_SERVER_URL** - URL server OAuth Manus
4. **VITE_APP_ID** - ID aplicație pentru OAuth
5. **OWNER_OPEN_ID** - OpenID proprietar
6. **BUILT_IN_FORGE_API_URL** - URL API Forge
7. **BUILT_IN_FORGE_API_KEY** - Cheie API Forge

### Notă importantă:
- Aplicația are hardcodat în cod un **Kling API Key**: `a4089052f1c04c6b8be02b026ce87fe8`
- Acest key este folosit pentru generarea de video-uri

## Comenzi Disponibile

```bash
# Dezvoltare (cu hot reload)
pnpm dev

# Build pentru producție
pnpm build

# Rulare în producție
pnpm start

# Type checking
pnpm check

# Formatare cod
pnpm format

# Teste
pnpm test

# Database migrations
pnpm db:push
```

## Pași Următori pentru Rulare

### 1. Configurare Database

Aplicația necesită o bază de date MySQL. Opțiuni:

**A. Instalare MySQL local:**
```bash
sudo apt update
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo mysql -e "CREATE DATABASE kie_video_generator;"
sudo mysql -e "CREATE USER 'kieuser'@'localhost' IDENTIFIED BY 'password123';"
sudo mysql -e "GRANT ALL PRIVILEGES ON kie_video_generator.* TO 'kieuser'@'localhost';"
```

Apoi actualizează `.env`:
```
DATABASE_URL=mysql://kieuser:password123@localhost:3306/kie_video_generator
```

**B. Folosire MySQL cloud** (PlanetScale, Railway, etc.)

### 2. Rulare Migrații Database

```bash
cd /home/ubuntu/kie-video-generator
pnpm db:push
```

### 3. Pornire Aplicație

```bash
cd /home/ubuntu/kie-video-generator
pnpm dev
```

Aplicația va porni pe portul **3000** (sau următorul disponibil).

## Funcționalități Aplicație

Bazat pe schema database și cod:

1. **Autentificare duală:**
   - OAuth Manus (pentru integrare cu platforma Manus)
   - Username/Password propriu (stocat în `app_users`)

2. **Sesiuni de lucru:**
   - Fiecare user poate avea multiple sesiuni
   - Sesiunile conțin date JSON pentru generare video
   - Nume sesiune cu timestamp (ex: "Campanie Black Friday - 14 Nov 2025 14:45")

3. **Bibliotecă imagini:**
   - Upload și stocare imagini pentru reutilizare
   - Grupare pe personaje/avatare (ex: "Alina", "Unnamed")
   - Stocare în S3/BunnyCDN

4. **Bibliotecă prompturi:**
   - Prompturi default (PROMPT_NEUTRAL, PROMPT_SMILING, PROMPT_CTA)
   - Prompturi custom create de utilizatori
   - Template-uri pentru generare video

5. **Generare video:**
   - Integrare cu Kling AI API
   - Generare video din text și imagini
   - Calitate 1080p, 5-10 secunde

## Probleme Potențiale

1. **Database lipsă** - Aplicația nu va porni fără DATABASE_URL valid
2. **Kling API Key** - Verifică dacă key-ul hardcodat este încă valid
3. **Port 3000 ocupat** - Aplicația va încerca automat următoarele 20 de porturi

## Informații Adiționale

- **Fișiere de analiză:** `ANALYSIS.md`, `ANALYSIS_COMPLETE.md`, `todo.md`
- **Test backend:** `test-backend.mjs` pentru testare API
- **Patches:** Aplicația folosește un patch pentru `wouter@3.7.1`

---

**Data instalării:** 15 Noiembrie 2025  
**Instalat de:** Manus AI Assistant
