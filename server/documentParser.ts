import mammoth from 'mammoth';

/**
 * Keywords de eliminat din documentul ad
 */
const KEYWORDS_TO_REMOVE = [
  'HOOKS:',
  'MIRROR:',
  'DCS:',
  'TRANSITION:',
  'TRANZITION:',
  'NEW_CAUSE:',
  'MECHANISM:',
  'EMOTIONAL_PROOF:',
  'TRANSFORMATION:',
  'CTA:',
];

/**
 * Verifică dacă o linie este un header de categorie (H1, H2, ..., H999, MIRROR1, etc.)
 */
function isCategoryHeader(line: string): boolean {
  const upperLine = line.toUpperCase().trim();
  
  // Verifică HOOKS: H1, H2, H3, ..., H999
  if (/^H\d+:?/.test(upperLine)) {
    return true;
  }
  
  // Verifică alte categorii cu număr
  if (/(MIRROR|DCS|TRANZITION|TRANSITION|NEW_CAUSE|MECHANISM|EMOTIONAL_PROOF|TRANSFORMATION|CTA)\d+:?/.test(upperLine)) {
    return true;
  }
  
  return false;
}

/**
 * Parsează document ad și extrage liniile de text
 * Elimină keywords și contoare de caractere
 */
export async function parseAdDocument(buffer: Buffer): Promise<string[]> {
  try {
    // Extrage textul din .docx
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    // Împarte în linii
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const processedLines: string[] = [];
    
    for (const line of lines) {
      // Verifică dacă linia este un keyword de eliminat sau header categorie
      const isKeyword = KEYWORDS_TO_REMOVE.some(keyword => 
        line.toUpperCase().startsWith(keyword.toUpperCase())
      );
      
      if (isKeyword || isCategoryHeader(line)) {
        continue; // Skip keywords și headers
      }
      
      // Elimină contorul de caractere (ex: "- 125 chars")
      let cleanedLine = line.replace(/\s*-\s*\d+\s*chars?\s*$/i, '').trim();
      
      // Elimină textul roșu/colorat care poate fi duplicat
      // (în document, textul roșu este de obicei o repetare parțială)
      // Mammoth nu păstrează culorile, deci nu avem această problemă
      
      if (cleanedLine.length > 0) {
        processedLines.push(cleanedLine);
      }
    }
    
    return processedLines;
  } catch (error: any) {
    console.error('Error parsing ad document:', error);
    throw new Error(`Failed to parse ad document: ${error.message}`);
  }
}

/**
 * Parsează document prompt și extrage template-ul
 */
export async function parsePromptDocument(buffer: Buffer): Promise<string> {
  try {
    // Extrage textul din .docx
    const result = await mammoth.extractRawText({ buffer });
    const promptTemplate = result.value;
    
    // Verifică dacă conține [INSERT TEXT]
    if (!promptTemplate.includes('[INSERT TEXT]')) {
      throw new Error('Prompt document does not contain [INSERT TEXT] placeholder');
    }
    
    return promptTemplate;
  } catch (error: any) {
    console.error('Error parsing prompt document:', error);
    throw new Error(`Failed to parse prompt document: ${error.message}`);
  }
}

/**
 * Înlocuiește [INSERT TEXT] cu textul specificat
 */
export function replaceInsertText(promptTemplate: string, text: string): string {
  return promptTemplate.replace('[INSERT TEXT]', text);
}

/**
 * Tipuri de secțiuni din document ad
 */
export type SectionType = 'HOOKS' | 'MIRROR' | 'DCS' | 'TRANZITION' | 'NEW_CAUSE' | 'MECHANISM' | 'EMOTIONAL_PROOF' | 'TRANSFORMATION' | 'CTA' | 'OTHER';

/**
 * Tipuri de prompturi
 */
export type PromptType = 'PROMPT_NEUTRAL' | 'PROMPT_SMILING' | 'PROMPT_CTA';

/**
 * Detectă tipul de secțiune pentru o linie de text
 */
export function detectSection(line: string, allLines: string[], lineIndex: number): SectionType {
  const upperLine = line.toUpperCase();
  
  // Verifică dacă linia conține keywords pentru CTA
  if (upperLine.includes('CARTE') || upperLine.includes('CARTEA')) {
    return 'CTA';
  }
  
  // Caută în liniile anterioare pentru a determina secțiunea
  for (let i = lineIndex; i >= 0; i--) {
    const prevLine = allLines[i].toUpperCase().trim();
    
    if (prevLine.startsWith('CTA')) return 'CTA';
    if (prevLine.startsWith('TRANSFORMATION')) return 'TRANSFORMATION';
    if (prevLine.startsWith('EMOTIONAL_PROOF')) return 'EMOTIONAL_PROOF';
    if (prevLine.startsWith('MECHANISM')) return 'MECHANISM';
    if (prevLine.startsWith('NEW_CAUSE')) return 'NEW_CAUSE';
    if (prevLine.startsWith('TRANZITION') || prevLine.startsWith('TRANSITION')) return 'TRANZITION';
    if (prevLine.startsWith('DCS')) return 'DCS';
    if (prevLine.startsWith('MIRROR')) return 'MIRROR';
    if (prevLine.startsWith('HOOKS') || prevLine.startsWith('H1') || prevLine.startsWith('H2') || prevLine.startsWith('H3')) return 'HOOKS';
  }
  
  return 'OTHER';
}

