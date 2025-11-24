import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute(
    'SELECT videoResults FROM context_sessions WHERE userId = 1 AND videoResults IS NOT NULL LIMIT 10'
  );
  
  console.log(`Found ${rows.length} sessions with videoResults`);
  
  let video = null;
  for (const row of rows) {
    if (row.videoResults && row.videoResults.length > 0) {
      video = row.videoResults[0];
      console.log(`\nFound session with ${row.videoResults.length} videos`);
      break;
    }
  }
  
  if (!video) {
    console.log('No videos found in any session');
    await connection.end();
    process.exit(0);
  }
    
    console.log('\n📊 Sample video structure:\n');
    if (video && typeof video === 'object') {
      console.log('Keys:', Object.keys(video));
    } else {
      console.log('Video is null or not an object:', video);
    }
    
    if (video.editingDebugInfo) {
      console.log('\n✅ editingDebugInfo EXISTS in database!');
      console.log('Sample editingDebugInfo:', JSON.stringify(video.editingDebugInfo, null, 2).substring(0, 500));
    } else {
      console.log('\n❌ editingDebugInfo NOT found in database');
    }

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
