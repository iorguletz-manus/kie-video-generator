# STEP 1 Text Processing - Complete Documentation

## 🔴 PROBLEMA IDENTIFICATĂ

**Upload-ul nu funcționează pentru documente Word (.docx)!**

Frontend-ul acceptă DOAR fișiere `.txt`:
```typescript
accept=".txt"
```

**Soluția:** Trebuie să schimbi `accept=".txt"` în `accept=".txt,.docx"` și să adaugi logică pentru a extrage textul din Word.

## 📋 Cum Funcționează STEP 1

### **Input:**
- **Upload:** Fișier `.txt` (momentan) - trebuie extins la `.docx`
- **Paste:** Text direct în textarea

### **Processing Flow:**

1. **User uploadează/paste text** → `rawTextAd` state
2. **User apasă "Process & Continue"** → `processText()` function
3. **Frontend trimite la backend** → `processTextAdMutation.mutateAsync({ text: rawTextAd })`
4. **Backend procesează** → `processAdDocument(rawText)` în `text-processor.ts`
5. **Backend returnează** → `{ processedText: string }`
6. **Frontend salvează** → `setProcessedTextAd(result.processedText)`
7. **Frontend avansează** → `setCurrentStep(2)`

## 🎯 Reguli de Procesare (118-125 Caractere)

### **Regula 1: Text între 118-125 caractere**
✅ **Păstrează ca atare**
```
Input: "Acest text are exact 120 de caractere și este perfect pentru procesare fără modificări suplimentare necesare aici."
Output: [ACELAȘI TEXT]
```

### **Regula 2: Text < 118 caractere**
✅ **Adaugă cuvinte de la început până ajunge la 118-125**

**Algoritm:**
1. Calculează target random între 118-125
2. Adaugă cuvinte de la început (循环)
3. Continuă până ajunge la target
4. Marchează cu ROȘU textul adăugat

**Exemplu:**
```
Input (80 chars): "Ești obosit să trăiești de la salariu la salariu?"

Output (122 chars): "Ești obosit să trăiești de la salariu la salariu? Ești obosit să trăiești de la salariu la salariu? Ești obosit"
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ (ORIGINAL)
                                                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ (ROȘU - ADĂUGAT)
```

### **Regula 3: Text > 125 caractere**

#### **3A: O singură propoziție > 125**
✅ **Split în 2 versiuni cu overlap strategic**

**Versiunea 1:** Primele 118-125 caractere (random), fără roșu
**Versiunea 2:** Ultimele 118-125 caractere (random), cu roșu pe CUT strategic

**CUT Strategic:**
1. **Prioritate 1:** Punctuație (`:`, `,`) + minim 50 chars după
2. **Prioritate 2:** Cuvinte de tranziție (`dar`, `și`, `iar`, `pentru`, `astfel`, `când`, `dacă`) + minim 50 chars după
3. **Prioritate 3:** 30% din text (fallback)

**Exemplu:**
```
Input (200 chars): "Eram prinsă într-o buclă fără sfârșit: munceam din greu, plăteam facturile, dar banii se terminau înainte de sfârșitul lunii, și ciclul reîncepe, fără nicio speranță de schimbare."

Versiunea 1 (120 chars): "Eram prinsă într-o buclă fără sfârșit: munceam din greu, plăteam facturile, dar banii se terminau înainte de sfârșitul"
                          (fără roșu)

Versiunea 2 (125 chars): "munceam din greu, plăteam facturile, dar banii se terminau înainte de sfârșitul lunii, și ciclul reîncepe, fără nicio"
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ (ROȘU - CUT la "dar")
                                                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ (NORMAL)
```

#### **3B: Mai multe propoziții > 125**
✅ **Combină 2-3 propoziții până ajunge la 118-125**

**Algoritm:**
1. Încearcă 3 propoziții → dacă 118-125, keep
2. Dacă nu, încearcă 2 propoziții → dacă 118-125, keep
3. Dacă nu, procesează fiecare propoziție individual (recursiv)

**Exemplu:**
```
Input: "Propoziția 1 scurtă. Propoziția 2 mai lungă cu mai multe detalii. Propoziția 3 finală."

Procesare:
- Încearcă 3 propoziții → 150 chars (prea mult)
- Încearcă 2 propoziții → 110 chars (prea puțin) → adaugă de la început → 120 chars ✅
- Propoziția 3 → 30 chars → adaugă de la început → 118 chars ✅

Output:
Linia 1: "Propoziția 1 scurtă. Propoziția 2 mai lungă cu mai multe detalii. Propoziția 1 scurtă. Propoziția 2 mai lungă"
Linia 2: "Propoziția 3 finală. Propoziția 3 finală. Propoziția 3 finală. Propoziția 3 finală. Propoziția 3 finală."
```

## 🏷️ Categorii Ignorate (Labels)

**Următoarele labels sunt ignorate și NU sunt procesate:**

```typescript
const LABELS = [
  'HOOKS:', 'H1:', 'H2:', 'H3:', 'H4:', 'H5:', 'H6:', 'H7:', 'H8:', 'H9:',
  'MIRROR1', 'DCS & IDENTITY1', 'TRANZITIE1', 'NEW CAUSE1', 'MECHANISM1',
  'EMOTIONAL PROOF1', 'TRANSFORMATION1', 'CTA1'
];
```

