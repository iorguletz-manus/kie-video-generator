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
  'CAUSE',
  'MECHANISM',
  'EMOTIONAL',
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
      
      found.push({
        category: catName.toUpperCase(),
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
    const content = text.substring(startPos, endPos).trim();
    
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
 * Process text to 118-125 characters (simplified version)
 */
function processTextSimple(text: string): ProcessedLine[] {
  if (!text || text.length < 10) {
    return [];
  }
  
  const minC = 118;
  const maxC = 125;
  const results: ProcessedLine[] = [];
  
  // Split into sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let i = 0;
  while (i < sentences.length) {
    let current = sentences[i];
    
    // If already in range, use as-is
    if (current.length >= minC && current.length <= maxC) {
      results.push({
        text: current,
        redStart: -1,
        redEnd: -1,
        charCount: current.length
      });
      i++;
      continue;
    }
    
    // If too short, add next sentence
    if (current.length < minC && i + 1 < sentences.length) {
      const combined = current + ' ' + sentences[i + 1];
      if (combined.length <= maxC) {
        results.push({
          text: combined,
          redStart: -1,
          redEnd: -1,
          charCount: combined.length
        });
        i += 2;
        continue;
      }
    }
    
    // If too long or can't combine, split it
    if (current.length > maxC) {
      const words = current.split(' ');
      const mid = Math.floor(words.length / 2);
      
      const part1 = words.slice(0, mid).join(' ');
      const part2 = words.slice(mid).join(' ');
      
      // Find overlap words
      const overlapWords = words.slice(mid - 2, mid + 2).join(' ');
      
      results.push({
        text: part1 + ' ' + overlapWords,
        redStart: part1.length + 1,
        redEnd: (part1 + ' ' + overlapWords).length,
        charCount: (part1 + ' ' + overlapWords).length
      });
      
      results.push({
        text: overlapWords + ' ' + part2,
        redStart: 0,
        redEnd: overlapWords.length,
        charCount: (overlapWords + ' ' + part2).length
      });
    } else {
      // Too short and can't combine - pad with beginning words
      const words = current.split(' ');
      let padded = current;
      for (let j = 0; j < words.length && padded.length < minC; j++) {
        padded += ' ' + words[j];
      }
      
      results.push({
        text: padded,
        redStart: current.length + 1,
        redEnd: padded.length,
        charCount: padded.length
      });
    }
    
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
      const processedLines = processTextSimple(section.content);
      
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
  // Already handled in processTextSimple
  return data;
}
