# STEP 1 & STEP 2 Improvements - Complete Implementation

## 🎉 All 4 Requirements Implemented Successfully!

### ✅ 1. Ignore [HEADER]...[/HEADER] Tags

**Location:** `server/text-processor.ts` line 346

```typescript
// Remove [HEADER]...[/HEADER] sections
let cleanedText = rawText.replace(/\[HEADER\][\s\S]*?\[\/HEADER\]/gi, '');
```

**How it works:**
- Regex pattern matches `[HEADER]` opening tag
- `[\s\S]*?` matches any content (including newlines) non-greedily
- `[\/HEADER]` matches closing tag
- `/gi` flags: global (all occurrences) + case-insensitive
- All matched sections are removed before processing

**Example:**
```
Input:
[HEADER]
This is header content
Multiple lines
[/HEADER]
Actual ad text here

Output:
Actual ad text here
```

---

### ✅ 2. Flexible Label Matching

**Location:** `server/text-processor.ts` lines 22-50

**Base Labels (without numbers/separators):**
```typescript
const BASE_LABELS = [
  'HOOKS', 'H', 'MIRROR', 'DCS', 'IDENTITY', 
  'TRANZITIE', 'TRANZITION', 'NEW CAUSE', 'MECHANISM',
  'EMOTIONAL PROOF', 'TRANSFORMATION', 'CTA'
];
```

**Matching Logic:**
1. Remove trailing colon (`:`)
2. Normalize separators (`-`, `_`, space) to single space
3. Remove trailing digits (`1`, `2`, `3`, etc.)
4. Compare with base labels

**Examples that match:**
- `HOOKS:` → matches `HOOKS`
- `H1:` → matches `H`
- `NEW-CAUSE2` → matches `NEW CAUSE`
- `NEW_CAUSE` → matches `NEW CAUSE`
- `EMOTIONAL PROOF` → matches `EMOTIONAL PROOF`
- `EMOTIONAL-PROOF3` → matches `EMOTIONAL PROOF`
- `EMOTIONAL_PROOF1` → matches `EMOTIONAL PROOF`
- `DCS` → matches `DCS`
- `TRANZITION` → matches `TRANZITION`
- `TRANZITIE2` → matches `TRANZITIE`

**Code:**
```typescript
function isLabel(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  const withoutColon = trimmed.endsWith(':') ? trimmed.slice(0, -1) : trimmed;
  const normalized = withoutColon.replace(/[-_]/g, ' ');
  const withoutDigits = normalized.replace(/\d+$/, '').trim();
  
  return BASE_LABELS.some(label => {
    const normalizedLabel = label.replace(/[-_]/g, ' ');
    return withoutDigits === normalizedLabel || 
           withoutDigits.startsWith(normalizedLabel + ' ') ||
           normalized === normalizedLabel;
  });
}
```

---

### ✅ 3. STEP 1 → STEP 2 Flow (Extract Lines)

**Location:** `client/src/pages/Home.tsx` lines 667-691

**How it works:**

**STEP 1:**
1. User uploads/pastes text
2. Click "Process & Continue to STEP 2"
3. Backend processes text (118-125 chars)
4. **Extract only text lines** (filter out labels)
5. Set `extractedLines` state
6. Navigate to STEP 2

**Code:**
```typescript
const processText = async () => {
  const result = await processTextAdMutation.mutateAsync({
    rawText: rawTextAd,
  });
  
  // Extract only text lines (not labels) for STEP 2
  const extractedLines = result.processedLines
    .filter((line: any) => line.type === 'text')
    .map((line: any) => line.text);
  
  // Set extracted lines for STEP 2
  setExtractedLines(extractedLines);
  
  toast.success(`Text processed! ${extractedLines.length} lines extracted.`);
  setCurrentStep(2);
};
```

**STEP 2:**
- Automatically shows inherited lines from STEP 1
- Displays "X linii extrase"
- Ready for STEP 3

---

