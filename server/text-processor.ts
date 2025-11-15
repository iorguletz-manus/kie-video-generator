/**
 * SIMPLE TEXT PROCESSOR
 * Finds fixed categories and processes text to 118-125 characters
 */

interface ProcessedLine {
  text: string;
  redStart: number;
  redEnd: number;
  charCount: number;
}

interface OutputItem {
  type: 'label' | 'text';
  text: string;
  category?: string;
  subcategory?: string | null;
  displayName?: string;
  redStart?: number;
  redEnd?: number;
  charCount?: number;
}

/**
 * Fixed category names that can appear in documents
 * Each can have optional number 1-100 after it (e.g., MIRROR1, DCS2)
 */
const CATEGORY_NAMES = [
  'HOOKS',
  'MIRROR',
  'DCS',
  'TRANZITION',
  'NEW CAUSE',      // Also matches NEW-CAUSE
  'NEW-CAUSE',
  'MECHANISM',
  'EMOTIONAL PROOF', // Also matches EMOTIONAL-PROOF
  'EMOTIONAL-PROOF',
  'TRANSFORMATION',
  'CTA'
];

/**
 * Find all category positions in text
 * Returns array of {category, position, fullMatch} sorted by position
 */
function findCategories(text: string): Array<{category: string; position: number; fullMatch: string}> {
  const found: Array<{category: string; position: number; fullMatch: string}> = [];
  
  // Search for each category name
  for (const catName of CATEGORY_NAMES) {
    // Pattern: CATEGORY_NAME followed by optional number 1-100 and optional colon
    // Examples: MIRROR, MIRROR:, MIRROR1, MIRROR1:, MIRROR:
    const pattern = new RegExp(`\\b(${catName})(\\d{1,3})?:?(?=\\s|[A-Z]|$)`, 'gi');
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0]; // e.g., "MIRROR1" or "DCS" or "HOOKS"
      const number = match[2]; // e.g., "1" or undefined
      
      // Validate number is 1-100
      if (number) {
        const num = parseInt(number);
        if (num < 1 || num > 100) {
          continue; // Skip invalid numbers
        }
      }
      
      // Normalize category name (replace spaces with hyphens)
      const normalizedCategory = catName.toUpperCase().replace(/\s+/g, '-');
      
      found.push({
        category: normalizedCategory,
        position: match.index,
        fullMatch: fullMatch
      });
    }
  }
  
  // Also search for H1-H100 (HOOKS subcategories) with optional colon
  // Examples: H1, H1:, H9, H9:
  const hPattern = /\b(H)(\d{1,3}):?(?=\s|[A-Z]|$)/gi;
  let hMatch;
  while ((hMatch = hPattern.exec(text)) !== null) {
    const num = parseInt(hMatch[2]);
    if (num >= 1 && num <= 100) {
      found.push({
        category: 'HOOKS',
        position: hMatch.index,
        fullMatch: `H${num}`
      });
    }
  }
  
  // Sort by position
  found.sort((a, b) => a.position - b.position);
  
  return found;
}

/**
 * Split text into sections based on category positions
 */
function splitIntoSections(text: string): Array<{category: string; subcategory: string | null; content: string}> {
  const categories = findCategories(text);
  const sections: Array<{category: string; subcategory: string | null; content: string}> = [];
  
  for (let i = 0; i < categories.length; i++) {
    const current = categories[i];
    const next = categories[i + 1];
    
    // Extract content from current position to next category (or end of text)
    const startPos = current.position + current.fullMatch.length;
    const endPos = next ? next.position : text.length;
    let content = text.substring(startPos, endPos).trim();
    
    // Remove leading colon and space if present (e.g., ": Pentru femeile..." -> "Pentru femeile...")
    content = content.replace(/^:\s*/, '');
    
    // Determine if this is a subcategory (H1-H100)
    const isHSubcategory = current.fullMatch.match(/^H\d{1,3}$/i);
    
    sections.push({
      category: current.category,
      subcategory: isHSubcategory ? current.fullMatch.toUpperCase() : null,
      content: content
    });
  }
  
  return sections;
}

/**
 * Split text into sentences based on . ! ?
 */
function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let current: string[] = [];
  const words = text.split(/\s+/);
  
  for (const word of words) {
    current.push(word);
    // Only split on . ! ? not on :
    if (word.match(/[.!?]$/)) {
      sentences.push(current.join(' ').trim());
      current = [];
    }
  }
  
  if (current.length > 0) {
    sentences.push(current.join(' ').trim());
  }
  
  return sentences;
}

