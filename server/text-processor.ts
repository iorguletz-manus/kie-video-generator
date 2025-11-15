/**
 * TEXT PROCESSOR - Port of complete_processor.py
 * Processes ad text to ensure 118-125 characters per line
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
  category?: string;        // Normalized category (HOOKS, MIRROR, etc.)
  subcategory?: string;     // Subcategory (H1, H2, etc.) or null
  displayName?: string;     // Display name for UI
  redStart?: number;
  redEnd?: number;
  charCount?: number;
}

/**
 * Category normalization mapping
 * Maps all variants to standard database names
 */
const CATEGORY_MAPPINGS: Record<string, { category: string; display: string }> = {
  // HOOKS and subcategories
  'HOOKS': { category: 'HOOKS', display: 'HOOKS' },
  'HOOK': { category: 'HOOKS', display: 'HOOKS' },
  
  // MIRROR
  'MIRROR': { category: 'MIRROR', display: 'MIRROR' },
  
  // DCS
  'DCS': { category: 'DCS', display: 'DCS' },
  'DCS & IDENTITY': { category: 'DCS', display: 'DCS' },
  'DCS IDENTITY': { category: 'DCS', display: 'DCS' },
  'IDENTITY': { category: 'DCS', display: 'DCS' },
  
  // TRANZITION
  'TRANZITION': { category: 'TRANZITION', display: 'TRANZITION' },
  'TRANZITIE': { category: 'TRANZITION', display: 'TRANZITION' },
  
  // NEW CAUSE
  'NEW CAUSE': { category: 'NEW CAUSE', display: 'NEW CAUSE' },
  'NEW_CAUSE': { category: 'NEW CAUSE', display: 'NEW CAUSE' },
  'NEW-CAUSE': { category: 'NEW CAUSE', display: 'NEW CAUSE' },
  'CAUSE': { category: 'NEW CAUSE', display: 'NEW CAUSE' },
  
  // MECHANISM
  'MECHANISM': { category: 'MECHANISM', display: 'MECHANISM' },
  
  // EMOTIONAL PROOF
  'EMOTIONAL PROOF': { category: 'EMOTIONAL PROOF', display: 'EMOTIONAL PROOF' },
  'EMOTIONAL_PROOF': { category: 'EMOTIONAL PROOF', display: 'EMOTIONAL PROOF' },
  
  // TRANSFORMATION
  'TRANSFORMATION': { category: 'TRANSFORMATION', display: 'TRANSFORMATION' },
  
  // CTA
  'CTA': { category: 'CTA', display: 'CTA' },
};

/**
 * Normalize text: remove diacritics, uppercase, normalize separators
 */
function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[_-]/g, ' ')            // Replace _ and - with space
    .trim();
}

/**
 * Extract and normalize category from label text
 * Returns { category, subcategory, displayName } or null
 */
function normalizeCategory(rawLabel: string): { category: string; subcategory: string | null; displayName: string } | null {
  const normalized = normalizeText(rawLabel);
  
  // Check for H1-H100 (HOOKS subcategories)
  const hMatch = normalized.match(/^H(\d{1,3})$/);
  if (hMatch) {
    const num = parseInt(hMatch[1]);
    if (num >= 1 && num <= 100) {
      return {
        category: 'HOOKS',
        subcategory: `H${num}`,
        displayName: `H${num}`
      };
    }
  }
  
  // Check known categories
  const mapping = CATEGORY_MAPPINGS[normalized];
  if (mapping) {
    return {
      category: mapping.category,
      subcategory: null,
      displayName: mapping.display
    };
  }
  
  return null;
}

/**
 * Check if a line is a label and extract category info
 * Supports 4 formats:
 * 1. "H1" (standalone)
 * 2. "H1:" (with colon)
 * 3. "H1 [content]" (space + content)
 * 4. "H1: [content]" (colon + content)
 */
function parseLabel(line: string): { isLabel: boolean; categoryInfo: any; content: string | null } {
  const trimmed = line.trim();
  
  if (!trimmed) {
    return { isLabel: false, categoryInfo: null, content: null };
  }
  
  // Format 1 & 2: "H1" or "H1:" (standalone)
  const standaloneMatch = trimmed.match(/^([A-Z0-9\s_-]+):?\s*$/i);
  if (standaloneMatch) {
    const categoryInfo = normalizeCategory(standaloneMatch[1]);
    if (categoryInfo) {
      return { isLabel: true, categoryInfo, content: null };
    }
  }
  
  // Format 3 & 4: "H1 [content]" or "H1: [content]"
  const prefixMatch = trimmed.match(/^([A-Z0-9\s_-]+):?\s+(.+)$/i);
  if (prefixMatch) {
    const potentialLabel = prefixMatch[1];
    const potentialContent = prefixMatch[2];
    
    // Only treat as label if it's short enough and valid
    if (potentialLabel.length <= 30) {
      const categoryInfo = normalizeCategory(potentialLabel);
      if (categoryInfo) {
        return { isLabel: true, categoryInfo, content: potentialContent };
      }
    }
  }
  
  return { isLabel: false, categoryInfo: null, content: trimmed };
}

