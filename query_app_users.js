import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  // Check app_users table structure first
  const [schema] = await connection.execute('DESCRIBE app_users');
  console.log('\n📋 app_users columns:\n');
  schema.forEach((row) => {
    console.log(`- ${row.Field}`);
  });
  
  // List all app_users
  const [users] = await connection.execute('SELECT * FROM app_users LIMIT 10');
  console.log(`\n👥 Found ${users.length} app_users\n`);
  
  if (users.length > 0) {
    console.log('First user:', JSON.stringify(users[0], null, 2));
  }
  
  // Try to find iorguletz
  for (const user of users) {
    if (JSON.stringify(user).toLowerCase().includes('iorguletz')) {
      console.log('\n✅ Found iorguletz:', user);
      
      // Now query context_sessions for this user
      const [sessions] = await connection.execute(
        'SELECT videoResults FROM context_sessions WHERE userId = ? AND videoResults IS NOT NULL LIMIT 10',
        [user.id]
      );
      
      console.log(`\nFound ${sessions.length} sessions with videoResults\n`);
      
      for (const row of sessions) {
        if (row.videoResults) {
          const videoResults = row.videoResults;
          const video = videoResults.find(v => v.videoName === 'T1_C1_E1_AD2_HOOK3_TEST');
          
          if (video && video.whisperTranscript) {
            const transcript = JSON.parse(video.whisperTranscript);
            console.log('\n📊 First 5 words from Whisper transcript:\n');
            transcript.words.slice(0, 5).forEach((word, i) => {
              console.log(`${i + 1}. "${word.word}": ${word.start}ms - ${word.end}ms`);
            });
            console.log('');
            break;
          }
        }
      }
      break;
    }
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