### ✅ 4. STEP 2 Document Source Selector

**Location:** `client/src/pages/Home.tsx` lines 2346-2401

**State Variable:**
```typescript
const [documentSource, setDocumentSource] = useState<'inherited' | 'upload'>('inherited');
```

**UI Selector:**
```tsx
<Select value={documentSource} onValueChange={(value: 'inherited' | 'upload') => setDocumentSource(value)}>
  <SelectTrigger className="w-full">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="inherited">Inherited from STEP 1</SelectItem>
    <SelectItem value="upload">Upload New Document</SelectItem>
  </SelectContent>
</Select>
```

**Behavior:**

**Option 1: "Inherited from STEP 1" (DEFAULT)**
- Shows lines extracted from STEP 1
- No upload section visible
- Displays "X linii extrase" immediately
- Ready to continue to STEP 3

**Option 2: "Upload New Document"**
- Shows drag & drop upload section
- Accepts .docx, .doc files
- Extracts lines from uploaded document
- Replaces inherited lines with new ones

**Conditional Rendering:**
```tsx
{documentSource === 'upload' && (
  <div>
    {/* Upload drag & drop section */}
  </div>
)}

{adLines.length > 0 && (
  <div>
    {/* Display extracted lines */}
  </div>
)}
```

---

## 📊 Complete Workflow

### Full STEP 1 → STEP 2 Flow:

**STEP 1: Prepare Text Ad**
1. Select context (Core Belief, Emotional Angle, Ad, Character)
2. Upload/paste text
3. Text is processed:
   - `[HEADER]...[/HEADER]` removed
   - Labels ignored (flexible matching)
   - Text split into 118-125 char chunks
   - Lines extracted
4. Click "Process & Continue to STEP 2"
5. Toast: "Text processed! X lines extracted."

**STEP 2: Text Ad Document**
1. Default selector: "Inherited from STEP 1"
2. Lines from STEP 1 displayed automatically
3. Option to switch to "Upload New Document"
4. If upload: new document replaces inherited lines
5. Click "Continuă la STEP 3"

---

## 🔗 GitHub Commit

**Commit:** `ca9baff`
**https://github.com/iorguletz-manus/kie-video-generator/commit/ca9baff**

**Changes:**
- `server/text-processor.ts`: [HEADER] removal + flexible labels
- `client/src/pages/Home.tsx`: Extract lines + document source selector

---

## 🚀 Live Application

**https://3001-iirldo6syv7przekd2uad-1fde3e79.manusvm.computer**

---

## ✅ Testing Checklist

### Test 1: [HEADER] Removal
- [ ] Upload document with `[HEADER]content[/HEADER]`
- [ ] Verify header content is not in extracted lines

### Test 2: Flexible Labels
- [ ] Test `HOOKS:` → ignored
- [ ] Test `H1:` → ignored
- [ ] Test `NEW-CAUSE2` → ignored
- [ ] Test `EMOTIONAL_PROOF` → ignored
- [ ] Test `DCS` → ignored
- [ ] Test `TRANZITION3` → ignored

### Test 3: STEP 1 → STEP 2 Flow
- [ ] Upload text in STEP 1
- [ ] Click "Process & Continue"
- [ ] Verify STEP 2 shows inherited lines
- [ ] Verify toast shows correct line count

### Test 4: Document Source Selector
- [ ] Verify default is "Inherited from STEP 1"
- [ ] Verify inherited lines are displayed
- [ ] Switch to "Upload New Document"
- [ ] Upload .docx file
- [ ] Verify new lines replace inherited lines

---

## 🎯 All Requirements Met!

✅ **Requirement 1:** Ignore [HEADER] tags  
✅ **Requirement 2:** Flexible label matching (no digits, any separator)  
✅ **Requirement 3:** STEP 1 processes + extracts lines for STEP 2  
✅ **Requirement 4:** STEP 2 selector (Inherited vs Upload)  

**Status:** 100% Complete and Pushed to GitHub! 🎉