**Cum funcționează:**
- Când întâlnește un label, îl păstrează ca atare (nu procesează)
- Textul dintre labels este procesat conform regulilor 118-125
- Labels sunt folosite pentru a separa secțiunile

**Exemplu:**
```
Input:
HOOKS:
Ești obosit să trăiești de la salariu la salariu?

H1:
Eram prinsă într-o buclă fără sfârșit.

Output:
HOOKS: (păstrat ca atare)
Ești obosit să trăiești de la salariu la salariu? Ești obosit să trăiești de la salariu la salariu? Ești obosit (120 chars)

H1: (păstrat ca atare)
Eram prinsă într-o buclă fără sfârșit. Eram prinsă într-o buclă fără sfârșit. Eram prinsă într-o buclă fără sfârșit. (122 chars)
```

## 🔤 Diacritice (DISABLED)

**Funcția `addDiacritics()` este DEZACTIVATĂ în cod:**

```typescript
// Apply diacritics (DISABLED - uncomment to enable)
// text = add Diacritics(text);
```

**Dacă vrei să activezi diacritice:**
1. Decomentează linia în `text-processor.ts` (linia 229)
2. Toate cuvintele românești vor primi diacritice automat

**Exemplu transformări:**
- `sa` → `să`
- `si` → `și`
- `fara` → `fără`
- `daca` → `dacă`
- `viata` → `viața`
- etc. (60+ cuvinte în dicționar)

## 🔴 Marcare Roșu (Red Marking)

**Când se marchează cu roșu:**

1. **Text < 118 chars:** Tot textul adăugat este roșu
2. **Single sentence > 125:** CUT strategic în versiunea 2
3. **Multiple sentences:** Textul adăugat pentru a ajunge la 118-125

**Format în output:**
```typescript
{
  text: "full text here",
  redStart: 50,  // index unde începe roșu
  redEnd: 100,   // index unde se termină roșu
  charCount: 120
}
```

## 🐛 Probleme Identificate

### **1. Upload nu funcționează**
**Cauză:** `accept=".txt"` - acceptă doar text files
**Fix:** Schimbă în `accept=".txt,.docx"` și adaugă logică pentru Word

### **2. Drag & Drop nu arată preview**
**Cauză:** Lipsește handler pentru drag & drop
**Fix:** Adaugă `onDrop` handler similar cu STEP 2

### **3. Backend nu extrage text din Word**
**Cauză:** `file.text()` funcționează doar pentru .txt
**Fix:** Folosește `mammoth` sau similar pentru .docx

## ✅ Cum să Testezi

### **Test 1: Text scurt (< 118)**
```
Input: "Text scurt de test."
Expected: Text repetat până la 118-125 chars cu roșu pe partea adăugată
```

### **Test 2: Text perfect (118-125)**
```
Input: "Acest text are exact 120 de caractere și este perfect pentru procesare fără modificări suplimentare necesare aici."
Expected: ACELAȘI TEXT, fără modificări
```

### **Test 3: Text lung (> 125)**
```
Input: "Eram prinsă într-o buclă fără sfârșit: munceam din greu, plăteam facturile, dar banii se terminau înainte de sfârșitul lunii, și ciclul reîncepe, fără nicio speranță de schimbare."
Expected: 2 versiuni cu overlap strategic
```

### **Test 4: Labels**
```
Input:
HOOKS:
Text aici

H1:
Alt text

Expected: Labels păstrate, texte procesate separat
```

## 🔧 Fix-uri Necesare

### **Fix 1: Acceptă .docx**
```typescript
// În Home.tsx, linia 2236
accept=".txt,.docx"
```

### **Fix 2: Extrage text din Word**
```typescript
const handleTextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    if (file.name.endsWith('.txt')) {
      const text = await file.text();
      setRawTextAd(text);
    } else if (file.name.endsWith('.docx')) {
      // TODO: Add Word extraction logic
      // Use mammoth.js or similar
      toast.error('Word files not yet supported. Please paste text manually.');
    }
    toast.success('Text file loaded!');
  }
};
```

### **Fix 3: Adaugă drag & drop**
```typescript
const handleTextFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && (file.name.endsWith('.txt') || file.name.endsWith('.docx'))) {
    // Process file same as upload
  } else {
    toast.error("Please upload .txt or .docx file");
  }
};
```

## 📊 Summary

**Ce funcționează:**
- ✅ Paste text în textarea
- ✅ Backend processing (118-125 chars)
- ✅ Labels ignorance
- ✅ Red marking logic
- ✅ Auto-save în context session

**Ce NU funcționează:**
- ❌ Upload .docx (doar .txt)
- ❌ Drag & drop pentru text files
- ❌ Preview după upload
- ❌ Word document extraction

**Prioritate fix:**
1. **Adaugă suport .docx** (cel mai important)
2. Adaugă drag & drop handler
3. Îmbunătățește preview

Vrei să implementez aceste fix-uri acum?