/**
 * Process short text (< 118 chars) by adding words from beginning
 */
function processShortText(text: string, minC: number = 118, maxC: number = 125): ProcessedLine {
  const target = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  const needed = target - text.length;
  
  if (needed <= 0) {
    return { text, redStart: -1, redEnd: -1, charCount: text.length };
  }
  
  // Add WORDS from beginning
  const words = text.split(/\s+/);
  const addedWords: string[] = [];
  
  // Keep adding words until we reach target
  for (let cycle = 0; cycle < 10; cycle++) {
    for (const word of words) {
      const testText = text + ' ' + [...addedWords, word].join(' ');
      const testLen = testText.length;
      
      if (testLen <= maxC) {
        addedWords.push(word);
        if (testLen >= minC && testLen >= target) {
          break;
        }
      } else {
        break;
      }
    }
    
    const currentLen = (text + ' ' + addedWords.join(' ')).length;
    if (currentLen >= minC) {
      break;
    }
  }
  
  let addedText = addedWords.join(' ');
  let fullText = text + ' ' + addedText;
  
  // Trim if over maxC (word by word)
  while (fullText.length > maxC && addedWords.length > 0) {
    addedWords.pop();
    addedText = addedWords.join(' ');
    fullText = text + ' ' + addedText;
  }
  
  const redStart = text.length + 1;
  const redEnd = fullText.length;
  
  return { text: fullText, redStart, redEnd, charCount: fullText.length };
}

/**
 * Process long sentence (> 125 chars) with strategic overlap - CORRECT LOGIC
 * 
 * Steps:
 * 1. Generate random length for Line 1 (118-125)
 * 2. Take first N chars from text
 * 3. Find logical CUT POINT (after complete idea)
 * 4. Split Line 1 into WHITE (before cut) and RED (after cut)
 * 5. Line 2 WHITE = continuation from original text (after Line 1 WHITE)
 * 6. Generate random length for Line 2 (118-125)
 * 7. Line 2 RED = chars taken backwards from Line 1 WHITE to reach target length
 * 
 * Result:
 * - Line 1 WHITE + Line 2 WHITE = complete original sentence ✅
 * - Line 1 RED + Line 2 RED = overlap (will be cut in video)
 */
function processLongSentenceWithOverlap(text: string, minC: number = 118, maxC: number = 125): ProcessedLine[] {
  const results: ProcessedLine[] = [];
  
  // Step 1: Generate random length for Line 1 (118-125)
  const line1TargetLength = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  
  // Step 2: Take first line1TargetLength chars
  let line1Full = text.substring(0, line1TargetLength).trim();
  
  // Adjust to word boundary
  if (line1Full.includes(' ')) {
    const words = line1Full.split(/\s+/);
    line1Full = words.join(' ');
  }
  
  // Step 3: Find logical CUT POINT (after complete idea)
  let cutPoint = -1;
  
  // Look for punctuation marks
  const punctuationMarks = [', ', ': ', '; ', '! ', '? '];
  for (const mark of punctuationMarks) {
    const idx = line1Full.lastIndexOf(mark);
    if (idx > cutPoint && idx > line1Full.length * 0.4) {
      cutPoint = idx + mark.length;
    }
  }
  
  // If no punctuation, look for transition words
  if (cutPoint === -1) {
    const transitionWords = [' dar ', ' și ', ' iar ', ' pentru ', ' astfel ', ' când ', ' dacă ', ' ca ', ' că ', ' pot ', ' pot fi '];
    for (const word of transitionWords) {
      const idx = line1Full.lastIndexOf(word);
      if (idx > cutPoint && idx > line1Full.length * 0.4) {
        cutPoint = idx + word.length;
      }
    }
  }
  
  // Fallback: cut at 60% of line1Full
  if (cutPoint === -1) {
    cutPoint = Math.floor(line1Full.length * 0.6);
    while (cutPoint < line1Full.length && line1Full[cutPoint] !== ' ') {
      cutPoint++;
    }
    if (cutPoint < line1Full.length) cutPoint++;
  }
  
  // Step 4: Split Line 1 into WHITE and RED
  const line1White = line1Full.substring(0, cutPoint).trim();
  const line1Red = line1Full.substring(cutPoint).trim();
  
  // Step 5: Line 2 WHITE = continuation from original text
  const line1WhiteEndInOriginal = text.indexOf(line1White) + line1White.length;
  const line2White = text.substring(line1WhiteEndInOriginal).trim();
  
  // Step 6: Generate random length for Line 2 (118-125)
  const line2TargetLength = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  
  // Step 7: Calculate how many chars we need to add as RED
  const line2RedNeeded = line2TargetLength - line2White.length;
  
  // Step 8: Take line2RedNeeded chars BACKWARDS from line1White
  let line2Red = '';
  if (line2RedNeeded > 0) {
    const startIdx = Math.max(0, line1White.length - line2RedNeeded);
    line2Red = line1White.substring(startIdx).trim();
  }
  
  // Step 9: Build final lines
  const line1Final = line1White + (line1Red ? ' ' + line1Red : '');
  const line2Final = (line2Red ? line2Red + ' ' : '') + line2White;
  
  // Step 10: Calculate RED positions
  const line1RedStart = line1Red ? line1White.length + 1 : -1;
  const line1RedEnd = line1Red ? line1Final.length : -1;
  
  const line2RedStart = line2Red ? 0 : -1;
  const line2RedEnd = line2Red ? line2Red.length : -1;
  
  // Add results
  results.push({
    text: line1Final,
    redStart: line1RedStart,
    redEnd: line1RedEnd,
    charCount: line1Final.length
  });
  
  results.push({
    text: line2Final,
    redStart: line2RedStart,
    redEnd: line2RedEnd,
    charCount: line2Final.length
  });
  
  return results;
}

