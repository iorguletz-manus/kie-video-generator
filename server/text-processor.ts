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
 * Process long sentence (> 125 chars) with strategic overlap
 */
function processLongSentenceWithOverlap(text: string, minC: number = 118, maxC: number = 125): ProcessedLine[] {
  const results: ProcessedLine[] = [];
  
  // Version 1: First part
  const rand1 = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  let version1 = text.substring(0, rand1).trimEnd();
  
  // Adjust to end at word boundary
  if (version1.includes(' ')) {
    const words = version1.split(/\s+/);
    version1 = words.join(' ');
  }
  
  // Version 2: Last part
  const rand2 = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  let version2 = text.substring(text.length - rand2).trimStart();
  
  // Adjust to start at word boundary
  if (version2.includes(' ')) {
    const words = version2.split(/\s+/);
    version2 = words.join(' ');
  }
  
  // Add version 1 (no red)
  results.push({ text: version1, redStart: -1, redEnd: -1, charCount: version1.length });
  
  // Find strategic CUT point in version2
  const words = version2.split(/\s+/);
  let strategicCutIdx = -1;
  
  // Look for punctuation marks that indicate idea change
  for (let i = 0; i < words.length; i++) {
    if (words[i].match(/[:,]$/)) {
      const remaining = words.slice(i + 1).join(' ');
      if (remaining.length >= 50) {
        strategicCutIdx = i + 1;
        break;
      }
    }
  }
  
  // If no good punctuation found, look for transition words
  if (strategicCutIdx === -1) {
    const transitionWords = ['dar', 'și', 'iar', 'pentru', 'astfel', 'când', 'dacă'];
    for (let i = 0; i < words.length; i++) {
      const wordClean = words[i].toLowerCase().replace(/[.,!?:;]/g, '');
      if (transitionWords.includes(wordClean)) {
        const remaining = words.slice(i).join(' ');
        if (remaining.length >= 50) {
          strategicCutIdx = i;
          break;
        }
      }
    }
  }
  
  // If still not found, use 30% of text as fallback
  if (strategicCutIdx === -1) {
    const targetLen = Math.floor(version2.length * 0.3);
    let currentLen = 0;
    for (let i = 0; i < words.length; i++) {
      currentLen += words[i].length + 1;
      if (currentLen >= targetLen) {
        const remaining = words.slice(i + 1).join(' ');
        if (remaining.length >= 50) {
          strategicCutIdx = i + 1;
          break;
        }
      }
    }
  }
  
  // Apply red marking
  if (strategicCutIdx > 0) {
    const redText = words.slice(0, strategicCutIdx).join(' ');
    const redEnd = redText.length;
    results.push({ text: version2, redStart: 0, redEnd, charCount: version2.length });
  } else {
    // Fallback: no red
    results.push({ text: version2, redStart: -1, redEnd: -1, charCount: version2.length });
  }
  
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
