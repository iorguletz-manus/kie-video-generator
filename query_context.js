import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute(
    'SELECT workflow_data FROM context_sessions ORDER BY updated_at DESC LIMIT 1'
  );
  
  if (rows.length > 0) {
    const workflowData = JSON.parse(rows[0].workflow_data);
    
    if (workflowData.videoResults) {
      const video = workflowData.videoResults.find(v => v.videoName === 'T1_C1_E1_AD2_HOOK3_TEST');
      
      if (video && video.whisperTranscript) {
        const transcript = JSON.parse(video.whisperTranscript);
        console.log('\n📊 First 5 words from Whisper transcript:\n');
        transcript.words.slice(0, 5).forEach((word, i) => {
          console.log(`${i + 1}. "${word.word}": ${word.start}ms - ${word.end}ms`);
        });
        console.log('');
      } else {
        console.log('Video found but no whisperTranscript');
      }
    } else {
      console.log('No videoResults in workflow_data');
    }
  } else {
    console.log('No context sessions found');
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
