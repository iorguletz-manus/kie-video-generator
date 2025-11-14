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