/**
 * Add Romanian diacritics to text
 */
function addDiacritics(text: string): string {
  const replacements: Record<string, string> = {
    'saturat': 'săturat', 'traiasca': 'trăiască', 'traiesc': 'trăiesc', 'traiesti': 'trăiești', 'traiam': 'trăiam',
    'sa': 'să', 'si': 'și', 'asa': 'așa', 'iti': 'îți', 'isi': 'își', 'imi': 'îmi',
    'luna': 'lună', 'viata': 'viața', 'vietii': 'vieții',
    'straduiesc': 'străduiesc', 'reusesc': 'reuşesc', 'reusea': 'reuşea', 'reușeam': 'reuşeam',
    'stiu': 'știu', 'stia': 'știa', 'simti': 'simți', 'poti': 'poți',
    'vina': 'vină', 'renunti': 'renunți', 'pana': 'până',
    'daca': 'dacă', 'supravietuire': 'supraviețuire', 'asculta-ma': 'ascultă-mă',
    'muncesti': 'muncești', 'platesti': 'plătești', 'bucuri': 'bucuri',
    'fura': 'fură', 'linistea': 'liniștea',
    'uiti': 'uiți', 'uita': 'uită', 'platesc': 'plătesc',
    'iesire': 'ieșire',
    'lupta': 'luptă',
    'fara': 'fără', 'plateam': 'plăteam', 'rata': 'rată', 'apareau': 'apăreau',
    'parca': 'parcă', 'acopar': 'acopăr', 'gaurile': 'găurile', 'seara': 'seară',
    'intrebam': 'întrebam', 'chinui': 'chinui', 'ma': 'mă',
    'uitase': 'uitase', 'libertatea': 'libertatea', 'supravietuiasca': 'supraviețuiască',
    'intr-o': 'într-o', 'blocata': 'blocată', 'castig': 'câștig',
    'prinsa': 'prinsă', 'ganduri': 'gânduri',
    'aratat': 'arătat', 'gandurile': 'gândurile', 'fricile': 'fricile',
    'blocheaza': 'blochează', 'sterse': 'șterse', 'metoda': 'metodă', 'mintii': 'minții',
    'sceptica': 'sceptică', 'inceput': 'început', 'deschid': 'deschid',
    'ajuns': 'ajuns', 'visam': 'visam', 'linistit': 'liniștit',
    'astazi': 'astăzi', 'supravietuieste': 'supraviețuiește', 'siguranta': 'siguranță',
    'doresti': 'dorești', 'castigi': 'câștigi', 'masura': 'măsura',
    'recomand': 'recomand', 'toata': 'toată', 'inima': 'inimă', 'aceasta': 'această',
    'prezentata': 'prezentată', 'catre': 'către', 'rescrie': 'rescrie', 'povestea': 'povestea',
    'capat': 'capăt', 'cauza': 'cauză', 'adevarat': 'adevărat', 'cand': 'când', 'ca': 'că',
    'doua': 'două', 'in': 'în',
  };

  const words = text.split(' ');
  const result: string[] = [];

  for (const word of words) {
    const match = word.match(/^([^\w]*)(.+?)([^\w]*)$/u);
    if (match) {
      const [, prefix, core, suffix] = match;
      const coreLower = core.toLowerCase();
      if (replacements[coreLower]) {
        let replacement = replacements[coreLower];
        if (core && core[0] === core[0].toUpperCase()) {
          replacement = replacement[0].toUpperCase() + replacement.slice(1);
        }
        result.push(prefix + replacement + suffix);
      } else {
        result.push(word);
      }
    } else {
      result.push(word);
    }
  }

  return result.join(' ');
}

/**
 * Split text into sentences based on . ! ?
 */
