/**
 * Migration Script: Bunny CDN Images Folder Restructure
 * 
 * OLD Structure: user-{userId}/library/{characterName}/{imageName}.png
 * NEW Structure: user-{userId}/images/{characterName}/{imageName}.png
 * 
 * Steps:
 * 1. Fetch all context_sessions from database
 * 2. Parse videoResults JSON to find all image URLs
 * 3. For each image:
 *    - Copy from old path to new path on Bunny CDN
 *    - Update URL in videoResults JSON
 * 4. Update database with new videoResults
 */

import { getDb } from './server/db';
import { contextSessions } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';

const BUNNY_STORAGE_ZONE = 'manus-storage';
const BUNNY_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
const BUNNY_STORAGE_URL = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
const BUNNY_CDN_URL = `https://manus.b-cdn.net`;

interface VideoResult {
  id: string;
  videoName: string;
  imageUrl?: string;
  [key: string]: any;
}

/**
 * Copy file on Bunny CDN from old path to new path
 */
async function copyFileOnBunny(oldPath: string, newPath: string): Promise<boolean> {
  try {
    console.log(`📋 Copying: ${oldPath} → ${newPath}`);
    
    // 1. Download file from old path
    const downloadUrl = `${BUNNY_CDN_URL}/${oldPath}`;
    const downloadResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    if (downloadResponse.status !== 200) {
      console.error(`❌ Failed to download: ${oldPath}`);
      return false;
    }
    
    // 2. Upload to new path
    const uploadUrl = `${BUNNY_STORAGE_URL}/${newPath}`;
    const uploadResponse = await axios.put(uploadUrl, downloadResponse.data, {
      headers: {
        'AccessKey': BUNNY_STORAGE_PASSWORD,
        'Content-Type': 'image/png'
      },
      timeout: 30000
    });
    
    if (uploadResponse.status === 201) {
      console.log(`✅ Copied successfully: ${newPath}`);
      return true;
    } else {
      console.error(`❌ Failed to upload: ${newPath} (Status: ${uploadResponse.status})`);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Error copying ${oldPath}:`, error.message);
    return false;
  }
}

/**
 * Convert old image path to new path
 * OLD: user-1/library/Test/alina-portrait-1234567890.png
 * NEW: user-1/images/test/alina-portrait-1234567890.png
 */
function convertImagePath(oldUrl: string): string | null {
  // Extract path from CDN URL
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
  
  return newPath;
}

/**
 * Main migration function
 */
async function migrateImages() {
  console.log('🚀 Starting Bunny CDN Image Migration...\n');
  
  try {
    const db = await getDb();
    if (!db) {
      console.error('❌ Database not available');
      return;
    }
    
    // 1. Fetch all sessions from database
    console.log('📊 Fetching all context sessions from database...');
    const sessions = await db.select().from(contextSessions);
    console.log(`✅ Found ${sessions.length} sessions\n`);
    
    let totalImages = 0;
    let migratedImages = 0;
    let failedImages = 0;
    let updatedSessions = 0;
    
    // 2. Process each session
    for (const session of sessions) {
      if (!session.videoResults) {
        continue;
      }
      
      console.log(`\n📦 Processing Session ID: ${session.id}`);
      
      // Parse videoResults
      let videoResults: VideoResult[];
      try {
        videoResults = typeof session.videoResults === 'string' 
          ? JSON.parse(session.videoResults) 
          : session.videoResults;
      } catch (error) {
        console.error(`❌ Failed to parse videoResults for session ${session.id}`);
        continue;
      }
      
      let sessionModified = false;
      
      // 3. Process each video in videoResults
      for (const video of videoResults) {
        if (!video.imageUrl) {
          continue;
        }
        
        // Check if it's an old library path
        if (!video.imageUrl.includes('/library/')) {
          continue;
        }
        
        totalImages++;
        
        const oldUrl = video.imageUrl;
        const newPath = convertImagePath(oldUrl);
        
        if (!newPath) {
          console.log(`⚠️  Skipping invalid path: ${oldUrl}`);
          continue;
        }
        
        const oldPath = oldUrl.replace(`${BUNNY_CDN_URL}/`, '');
        
        // Copy file on Bunny CDN
        const success = await copyFileOnBunny(oldPath, newPath);
        
        if (success) {
          // Update URL in videoResults
          video.imageUrl = `${BUNNY_CDN_URL}/${newPath}`;
          sessionModified = true;
          migratedImages++;
        } else {
          failedImages++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 4. Update database if session was modified
      if (sessionModified) {
        try {
          await db
            .update(contextSessions)
            .set({ videoResults: JSON.stringify(videoResults) })
            .where(eq(contextSessions.id, session.id));
          
          console.log(`✅ Updated database for session ${session.id}`);
          updatedSessions++;
        } catch (error) {
          console.error(`❌ Failed to update database for session ${session.id}:`, error);
        }
      }
    }
    
    // 5. Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total images found:     ${totalImages}`);
    console.log(`Successfully migrated:  ${migratedImages}`);
    console.log(`Failed:                 ${failedImages}`);
    console.log(`Sessions updated:       ${updatedSessions}`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
