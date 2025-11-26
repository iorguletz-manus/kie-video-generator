/**
 * Check what images exist in database before migration
 */

import { getDb } from './server/db';
import { contextSessions } from './drizzle/schema';

interface VideoResult {
  id: string;
  videoName: string;
  imageUrl?: string;
  [key: string]: any;
}

async function checkImages() {
  console.log('🔍 Checking images in database...\n');
  
  try {
    const db = await getDb();
    if (!db) {
      console.error('❌ Database not available');
      return;
    }
    
    const sessions = await db.select().from(contextSessions);
    console.log(`📊 Found ${sessions.length} sessions\n`);
    
    const imagesByPattern: { [key: string]: string[] } = {
      'library': [],
      'images': [],
      'other': []
    };
    
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
        
        if (video.imageUrl.includes('/library/')) {
          imagesByPattern['library'].push(video.imageUrl);
        } else if (video.imageUrl.includes('/images/')) {
          imagesByPattern['images'].push(video.imageUrl);
        } else {
          imagesByPattern['other'].push(video.imageUrl);
        }
      }
    }
    
    console.log('📊 IMAGE DISTRIBUTION:');
    console.log('='.repeat(60));
    console.log(`Old pattern (/library/):  ${imagesByPattern['library'].length} images`);
    console.log(`New pattern (/images/):   ${imagesByPattern['images'].length} images`);
    console.log(`Other patterns:           ${imagesByPattern['other'].length} images`);
    console.log('='.repeat(60));
    
    if (imagesByPattern['library'].length > 0) {
      console.log('\n📋 SAMPLE OLD PATHS (first 5):');
      imagesByPattern['library'].slice(0, 5).forEach(url => {
        console.log(`  - ${url}`);
      });
    }
    
    if (imagesByPattern['images'].length > 0) {
      console.log('\n✅ SAMPLE NEW PATHS (first 5):');
      imagesByPattern['images'].slice(0, 5).forEach(url => {
        console.log(`  - ${url}`);
      });
    }
    
    if (imagesByPattern['other'].length > 0) {
      console.log('\n⚠️  OTHER PATHS (first 5):');
      imagesByPattern['other'].slice(0, 5).forEach(url => {
        console.log(`  - ${url}`);
      });
    }
    
    console.log('\n✅ Check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