/**
 * Main text processing function following Python logic
 */
function processText(text: string, minC: number = 118, maxC: number = 125): ProcessedLine[] {
  text = text.trim();
  if (!text || text.length < 10) {
    return [];
  }
  
  const length = text.length;
  
  // Rule 1: If 118-125, keep as is
  if (length >= minC && length <= maxC) {
    return [{ text, redStart: -1, redEnd: -1, charCount: length }];
  }
  
  // Rule 2: If < 118, add from beginning
  if (length < minC) {
    return [processShortText(text, minC, maxC)];
  }
  
  // Rule 3: If > 125
  const sentences = splitIntoSentences(text);
  
  // Single sentence > 125 - use overlap strategy
  if (sentences.length === 1) {
    return processLongSentenceWithOverlap(text, minC, maxC);
  }
  
  // Multiple sentences - process sequentially
  const results: ProcessedLine[] = [];
  let i = 0;
  
  while (i < sentences.length) {
    // Try combining 3 sentences
    if (i + 2 < sentences.length) {
      const combined3 = sentences.slice(i, i + 3).join(' ');
      if (combined3.length >= minC && combined3.length <= maxC) {
        results.push({ text: combined3, redStart: -1, redEnd: -1, charCount: combined3.length });
        i += 3;
        continue;
      } else if (combined3.length < minC) {
        results.push(processShortText(combined3, minC, maxC));
        i += 3;
        continue;
      }
    }
    
    // Try combining 2 sentences
    if (i + 1 < sentences.length) {
      const combined2 = sentences.slice(i, i + 2).join(' ');
      if (combined2.length >= minC && combined2.length <= maxC) {
        results.push({ text: combined2, redStart: -1, redEnd: -1, charCount: combined2.length });
        i += 2;
        continue;
      } else if (combined2.length < minC) {
        results.push(processShortText(combined2, minC, maxC));
        i += 2;
        continue;
      }
    }
    
    // Process single sentence
    results.push(...processText(sentences[i], minC, maxC));
    i++;
  }
  
  return results;
}

/**
 * Main processing function
 */
export function processAdDocument(rawText: string): OutputItem[] {
  // Remove [HEADER]...[/HEADER] sections
  let cleanedText = rawText.replace(/\[HEADER\][\s\S]*?\[\/HEADER\]/gi, '');
  
  // Split into sections by categories
  const sections = splitIntoSections(cleanedText);
  
  const outputData: OutputItem[] = [];
  
  for (const section of sections) {
    // Add category label
    const displayName = section.subcategory || section.category;
    outputData.push({
      type: 'label',
      text: displayName,
      category: section.category,
      subcategory: section.subcategory,
      displayName: displayName
    });
    
    // Process content text
    if (section.content) {
      const processedLines = processText(section.content);
      
      for (const line of processedLines) {
        outputData.push({
          type: 'text',
          text: line.text,
          category: section.category,
          subcategory: section.subcategory,
          redStart: line.redStart,
          redEnd: line.redEnd,
          charCount: line.charCount
        });
      }
    }
  }
  
  return outputData;
}

// Export for compatibility
export function addRedOnLine1(data: OutputItem[]): OutputItem[] {
  // Already handled in processText
  return data;
}
