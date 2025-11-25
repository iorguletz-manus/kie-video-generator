import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { contextSessions, appUsers } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Find user iorguletz
const users = await db.select().from(appUsers).where(eq(appUsers.username, 'iorguletz'));
if (users.length === 0) {
  console.log('❌ User iorguletz not found');
  process.exit(1);
}
const user = users[0];
console.log(`✅ Found user: ${user.username} (ID: ${user.id})`);
console.log(`   CleanVoice API Key: ${user.cleanvoiceApiKey ? '✅ SET' : '❌ NOT SET'}`);

// Find context sessions for this user
const sessions = await db.select().from(contextSessions).where(eq(contextSessions.userId, user.id));
console.log(`\n📊 Found ${sessions.length} context sessions for user ${user.username}`);

// Check each session for the specific video
for (const session of sessions) {
  if (session.videoResults) {
    try {
      const videoResults = typeof session.videoResults === 'string' 
        ? JSON.parse(session.videoResults) 
        : session.videoResults;
    const targetVideo = videoResults.find(v => v.videoName === 'T1_C1_E1_AD2_HOOK2_TEST');
    
    if (targetVideo) {
      console.log(`\n🎯 Found video: T1_C1_E1_AD2_HOOK2_TEST`);
      console.log(`   Session ID: ${session.id}`);
      console.log(`   Video URL: ${targetVideo.videoUrl ? '✅' : '❌'}`);
      console.log(`   Audio URL: ${targetVideo.audioUrl ? '✅' : '❌'}`);
      console.log(`   CleanVoice Audio URL: ${targetVideo.cleanvoiceAudioUrl ? '✅ ' + targetVideo.cleanvoiceAudioUrl : '❌ NULL'}`);
      console.log(`   Status: ${targetVideo.status}`);
      console.log(`   Cut Points: ${targetVideo.cutPoints ? 'YES' : 'NO'}`);
      console.log(`   Whisper Transcript: ${targetVideo.whisperTranscript ? 'YES' : 'NO'}`);
    }
    } catch (e) {
      console.log(`⚠️  Session ${session.id}: Invalid JSON in videoResults`);
    }
  }
}

await connection.end();
