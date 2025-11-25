/**
 * Migration script: Move images from old structure to new structure
 * 
 * OLD: user-{userId}/library/{characterName}/{imageName}.png
 * NEW: users/{userId}/library/images/{characterName}/{imageName}.png
 * 
 * This script:
 * 1. Reads all userImages from database
 * 2. For each image:
 *    - Downloads from old path on BunnyCDN
 *    - Uploads to new path on BunnyCDN
 *    - Updates database with new URL
 * 3. Logs progress and errors
 */

import { getDb } from './db';
import { userImages } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { generateImageLibraryPath } from './storageHelpers';

// BunnyCDN configuration
const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
const BUNNYCDN_STORAGE_ZONE = 'manus-storage';
const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ imageId: number; error: string }>;
}

/**
 * Download file from BunnyCDN
 */
async function downloadFromBunny(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Upload file to BunnyCDN
 */
async function uploadToBunny(buffer: Buffer, fileName: string): Promise<string> {
  const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${fileName}`;
  
  const uploadResponse = await fetch(storageUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
      'Content-Type': 'image/png',
    },
    body: buffer,
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`BunnyCDN upload failed: ${uploadResponse.status} ${errorText}`);
  }
  
  return `${BUNNYCDN_PULL_ZONE_URL}/${fileName}`;
}

/**
 * Check if image is already migrated (new path structure)
 */
function isAlreadyMigrated(imageUrl: string): boolean {
  // New structure starts with: https://manus.b-cdn.net/users/{userId}/library/images/
  return imageUrl.includes('/users/') && imageUrl.includes('/library/images/');
}

/**
 * Migrate a single image
 */
async function migrateImage(image: any): Promise<{ success: boolean; newUrl?: string; error?: string }> {
  try {
    console.log(`[Migrate] Processing image ${image.id}: ${image.imageName} (character: ${image.characterName})`);
    
    // Check if already migrated
    if (isAlreadyMigrated(image.imageUrl)) {
      console.log(`[Migrate] Image ${image.id} already migrated, skipping`);
      return { success: true, newUrl: image.imageUrl };
    }
    
    // Download from old URL
    console.log(`[Migrate] Downloading from: ${image.imageUrl}`);
    const buffer = await downloadFromBunny(image.imageUrl);
    console.log(`[Migrate] Downloaded ${buffer.length} bytes`);
    
    // Generate new path
    const newFileName = generateImageLibraryPath(
      image.userId,
      image.characterName,
      image.imageName
    );
    console.log(`[Migrate] New path: ${newFileName}`);
    
    // Upload to new path
    const newUrl = await uploadToBunny(buffer, newFileName);
    console.log(`[Migrate] Uploaded to: ${newUrl}`);
    
    // Update database
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }
    await db.update(userImages)
      .set({
        imageUrl: newUrl,
        imageKey: newFileName,
      })
      .where(eq(userImages.id, image.id));
    
    console.log(`[Migrate] ✅ Image ${image.id} migrated successfully`);
    return { success: true, newUrl };
    
  } catch (error: any) {
    console.error(`[Migrate] ❌ Failed to migrate image ${image.id}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
export async function migrateAllImages(dryRun: boolean = false): Promise<MigrationStats> {
  console.log('='.repeat(80));
  console.log('IMAGE MIGRATION SCRIPT');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify database)'}`);
  console.log('');
  
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  
  try {
    // Get all images from database
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }
    const allImages = await db.select().from(userImages);
    stats.total = allImages.length;
    
    console.log(`Found ${stats.total} images in database`);
    console.log('');
    
    if (stats.total === 0) {
      console.log('No images to migrate');
      return stats;
    }
    
    // Migrate each image
    for (const image of allImages) {
      if (dryRun) {
        // Dry run: just check if needs migration
        if (isAlreadyMigrated(image.imageUrl)) {
          console.log(`[DRY RUN] Image ${image.id} already migrated`);
          stats.skipped++;
        } else {
          console.log(`[DRY RUN] Image ${image.id} needs migration: ${image.imageUrl}`);
          stats.migrated++;
        }
      } else {
        // Live run: actually migrate
        const result = await migrateImage(image);
        
        if (result.success) {
          if (result.newUrl === image.imageUrl) {
            stats.skipped++;
          } else {
            stats.migrated++;
          }
        } else {
          stats.failed++;
          stats.errors.push({
            imageId: image.id,
            error: result.error || 'Unknown error',
          });
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Print summary
    console.log('');
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total images: ${stats.total}`);
    console.log(`Migrated: ${stats.migrated}`);
    console.log(`Skipped (already migrated): ${stats.skipped}`);
    console.log(`Failed: ${stats.failed}`);
    
    if (stats.errors.length > 0) {
      console.log('');
      console.log('ERRORS:');
      stats.errors.forEach(({ imageId, error }) => {
        console.log(`  - Image ${imageId}: ${error}`);
      });
    }
    
    console.log('='.repeat(80));
    
  } catch (error: any) {
    console.error('Fatal error during migration:', error);
    throw error;
  }
  
  return stats;
}

// Run migration if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const dryRun = process.argv.includes('--dry-run');
  
  migrateAllImages(dryRun)
    .then(stats => {
      console.log('Migration completed successfully');
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
