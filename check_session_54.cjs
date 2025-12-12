const mysql = require('mysql2/promise');

async function checkSession54() {
  const connection = await mysql.createConnection({
    host: 'shuttle.proxy.rlwy.net',
    port: 50469,
    user: 'root',
    password: 'LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
    database: 'railway'
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, user_id, tam_id, core_belief_id, emotional_angle_id, ad_id, character_id, LENGTH(video_results) as videoResultsLength, LEFT(video_results, 200) as videoResultsPreview, video_results FROM context_sessions WHERE id = 54'
    );
    
    console.log('Session 54 data:');
    console.log(JSON.stringify(rows, null, 2));
    
    if (rows.length > 0 && rows[0].video_results) {
      const videoResults = JSON.parse(rows[0].video_results);
      console.log('\nVideo Results:');
      console.log('- Total videos:', Array.isArray(videoResults) ? videoResults.length : 'Not an array');
      if (Array.isArray(videoResults) && videoResults.length > 0) {
        console.log('- First video:', videoResults[0]);
        console.log('- Video statuses:', videoResults.map(v => v.status).slice(0, 10));
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkSession54();
