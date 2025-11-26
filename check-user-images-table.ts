/**
 * Check user_images table for old library paths
 */

import { getDb } from './server/db';
import { userImages } from './drizzle/schema';

async function checkUserImagesTable() {
  console.log('🔍 Checking user_images table...\n');
  
  try {
    const db = await getDb();
    if (!db) {
      console.error('❌ Database not available');
      return;
    }
    
    const images = await db.select().from(userImages);
    console.log(`📊 Found ${images.length} images in user_images table\n`);
    
    const oldPattern = images.filter(img => img.imageUrl.includes('/library/'));
    const newPattern = images.filter(img => img.imageUrl.includes('/images/'));
    
    console.log('📊 DISTRIBUTION:');
    console.log('='.repeat(60));
    console.log(`Old pattern (/library/): ${oldPattern.length} images`);
    console.log(`New pattern (/images/):  ${newPattern.length} images`);
    console.log('='.repeat(60));
    
    if (oldPattern.length > 0) {
      console.log('\n❌ OLD PATTERN IMAGES (need migration):');
      oldPattern.forEach(img => {
        console.log(`  ID: ${img.id} | User: ${img.userId} | Character: ${img.characterName}`);
        console.log(`    ${img.imageUrl}\n`);
      });
    }
    
    if (newPattern.length > 0) {
      console.log('\n✅ NEW PATTERN IMAGES (already migrated):');
      newPattern.slice(0, 5).forEach(img => {
        console.log(`  ID: ${img.id} | User: ${img.userId} | Character: ${img.characterName}`);
        console.log(`    ${img.imageUrl}\n`);
      });
      if (newPattern.length > 5) {
        console.log(`  ... and ${newPattern.length - 5} more\n`);
      }
    }
    
    console.log('✅ Check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserImagesTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