function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  const words = text.split(' ');
  let current: string[] = [];

  for (const word of words) {
    current.push(word);
    if (word[word.length - 1] && '.!?'.includes(word[word.length - 1])) {
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

  const words = text.split(' ');
  const addedWords: string[] = [];

  // Keep adding words until we reach target
  for (let cycle = 0; cycle < 10; cycle++) {
    for (const word of words) {
      const testLen = (text + ' ' + [...addedWords, word].join(' ')).length;
      if (testLen <= maxC) {
        addedWords.push(word);
        if (testLen >= minC && testLen >= target) {
          break;
        }
      } else {
        break;
      }
    }

    if ((text + ' ' + addedWords.join(' ')).length >= minC) {
      break;
    }
  }

  let addedText = addedWords.join(' ');
  let fullText = text + ' ' + addedText;

  // Trim if over maxC
  while (fullText.length > maxC && addedText.includes(' ')) {
    addedWords.pop();
    addedText = addedWords.join(' ');
    fullText = text + ' ' + addedText;
  }

  const redStart = text.length + 1;
  const redEnd = fullText.length;

  return { text: fullText, redStart, redEnd, charCount: fullText.length };
}

/**
 * Process long sentence with strategic overlap
 */
function processLongSentenceWithOverlap(text: string, minC: number = 118, maxC: number = 125): ProcessedLine[] {
  const results: ProcessedLine[] = [];

  // Version 1: First part
  const rand1 = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  let version1 = text.slice(0, rand1).trimEnd();

  // Adjust to word boundary
  if (version1.includes(' ')) {
    const words = version1.split(' ');
    version1 = words.join(' ');
  }

  results.push({ text: version1, redStart: -1, redEnd: -1, charCount: version1.length });

  // Version 2: Last part
  const rand2 = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
  let version2 = text.slice(-rand2).trimStart();

  // Adjust to word boundary
  if (version2.includes(' ')) {
    const words = version2.split(' ');
    version2 = words.join(' ');
  }

  // Find strategic CUT point
  const words = version2.split(' ');
  let strategicCutIdx = -1;

  // Look for punctuation marks
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word[word.length - 1] && ':,'.includes(word[word.length - 1])) {
      const remaining = words.slice(i + 1).join(' ');
      if (remaining.length >= 50) {
        strategicCutIdx = i + 1;
        break;
      }
    }
  }

  // Look for transition words
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

  // Fallback: 30% of text
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
    results.push({ text: version2, redStart: -1, redEnd: -1, charCount: version2.length });
  }

  return results;
}

/**
 * Main processing function
 */
function processText(text: string, minC: number = 118, maxC: number = 125): ProcessedLine[] {
  text = text.trim();
  if (!text) {
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
    i += 1;
  }

  return results;
}

/**
 * Process full document text
 */
export function processAdDocument(rawText: string): OutputItem[] {
  // Remove [HEADER]...[/HEADER] sections
  let cleanedText = rawText.replace(/\[HEADER\][\s\S]*?\[\/HEADER\]/gi, '');
  
  const lines = cleanedText.split('\n');
  const outputData: OutputItem[] = [];
  let currentText: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const { isLabel, categoryInfo, content } = parseLabel(trimmedLine);

    if (isLabel && categoryInfo) {
      // Process any accumulated text before this label
      if (currentText.length > 0) {
        const full = currentText.join(' ');
        const processed = processText(full);

        for (const { text, redStart, redEnd, charCount } of processed) {
          outputData.push({
            type: 'text',
            text,
            redStart,
            redEnd,
            charCount,
          });
        }

        currentText = [];
      }

      // Add label with normalized category info
      outputData.push({ 
        type: 'label', 
        text: categoryInfo.displayName,
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        displayName: categoryInfo.displayName
      });
      
      // If content is on same line, add it to currentText
      if (content) {
        currentText.push(content);
      }
    } else {
      // Regular content line
      currentText.push(trimmedLine);
    }
  }

  // Process remaining text
  if (currentText.length > 0) {
    const full = currentText.join(' ');
    const processed = processText(full);

    for (const { text, redStart, redEnd, charCount } of processed) {
      outputData.push({
        type: 'text',
        text,
        redStart,
        redEnd,
        charCount,
      });
    }
  }

  return outputData;
}

/**
 * Add red on Line 1 for overlap pairs (Phase 2)
 */
export function addRedOnLine1(outputData: OutputItem[]): OutputItem[] {
  const result: OutputItem[] = [];
  let i = 0;

  while (i < outputData.length) {
    const item = outputData[i];

    if (item.type === 'text' && i + 1 < outputData.length) {
      const nextItem = outputData[i + 1];

      if (nextItem.type === 'text') {
        const l1HasRed = item.redStart !== undefined && item.redStart >= 0;
        const l2HasRed = nextItem.redStart !== undefined && nextItem.redStart >= 0;

        if (l2HasRed && !l1HasRed && nextItem.redEnd !== undefined) {
          // Find first normal text after red on Line 2
          const l2Text = nextItem.text;
          const l2NormalText = l2Text.slice(nextItem.redEnd);

          if (l2NormalText.length >= 5) {
            const searchStr = l2NormalText.slice(0, 5);
            const l1Text = item.text;
            let idx = l1Text.indexOf(searchStr);

            // Ensure minimum 40 chars before red
            if (idx !== -1 && idx < 40) {
              const naturalBreaks = ['. ', '! ', '? ', ': ', ', ', ' și ', ' dar ', ' pentru că ', ' când ', ' dacă '];
              let bestIdx = idx;

              for (const breakStr of naturalBreaks) {
                const tempIdx = l1Text.lastIndexOf(breakStr, idx);
                if (tempIdx !== -1) {
                  const potentialNormalLen = tempIdx + breakStr.length;
                  if (potentialNormalLen >= 40) {
                    bestIdx = potentialNormalLen;
                    break;
                  }
                }
              }

              idx = bestIdx;
            }

            if (idx >= 40) {
              // Add red from idx to end on Line 1
              result.push({
                ...item,
                redStart: idx,
                redEnd: l1Text.length,
              });
              result.push(nextItem);
              i += 2;
              continue;
            }
          }
        }
      }
    }

    result.push(item);
    i += 1;
  }

  return result;
}
