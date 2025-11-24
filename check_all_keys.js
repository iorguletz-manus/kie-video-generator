import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute(
    'SELECT videoResults FROM context_sessions WHERE userId = 1 AND videoResults IS NOT NULL LIMIT 10'
  );
  
  console.log(`Found ${rows.length} sessions with videoResults`);
  
  for (const row of rows) {
    if (row.videoResults && row.videoResults.length > 0) {
      console.log(`\n📊 Session with ${row.videoResults.length} videos`);
      
      const video = row.videoResults[0];
      console.log('\n🔑 All keys in first video:');
      console.log(Object.keys(video));
      
      console.log('\n📄 Full video object (first 1000 chars):');
      console.log(JSON.stringify(video, null, 2).substring(0, 1000));
      
      break; // Just check first session with videos
    }
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
