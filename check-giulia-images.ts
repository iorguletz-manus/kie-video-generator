/**
 * Check specific images for user-4 and Giulia character
 */

import { getDb } from './server/db';
import { contextSessions } from './drizzle/schema';

interface VideoResult {
  id: string;
  videoName: string;
  imageUrl?: string;
  [key: string]: any;
}

async function checkGiuliaImages() {
  console.log('🔍 Checking Giulia images in database...\n');
  
  try {
    const db = await getDb();
    if (!db) {
      console.error('❌ Database not available');
      return;
    }
    
    const sessions = await db.select().from(contextSessions);
    console.log(`📊 Found ${sessions.length} sessions\n`);
    
    const giuliaImages: { sessionId: number; videoName: string; imageUrl: string }[] = [];
    
    for (const session of sessions) {
      if (!session.videoResults) continue;
      
      let videoResults: VideoResult[];
      try {
        videoResults = typeof session.videoResults === 'string' 
          ? JSON.parse(session.videoResults) 
          : session.videoResults;
      } catch (error) {
        continue;
      }
      
      for (const video of videoResults) {
        if (!video.imageUrl) continue;
        
        // Check if it's Giulia image
        if (video.imageUrl.includes('Giulia') || video.imageUrl.includes('giulia')) {
          giuliaImages.push({
            sessionId: session.id,
            videoName: video.videoName,
            imageUrl: video.imageUrl
          });
        }
      }
    }
    
    console.log(`📊 GIULIA IMAGES FOUND: ${giuliaImages.length}\n`);
    
    const oldPattern = giuliaImages.filter(img => img.imageUrl.includes('/library/'));
    const newPattern = giuliaImages.filter(img => img.imageUrl.includes('/images/'));
    
    console.log(`Old pattern (/library/): ${oldPattern.length}`);
    console.log(`New pattern (/images/):  ${newPattern.length}\n`);
    
    if (oldPattern.length > 0) {
      console.log('❌ OLD PATTERN IMAGES (still in /library/):');
      oldPattern.forEach(img => {
        console.log(`  Session ${img.sessionId}: ${img.videoName}`);
        console.log(`    ${img.imageUrl}\n`);
      });
    }
    
    if (newPattern.length > 0) {
      console.log('✅ NEW PATTERN IMAGES (migrated to /images/):');
      newPattern.forEach(img => {
        console.log(`  Session ${img.sessionId}: ${img.videoName}`);
        console.log(`    ${img.imageUrl}\n`);
      });
    }
    
    console.log('✅ Check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkGiuliaImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
