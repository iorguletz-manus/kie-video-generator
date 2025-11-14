import mammoth from 'mammoth';

/**
 * Keywords de eliminat din documentul ad
 */
const KEYWORDS_TO_REMOVE = [
  'HOOKS:',
  'H1:', 'H2:', 'H3:', 'H4:', 'H5:', 'H6:', 'H7:', 'H8:', 'H9:',
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
      // Verifică dacă linia este un keyword de eliminat
      const isKeyword = KEYWORDS_TO_REMOVE.some(keyword => 
        line.toUpperCase().startsWith(keyword.toUpperCase())
      );
      
      if (isKeyword) {
        continue; // Skip keywords
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
export type SectionType = 'HOOKS' | 'TRANSFORMATION' | 'CTA' | 'OTHER';

/**
 * Tipuri de prompturi
 */
export type PromptType = 'PROMPT_NEUTRAL' | 'PROMPT_SMILING' | 'PROMPT_CTA';

/**
 * Detectează tipul de secțiune pentru o linie de text
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
    
    if (prevLine.startsWith('CTA')) {
      return 'CTA';
    }
    if (prevLine.startsWith('TRANSFORMATION')) {
      return 'TRANSFORMATION';
    }
    if (prevLine.startsWith('HOOKS') || prevLine.startsWith('H1') || prevLine.startsWith('H2')) {
      return 'HOOKS';
    }
  }
  
  return 'OTHER';
}

/**
 * Determină promptul potrivit pentru o secțiune
 */
export function getPromptForSection(section: SectionType): PromptType {
  switch (section) {
    case 'HOOKS':
    case 'OTHER':
      return 'PROMPT_NEUTRAL';
    case 'TRANSFORMATION':
      return 'PROMPT_SMILING';
    case 'CTA':
      return 'PROMPT_CTA';
    default:
      return 'PROMPT_NEUTRAL';
  }
}

/**
 * Parsează document ad și returnează linii cu secțiuni detectate
 */
export async function parseAdDocumentWithSections(buffer: Buffer): Promise<Array<{
  text: string;
  section: SectionType;
  promptType: PromptType;
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
    }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Verifică dacă linia este un keyword de eliminat
      const isKeyword = KEYWORDS_TO_REMOVE.some(keyword => 
        line.toUpperCase().startsWith(keyword.toUpperCase())
      );
      
      if (isKeyword) {
        continue; // Skip keywords
      }
      
      // Elimină contorul de caractere
      let cleanedLine = line.replace(/\s*-\s*\d+\s*chars?\s*$/i, '').trim();
      
      if (cleanedLine.length > 0) {
        const section = detectSection(cleanedLine, allLines, i);
        const promptType = getPromptForSection(section);
        
        processedLines.push({
          text: cleanedLine,
          section: section,
          promptType: promptType,
        });
      }
    }
    
    return processedLines;
  } catch (error: any) {
    console.error('Error parsing ad document with sections:', error);
    throw new Error(`Failed to parse ad document: ${error.message}`);
  }
}
