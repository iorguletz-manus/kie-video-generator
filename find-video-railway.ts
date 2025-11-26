import { getDb } from './server/db';
import { contextSessions } from './drizzle/schema';
import { sql, like, desc } from 'drizzle-orm';

async function findVideo() {
  const db = await getDb();
  
  const videoName = 'T1_C1_E1_AD4_CTA1B_TEST';
  
  console.log(`\n🔍 Searching for video: ${videoName} in Railway MySQL\n`);
  
  try {
    // Find all sessions that contain this video
    const sessions = await db.select()
      .from(contextSessions)
      .where(like(contextSessions.videoResults, `%${videoName}%`))
      .orderBy(desc(contextSessions.updatedAt))
      .limit(5);
    
    console.log(`Found ${sessions.length} session(s) containing this video\n`);
    
    for (const session of sessions) {
      console.log(`\n========================================`);
      console.log(`Session ID: ${session.id}`);
      console.log(`User ID: ${session.userId}`);
      console.log(`Created: ${session.createdAt}`);
      console.log(`Updated: ${session.updatedAt}`);
      console.log(`========================================\n`);
      
      const videoResults = JSON.parse(session.videoResults);
      
      // Find the specific video
      const video = videoResults.find((v: any) => v.videoName === videoName);
      
      if (video) {
        console.log(`✅ Found video in session ${session.id}:\n`);
        console.log(JSON.stringify(video, null, 2));
        console.log(`\n`);
      }
      
      // Also show all videos in this session
      console.log(`\n📋 All videos in session ${session.id} (${videoResults.length} total):\n`);
      videoResults.forEach((v: any, i: number) => {
        console.log(`${i + 1}. ${v.videoName}`);
        console.log(`   - status: ${v.status}`);
        console.log(`   - reviewStatus: ${v.reviewStatus}`);
        console.log(`   - videoUrl: ${v.videoUrl ? v.videoUrl.substring(0, 80) + '...' : 'NO'}`);
        console.log(`   - trimmedVideoUrl: ${v.trimmedVideoUrl ? v.trimmedVideoUrl.substring(0, 80) + '...' : 'NO'}`);
        console.log(`   - recutStatus: ${v.recutStatus || 'N/A'}`);
        if (v.trimStart !== undefined) console.log(`   - trimStart: ${v.trimStart}`);
        if (v.trimEnd !== undefined) console.log(`   - trimEnd: ${v.trimEnd}`);
        console.log(``);
      });
    }
    
    // If not found, show recent sessions
    if (sessions.length === 0) {
      console.log(`\n⚠️ Video not found! Showing 3 most recent sessions:\n`);
      
      const recentSessions = await db.select()
        .from(contextSessions)
        .orderBy(desc(contextSessions.updatedAt))
        .limit(3);
      
      for (const session of recentSessions) {
        console.log(`\n========================================`);
        console.log(`Session ID: ${session.id}`);
        console.log(`User ID: ${session.userId}`);
        console.log(`Updated: ${session.updatedAt}`);
        
        const videoResults = JSON.parse(session.videoResults);
        console.log(`Videos: ${videoResults.length}`);
        console.log(`Video names: ${videoResults.map((v: any) => v.videoName).slice(0, 5).join(', ')}...`);
        console.log(`========================================`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

findVideo().catch(console.error).finally(() => process.exit(0));
