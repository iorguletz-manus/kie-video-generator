import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  // Query context_sessions for iorguletz (userId = 1)
  const [sessions] = await connection.execute(
    'SELECT videoResults FROM context_sessions WHERE userId = 1 AND videoResults IS NOT NULL LIMIT 10'
  );
  
  console.log(`\nFound ${sessions.length} sessions with videoResults for iorguletz\n`);
  
  for (const row of sessions) {
    if (row.videoResults) {
      const videoResults = row.videoResults; // Already parsed by mysql2
      const video = videoResults.find(v => v.videoName === 'T1_C1_E1_AD2_HOOK3_TEST');
      
      if (video) {
        console.log('✅ Found T1_C1_E1_AD2_HOOK3_TEST!');
        if (video.whisperTranscript) {
          // whisperTranscript is a string, needs parsing
          const transcript = typeof video.whisperTranscript === 'string' 
            ? JSON.parse(video.whisperTranscript) 
            : video.whisperTranscript;
          
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
  console.error(error.stack);
} finally {
  await connection.end();
}
