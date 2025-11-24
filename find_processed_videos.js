import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute(
    'SELECT videoResults FROM context_sessions WHERE userId = 1 AND videoResults IS NOT NULL'
  );
  
  console.log(`Checking ${rows.length} sessions...`);
  
  for (const row of rows) {
    if (row.videoResults && row.videoResults.length > 0) {
      for (const video of row.videoResults) {
        // Check if video has cutPoints or audioUrl (signs of processing)
        if (video.cutPoints || video.audioUrl || video.editingDebugInfo) {
          console.log('\n✅ Found processed video:', video.videoName);
          console.log('Keys:', Object.keys(video));
          
          if (video.editingDebugInfo) {
            console.log('\n📊 editingDebugInfo exists!');
            console.log(JSON.stringify(video.editingDebugInfo, null, 2).substring(0, 500));
          }
          
          if (video.cutPoints) {
            console.log('\n✂️ cutPoints exists!');
            console.log(JSON.stringify(video.cutPoints, null, 2));
          }
          
          process.exit(0); // Found one, exit
        }
      }
    }
  }
  
  console.log('\n❌ No processed videos found with cutPoints or audioUrl');
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
