import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  // First get iorguletz user ID by email
  const [users] = await connection.execute(
    'SELECT id, email FROM users WHERE email LIKE ?',
    ['%iorguletz%']
  );
  
  if (users.length === 0) {
    console.log('User iorguletz not found');
    await connection.end();
    process.exit(0);
  }
  
  const userId = users[0].id;
  console.log(`\n✅ Found user: ${users[0].email} (ID: ${userId})\n`);
  
  // Get their context sessions with videoResults
  const [rows] = await connection.execute(
    'SELECT videoResults FROM context_sessions WHERE userId = ? AND videoResults IS NOT NULL LIMIT 10',
    [userId]
  );
  
  console.log(`Found ${rows.length} sessions with videoResults\n`);
  
  for (const row of rows) {
    if (row.videoResults) {
      const videoResults = row.videoResults;
      const video = videoResults.find(v => v.videoName === 'T1_C1_E1_AD2_HOOK3_TEST');
      
      if (video) {
        console.log('✅ Found T1_C1_E1_AD2_HOOK3_TEST!');
        if (video.whisperTranscript) {
          const transcript = JSON.parse(video.whisperTranscript);
          console.log('\n📊 First 5 words from Whisper transcript:\n');
          transcript.words.slice(0, 5).forEach((word, i) => {
            console.log(`${i + 1}. "${word.word}": ${word.start}ms - ${word.end}ms`);
          });
          console.log('');
          break;
        } else {
          console.log('⚠️ Video found but no whisperTranscript');
        }
      }
    }
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
