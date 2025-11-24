import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute(
    'SELECT videoResults FROM context_sessions WHERE videoResults IS NOT NULL LIMIT 10'
  );
  
  console.log(`\nFound ${rows.length} sessions with videoResults\n`);
  
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
