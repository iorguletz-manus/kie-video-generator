import { processAdDocument } from './server/services/text-processor.js';
import fs from 'fs';

const testText = fs.readFileSync('./test-document.txt', 'utf-8');

console.log('=== TESTING TEXT PROCESSOR ===\n');
console.log('Input text length:', testText.length);
console.log('\n=== PROCESSING ===\n');

const result = processAdDocument(testText);

console.log('\n=== RESULTS ===\n');
console.log('Total lines processed:', result.lines.length);
console.log('\n=== LINES ===\n');

result.lines.forEach((line, idx) => {
  console.log(`\n[${idx + 1}] ${line.category} / ${line.subcategory || 'N/A'}`);
  console.log(`    Original: ${line.originalText.substring(0, 80)}...`);
  console.log(`    Processed: ${line.processedText}`);
  console.log(`    Length: ${line.processedText.length} chars`);
  if (line.addedText) {
    console.log(`    Added: "${line.addedText}"`);
  }
});

console.log('\n=== CATEGORY SUMMARY ===\n');
const categories = new Set(result.lines.map(l => l.category));
categories.forEach(cat => {
  const count = result.lines.filter(l => l.category === cat).length;
  console.log(`${cat}: ${count} lines`);
});
