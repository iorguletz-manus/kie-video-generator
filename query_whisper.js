import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute(
    'SELECT whisper_transcript FROM video_results WHERE video_name = ? LIMIT 1',
    ['T1_C1_E1_AD2_HOOK3_TEST']
  );
  
  if (rows.length > 0) {
    const transcript = JSON.parse(rows[0].whisper_transcript);
    console.log('\n📊 First 5 words from Whisper transcript:\n');
    transcript.words.slice(0, 5).forEach((word, i) => {
      console.log(`${i + 1}. "${word.word}": ${word.start}ms - ${word.end}ms`);
    });
    console.log('');
  } else {
    console.log('Video not found in database');
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
