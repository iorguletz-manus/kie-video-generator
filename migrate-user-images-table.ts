/**
 * Migration Script: Update user_images table with new paths
 * 
 * OLD: user-{userId}/library/{characterName}/{imageName}.png
 * NEW: user-{userId}/images/{characterName}/{imageName}.png
 */

import { getDb } from './server/db';
import { userImages } from './drizzle/schema';
import { eq } from 'drizzle-orm';

const BUNNY_CDN_URL = 'https://manus.b-cdn.net';

/**
 * Convert old image path to new path
 */
function convertImagePath(oldUrl: string): string | null {
  const cdnPrefix = `${BUNNY_CDN_URL}/`;
  if (!oldUrl.startsWith(cdnPrefix)) {
    return null;
  }
  
  const oldPath = oldUrl.replace(cdnPrefix, '');
  
  // Match pattern: user-{userId}/library/{characterName}/{fileName}
  const match = oldPath.match(/^user-(\d+)\/library\/([^\/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  
  const [, userId, characterName, fileName] = match;
  
  // Convert to new structure: user-{userId}/images/{characterName}/{fileName}
  const newPath = `user-${userId}/images/${characterName.toLowerCase()}/${fileName}`;
  const newUrl = `${BUNNY_CDN_URL}/${newPath}`;
  
  return newUrl;
}

async function migrateUserImagesTable() {
  console.log('🚀 Starting user_images table migration...\n');
  
  try {
    const db = await getDb();
    if (!db) {
      console.error('❌ Database not available');
      return;
    }
    
    // Fetch all images
    const images = await db.select().from(userImages);
    console.log(`📊 Found ${images.length} images in user_images table\n`);
    
    let totalImages = 0;
    let updatedImages = 0;
    let skippedImages = 0;
    
    for (const image of images) {
      // Skip if already migrated
      if (image.imageUrl.includes('/images/')) {
        skippedImages++;
        continue;
      }
      
      // Skip if not library path
      if (!image.imageUrl.includes('/library/')) {
        skippedImages++;
        continue;
      }
      
      totalImages++;
      
      const oldUrl = image.imageUrl;
      const newUrl = convertImagePath(oldUrl);
      
      if (!newUrl) {
        console.log(`⚠️  Skipping invalid path: ${oldUrl}`);
        continue;
      }
      
      console.log(`📋 Updating image ID ${image.id}:`);
      console.log(`   OLD: ${oldUrl}`);
      console.log(`   NEW: ${newUrl}`);
      
      // Update database
      try {
        await db
          .update(userImages)
          .set({ 
            imageUrl: newUrl,
            imageKey: newUrl.replace(`${BUNNY_CDN_URL}/`, '')
          })
          .where(eq(userImages.id, image.id));
        
        console.log(`   ✅ Updated\n`);
        updatedImages++;
      } catch (error) {
        console.error(`   ❌ Failed to update: ${error}\n`);
      }
    }
    
    // Print summary
    console.log('='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total images in table:  ${images.length}`);
    console.log(`Images to migrate:      ${totalImages}`);
    console.log(`Successfully updated:   ${updatedImages}`);
    console.log(`Skipped (already new):  ${skippedImages}`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateUserImagesTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