/**
 * Determină promptul potrivit pentru o secțiune
 */
export function getPromptForSection(section: SectionType): PromptType {
  switch (section) {
    case 'TRANSFORMATION':
    case 'CTA':
      return 'PROMPT_SMILING';
    case 'CTA':
      // CTA cu "carte" folosește PROMPT_CTA
      return 'PROMPT_CTA';
    default:
      // HOOKS, MIRROR, DCS, TRANZITION, NEW_CAUSE, MECHANISM, EMOTIONAL_PROOF, OTHER
      return 'PROMPT_NEUTRAL';
  }
}

/**
 * Extrage numărul categoriei din linia de header (ex: "MIRROR1" → 1, "H3" → 3)
 */
export function extractCategoryNumber(line: string): number | null {
  const upperLine = line.toUpperCase().trim();
  
  // Pentru HOOKS: H1, H2, H3, etc.
  const hookMatch = upperLine.match(/^H(\d+)/);
  if (hookMatch) {
    return parseInt(hookMatch[1], 10);
  }
  
  // Pentru alte categorii: MIRROR1, DCS2, TRANZITION1, etc.
  const categoryMatch = upperLine.match(/(MIRROR|DCS|TRANZITION|TRANSITION|NEW_CAUSE|MECHANISM|EMOTIONAL_PROOF|TRANSFORMATION|CTA)(\d+)/);
  if (categoryMatch) {
    return parseInt(categoryMatch[2], 10);
  }
  
  return null;
}

/**
 * Generează nume video conform convenției: CB1_A1_CATEGORY_NUMBER
 * Ex: CB1_A1_MIRROR1, CB1_A1_HOOK3, CB1_A1_HOOK3B (pentru multiple linii)
 */
export function generateVideoName(
  section: SectionType,
  categoryNumber: number,
  lineIndexInCategory: number = 0
): string {
  const prefix = 'CB1_A1';
  
  // Pentru HOOKS folosește HOOK în loc de HOOKS
  const categoryName = section === 'HOOKS' ? 'HOOK' : section;
  
  // Dacă sunt multiple linii în aceeași categorie, adaugă A, B, C, etc.
  const suffix = lineIndexInCategory > 0 ? String.fromCharCode(65 + lineIndexInCategory) : '';
  
  return `${prefix}_${categoryName}${categoryNumber}${suffix}`;
}

/**
 * Parsăzește document ad și returnează linii cu secțiuni detectate
 */
export async function parseAdDocumentWithSections(buffer: Buffer): Promise<Array<{
  text: string;
  section: SectionType;
  promptType: PromptType;
  videoName: string;
  categoryNumber: number;
}>> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const allLines = [...lines]; // Copie pentru referință
    
    const processedLines: Array<{
      text: string;
      section: SectionType;
      promptType: PromptType;
      videoName: string;
      categoryNumber: number;
    }> = [];
    
    // Tracking pentru numărul categoriei curente și index în categorie
    let currentCategoryNumber = 1;
    let currentSection: SectionType | null = null;
    let lineIndexInCategory = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Verifică dacă linia este un keyword/header de categorie
      const categoryNumber = extractCategoryNumber(line);
      if (categoryNumber !== null) {
        currentCategoryNumber = categoryNumber;
        currentSection = null; // Reset secțiune
        lineIndexInCategory = 0;
        continue; // Skip header-ul categoriei
      }
      
      // Verifică dacă linia este un keyword de eliminat sau header categorie
      const isKeyword = KEYWORDS_TO_REMOVE.some(keyword => 
        line.toUpperCase().startsWith(keyword.toUpperCase())
      );
      
      if (isKeyword || isCategoryHeader(line)) {
        continue; // Skip keywords și headers
      }
      
      // Elimină contorul de caractere
      let cleanedLine = line.replace(/\s*-\s*\d+\s*chars?\s*$/i, '').trim();
      
      if (cleanedLine.length > 0) {
        const section = detectSection(cleanedLine, allLines, i);
        const promptType = getPromptForSection(section);
        
        // Dacă secțiunea s-a schimbat, reset index
        if (currentSection !== section) {
          currentSection = section;
          lineIndexInCategory = 0;
        }
        
        // Generează numele video
        const videoName = generateVideoName(section, currentCategoryNumber, lineIndexInCategory);
        
        processedLines.push({
          text: cleanedLine,
          section: section,
          promptType: promptType,
          videoName: videoName,
          categoryNumber: currentCategoryNumber,
        });
        
        lineIndexInCategory++;
      }
    }
    
    return processedLines;
  } catch (error: any) {
    console.error('Error parsing ad document with sections:', error);
    throw new Error(`Failed to parse ad document: ${error.message}`);
  }
}
