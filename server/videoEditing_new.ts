// NEW ALGORITHM WITH DETAILED LOGGING
// Based on Scenariu.txt requirements

import { WhisperWord, CutPoints, EditingDebugInfo } from './videoEditing';

/**
 * Normalize text for comparison (remove punctuation, diacritics, hyphens, lowercase, trim)
 */
function normalizeText(text: string): string {
  return text
    // Remove hyphens (să-ți → să ți)
    .replace(/-/g, ' ')
    // Remove punctuation
    .replace(/[,\.:\;!?]/g, '')
    // Remove diacritics (ă→a, î→i, ș→s, ț→t, â→a)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ');
}

/**
 * Search for a sequence of words in transcript
 * Returns the index range if found, null otherwise
 */
function findSequence(
  words: WhisperWord[],
  searchWords: string[]
): { startIdx: number; endIdx: number } | null {
  const normalizedSearch = searchWords.map(normalizeText);

  for (let i = 0; i <= words.length - normalizedSearch.length; i++) {
    let match = true;
    
    for (let j = 0; j < normalizedSearch.length; j++) {
      const wordNormalized = normalizeText(words[i + j].word);
      if (wordNormalized !== normalizedSearch[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      return {
        startIdx: i,
        endIdx: i + normalizedSearch.length - 1,
      };
    }
  }

  return null;
}

/**
 * Check if sequence is at the beginning of transcript (within first 20% of words)
 */
function isAtBeginning(startIdx: number, totalWords: number): boolean {
  return startIdx < totalWords * 0.2;
}

/**
 * Check if sequence is at the end of transcript (within last 20% of words)
 */
function isAtEnd(endIdx: number, totalWords: number): boolean {
  return endIdx > totalWords * 0.8;
}

/**
 * NEW ALGORITHM: Calculate cut points with detailed logging
 */
export function calculateCutPointsNew(
  fullText: string,
  redText: string,
  words: WhisperWord[],
  redTextPosition: 'START' | 'END' | undefined,
  marginMs: number = 50
): { cutPoints: CutPoints | null; debugInfo: EditingDebugInfo } {
  const logs: string[] = [];
  const marginS = marginMs / 1000.0;
  
  // Check if this is a white-text-only video (no red text)
  const isWhiteTextOnly = !redText || redText.trim() === '';
  
  // Derive white text
  const whiteText = isWhiteTextOnly ? fullText.trim() : fullText.replace(redText, '').trim();
  const whiteWords = whiteText.split(/\s+/).filter(w => w.length > 0);
  const redWords = isWhiteTextOnly ? [] : redText.split(/\s+/).filter(w => w.length > 0);
  
  logs.push(`🔍 Starting search algorithm...`);
  logs.push(`📄 Full text: "${fullText}"`);
  
  if (isWhiteTextOnly) {
    logs.push(`⚪ White text only: "${whiteText}" (${whiteWords.length} words)`);
    logs.push(`🔴 No red text → searching for white text only`);
  } else {
    logs.push(`⚪ White text: "${whiteText}" (${whiteWords.length} words)`);
    logs.push(`🔴 Red text: "${redText}" (${redWords.length} words, position: ${redTextPosition})`);
  }
  
  logs.push(`🎤 Whisper transcript: "${words.map(w => w.word).join(' ')}" (${words.length} words)`);
  logs.push(``);
  
  // WHITE-TEXT-ONLY ALGORITHM
  if (isWhiteTextOnly) {
    // STEP 1: Search for entire white text
    logs.push(`🔎 Step 1: Searching for entire white text...`);
    const fullMatch = findSequence(words, whiteWords);
    
    if (fullMatch) {
      logs.push(`✅ Found entire white text at indices ${fullMatch.startIdx}-${fullMatch.endIdx}`);
      
      const startWord = words[fullMatch.startIdx];
      const endWord = words[fullMatch.endIdx];
      const startKeep = Math.max(0, (startWord.start - marginS) * 1000);
      const endKeep = (endWord.end + marginS) * 1000;
      
      logs.push(`✅ Placed START marker before "${startWord.word}" at ${startKeep.toFixed(0)}ms`);
      logs.push(`✅ Placed END marker after "${endWord.word}" at ${endKeep.toFixed(0)}ms`);
      logs.push(`🎯 Algorithm complete!`);
      
      return {
        cutPoints: {
          startKeep: Math.round(startKeep),
          endKeep: Math.round(endKeep),
          redPosition: undefined,
          confidence: 0.95,
        },
        debugInfo: {
          status: 'success',
          message: `✅ Found entire white text (no red text)`,
          whisperTranscript: words.map(w => w.word).join(' '),
          whisperWordCount: words.length,
          redTextDetected: {
            found: false,
            position: undefined,
            fullText: '',
          },
          logs,
        },
      };
    }
    
    logs.push(`❌ Entire white text NOT FOUND`);
    
    // STEP 2: Search for first 2-3 words
    logs.push(`🔎 Step 2: Searching for first 2-3 words of white text...`);
    let startKeep: number | null = null;
    
    for (let n = 3; n >= 2; n--) {
      if (whiteWords.length < n) continue;
      
      const firstNWords = whiteWords.slice(0, n);
      logs.push(`🔍 Searching for first ${n} words: "${firstNWords.join(' ')}"`);
      
      const match = findSequence(words, firstNWords);
      if (match) {
        logs.push(`✅ Found first ${n} words at indices ${match.startIdx}-${match.endIdx}`);
        
        const firstMatchWord = words[match.startIdx];
        startKeep = Math.max(0, (firstMatchWord.start - marginS) * 1000);
        
        logs.push(`✅ Placed START marker BEFORE first word "${firstMatchWord.word}" at ${startKeep.toFixed(0)}ms`);
        break;
      }
    }
    
    if (!startKeep) {
      logs.push(`❌ First 2-3 words NOT FOUND`);
      startKeep = 0;  // Default to beginning
      logs.push(`⚠️ Using default START marker at 0ms`);
    }
    
    // STEP 3: Search for last 2-3 words (ALWAYS, regardless of Step 2 result)
    logs.push(`🔎 Step 3: Searching for last 2-3 words of white text...`);
    let endKeep: number | null = null;
    
    for (let n = 3; n >= 2; n--) {
      if (whiteWords.length < n) continue;
      
      const lastNWords = whiteWords.slice(-n);
      logs.push(`🔍 Searching for last ${n} words: "${lastNWords.join(' ')}"`);
      
      const match = findSequence(words, lastNWords);
      if (match) {
        logs.push(`✅ Found last ${n} words at indices ${match.startIdx}-${match.endIdx}`);
        
        const lastMatchWord = words[match.endIdx];
        endKeep = (lastMatchWord.end + marginS) * 1000;
        
        logs.push(`✅ Placed END marker AFTER last word "${lastMatchWord.word}" at ${endKeep.toFixed(0)}ms`);
        break;
      }
    }
    
    if (!endKeep) {
      logs.push(`❌ Last 2-3 words NOT FOUND`);
      endKeep = (words[words.length - 1].end + marginS) * 1000;  // Default to end
      logs.push(`⚠️ Using default END marker at ${endKeep.toFixed(0)}ms`);
    }
    
    logs.push(`🎯 Algorithm complete!`);
    
    return {
      cutPoints: {
        startKeep: Math.round(startKeep),
        endKeep: Math.round(endKeep),
        redPosition: undefined,
        confidence: 0.75,
      },
      debugInfo: {
        status: 'success',
        message: `✅ Placed markers using first/last 2-3 words (no red text)`,
        whisperTranscript: words.map(w => w.word).join(' '),
        whisperWordCount: words.length,
        redTextDetected: {
          found: false,
          position: undefined,
          fullText: '',
        },
        logs,
      },
    };
  }
  
  // ORIGINAL ALGORITHM (with red text)
  // STEP 1: Search for entire white text
  logs.push(`🔎 Step 1: Searching for entire white text...`);
  const whiteMatch = findSequence(words, whiteWords);
  
  if (whiteMatch) {
    logs.push(`✅ Searched for entire white text: FOUND at indices ${whiteMatch.startIdx}-${whiteMatch.endIdx}`);
    
    const startWord = words[whiteMatch.startIdx];
    const endWord = words[whiteMatch.endIdx];
    
    const startKeep = Math.max(0, (startWord.start - marginS) * 1000);
    const endKeep = (endWord.end + marginS) * 1000;
    
    logs.push(`✅ Placed START marker before "${startWord.word}" at ${startKeep.toFixed(0)}ms`);
    logs.push(`✅ Placed END marker after "${endWord.word}" at ${endKeep.toFixed(0)}ms`);
    logs.push(`🎯 Algorithm complete!`);
    
    return {
      cutPoints: {
        startKeep: Math.round(startKeep),
        endKeep: Math.round(endKeep),
        redPosition: redTextPosition,
        confidence: 0.95,
      },
      debugInfo: {
        status: 'success',
        message: `✅ Found entire white text`,
        whisperTranscript: words.map(w => w.word).join(' '),
        whisperWordCount: words.length,
        redTextDetected: {
          found: true,
          position: redTextPosition,
          fullText: redText,
        },
        algorithmLogs: logs,
      },
    };
  }
  
  logs.push(`❌ Searched for entire white text: NOT FOUND`);
  logs.push(``);
  
  // STEP 2: Search for entire red text
  logs.push(`🔎 Step 2: Searching for entire red text...`);
  const redMatch = findSequence(words, redWords);
  
  if (redMatch) {
    logs.push(`✅ Searched for entire red text: FOUND at indices ${redMatch.startIdx}-${redMatch.endIdx}`);
    
    // Use redTextPosition from original text, not Whisper position!
    // (Red text might appear multiple times in Whisper, we need to use the original position)
    
    if (redTextPosition === 'END') {
      // Red text at END → place END marker BEFORE first red word
      logs.push(`✅ Red text is at END of transcript → placing END marker BEFORE first red word`);
      
      const firstRedWord = words[redMatch.startIdx];
      const startKeep = Math.max(0, (words[0].start - marginS) * 1000);
      const endKeep = (firstRedWord.start - marginS) * 1000;
      
      if (endKeep <= startKeep) {
        logs.push(`❌ No white text before red text - cannot calculate cut points`);
        
        return {
          cutPoints: null,
          debugInfo: {
            status: 'error',
            message: `❌ No white text before red text`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      }
      
      logs.push(`✅ Placed START marker at ${startKeep.toFixed(0)}ms`);
      logs.push(`✅ Placed END marker before "${firstRedWord.word}" at ${endKeep.toFixed(0)}ms`);
      logs.push(`🎯 Algorithm complete!`);
      
      return {
        cutPoints: {
          startKeep: Math.round(startKeep),
          endKeep: Math.round(endKeep),
          redPosition: 'END',
          confidence: 0.90,
        },
        debugInfo: {
          status: 'success',
          message: `✅ Found entire red text at END`,
          whisperTranscript: words.map(w => w.word).join(' '),
          whisperWordCount: words.length,
          redTextDetected: {
            found: true,
            position: 'END',
            fullText: redText,
            timeRange: { start: words[redMatch.startIdx].start, end: words[redMatch.endIdx].end },
          },
          algorithmLogs: logs,
        },
      };
    } else if (redTextPosition === 'START') {
      // Red text at START → place START marker AFTER last red word
      logs.push(`✅ Red text is at BEGINNING of original text → placing START marker AFTER last red word`);
      
      const lastRedWord = words[redMatch.endIdx];
      const startKeep = (lastRedWord.end + marginS) * 1000;
      const endKeep = (words[words.length - 1].end + marginS) * 1000;
      
      logs.push(`✅ Placed START marker after "${lastRedWord.word}" at ${startKeep.toFixed(0)}ms`);
      logs.push(`✅ Placed END marker at ${endKeep.toFixed(0)}ms`);
      logs.push(`🎯 Algorithm complete!`);
      
      return {
        cutPoints: {
          startKeep: Math.round(startKeep),
          endKeep: Math.round(endKeep),
          redPosition: 'START',
          confidence: 0.90,
        },
        debugInfo: {
          status: 'success',
          message: `✅ Found entire red text at START`,
          whisperTranscript: words.map(w => w.word).join(' '),
          whisperWordCount: words.length,
          redTextDetected: {
            found: true,
            position: 'START',
            fullText: redText,
            timeRange: { start: words[redMatch.startIdx].start, end: words[redMatch.endIdx].end },
          },
          algorithmLogs: logs,
        },
      };
    }
  }
  
  logs.push(`❌ Searched for entire red text: NOT FOUND`);
  logs.push(``);
  
  // STEP 3: Search for last 3/2 words of white text
  logs.push(`🔎 Step 3: Searching for last 3 words of white text...`);
  
  for (let n = 3; n >= 2; n--) {
    if (whiteWords.length < n) continue;
    
    const lastNWords = whiteWords.slice(-n);
    logs.push(`🔍 Searching for last ${n} white words: "${lastNWords.join(' ')}"`);
    
    const match = findSequence(words, lastNWords);
    
    if (match) {
      logs.push(`✅ Found last ${n} white words at indices ${match.startIdx}-${match.endIdx}`);
      
      // Check if white text is at beginning of original text
      if (redTextPosition === 'END') {
        // White text is at beginning → START marker at first white word, END marker after last white word
        logs.push(`✅ White text is at beginning → START at first white word, END after last white word`);
        
        const firstMatchWord = words[match.startIdx];
        const lastMatchWord = words[match.endIdx];
        const startKeep = Math.max(0, (firstMatchWord.start - marginS) * 1000);
        const endKeep = (lastMatchWord.end + marginS) * 1000;
        
        logs.push(`✅ Placed START marker at first white word "${firstMatchWord.word}" at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker after last white word "${lastMatchWord.word}" at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'END',
            confidence: 0.80,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found last ${n} white words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`⚠️ White text is at end → last words don't help us`);
      }
    } else {
      logs.push(`❌ Last ${n} white words: NOT FOUND`);
    }
  }
  
  logs.push(``);
  
  // STEP 4: Search for first 3/2 words of white text
  logs.push(`🔎 Step 4: Searching for first 3 words of white text...`);
  
  for (let n = 3; n >= 2; n--) {
    if (whiteWords.length < n) continue;
    
    const firstNWords = whiteWords.slice(0, n);
    logs.push(`🔍 Searching for first ${n} white words: "${firstNWords.join(' ')}"`);
    
    const match = findSequence(words, firstNWords);
    
    if (match) {
      logs.push(`✅ Found first ${n} white words at indices ${match.startIdx}-${match.endIdx}`);
      
      // Check if white text is at end of original text
      if (redTextPosition === 'START') {
        // White text is at end → START marker at first white word, END marker after last white word
        logs.push(`✅ White text is at end → START at first white word, END after last white word`);
        
        const firstMatchWord = words[match.startIdx];
        const lastMatchWord = words[match.endIdx];
        const startKeep = (firstMatchWord.start - marginS) * 1000;
        const endKeep = (lastMatchWord.end + marginS) * 1000;
        
        logs.push(`✅ Placed START marker at first white word "${firstMatchWord.word}" at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker after last white word "${lastMatchWord.word}" at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'START',
            confidence: 0.80,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found first ${n} white words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`⚠️ White text is at beginning → first words don't help us`);
      }
    } else {
      logs.push(`❌ First ${n} white words: NOT FOUND`);
    }
  }
  
  logs.push(``);
  
  // STEP 5: Search for last 3/2 words of red text (if red at START)
  if (redTextPosition === 'START') {
    logs.push(`🔎 Step 5: Red text is at START → searching for last 3 words of red text...`);
    
    for (let n = 3; n >= 2; n--) {
      if (redWords.length < n) continue;
      
      const lastNWords = redWords.slice(-n);
      logs.push(`🔍 Searching for last ${n} red words: "${lastNWords.join(' ')}"`);
      
      const match = findSequence(words, lastNWords);
      
      if (match) {
        logs.push(`✅ Found last ${n} red words at indices ${match.startIdx}-${match.endIdx}`);
        logs.push(`✅ This marks END of red text → placing START marker AFTER last word`);
        
        const lastMatchWord = words[match.endIdx];
        const startKeep = (lastMatchWord.end + marginS) * 1000;
        const endKeep = (words[words.length - 1].end + marginS) * 1000;
        
        logs.push(`✅ Placed START marker after "${lastMatchWord.word}" at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'START',
            confidence: 0.75,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found last ${n} red words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`❌ Last ${n} red words: NOT FOUND`);
      }
    }
  }
  
  // STEP 6: Search for first 3/2 words of red text (if red at END)
  if (redTextPosition === 'END') {
    logs.push(`🔎 Step 6: Red text is at END → searching for first 3 words of red text...`);
    
    for (let n = 3; n >= 2; n--) {
      if (redWords.length < n) continue;
      
      const firstNWords = redWords.slice(0, n);
      logs.push(`🔍 Searching for first ${n} red words: "${firstNWords.join(' ')}"`);
      
      const match = findSequence(words, firstNWords);
      
      if (match) {
        logs.push(`✅ Found first ${n} red words at indices ${match.startIdx}-${match.endIdx}`);
        logs.push(`✅ This marks START of red text → placing END marker BEFORE first word`);
        
        const firstMatchWord = words[match.startIdx];
        const startKeep = Math.max(0, (words[0].start - marginS) * 1000);
        const endKeep = (firstMatchWord.start - marginS) * 1000;
        
        if (endKeep <= startKeep) {
          logs.push(`❌ No white text before red text - cannot calculate cut points`);
          
          return {
            cutPoints: null,
            debugInfo: {
              status: 'error',
              message: `❌ No white text before red text`,
              whisperTranscript: words.map(w => w.word).join(' '),
              whisperWordCount: words.length,
              algorithmLogs: logs,
            },
          };
        }
        
        logs.push(`✅ Placed START marker at ${startKeep.toFixed(0)}ms`);
        logs.push(`✅ Placed END marker before "${firstMatchWord.word}" at ${endKeep.toFixed(0)}ms`);
        logs.push(`🎯 Algorithm complete!`);
        
        return {
          cutPoints: {
            startKeep: Math.round(startKeep),
            endKeep: Math.round(endKeep),
            redPosition: 'END',
            confidence: 0.75,
          },
          debugInfo: {
            status: 'success',
            message: `✅ Found first ${n} red words`,
            whisperTranscript: words.map(w => w.word).join(' '),
            whisperWordCount: words.length,
            algorithmLogs: logs,
          },
        };
      } else {
        logs.push(`❌ First ${n} red words: NOT FOUND`);
      }
    }
  }
  
  // FAILURE: No matches found
  logs.push(``);
  logs.push(`❌ Algorithm failed: Could not find any matching text in transcript`);
  
  return {
    cutPoints: null,
    debugInfo: {
      status: 'error',
      message: `❌ Could not find any matching text`,
      whisperTranscript: words.map(w => w.word).join(' '),
      whisperWordCount: words.length,
      algorithmLogs: logs,
    },
  };
}
