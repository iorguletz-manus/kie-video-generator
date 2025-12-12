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
    const [rows] = await connection.execute('SELECT * FROM context_sessions WHERE id = 54');
    
    if (rows.length === 0) {
      console.log('Session 54 not found!');
      return;
    }
    
    const session = rows[0];
    console.log('Session 54 data:');
    console.log('- ID:', session.id);
    console.log('- userId:', session.userId);
    console.log('- tamId:', session.tamId);
    console.log('- coreBeliefId:', session.coreBeliefId);
    console.log('- emotionalAngleId:', session.emotionalAngleId);
    console.log('- adId:', session.adId);
    console.log('- characterId:', session.characterId);
    console.log('- currentStep:', session.currentStep);
    
    console.log('\nvideoResults:');
    if (session.videoResults) {
      const videoResults = typeof session.videoResults === 'string' 
        ? JSON.parse(session.videoResults) 
        : session.videoResults;
      
      console.log('- Type:', typeof videoResults);
      console.log('- Is Array:', Array.isArray(videoResults));
      console.log('- Length:', Array.isArray(videoResults) ? videoResults.length : 'N/A');
      
      if (Array.isArray(videoResults) && videoResults.length > 0) {
        console.log('\nFirst 3 videos:');
        videoResults.slice(0, 3).forEach((v, i) => {
          console.log(`  [${i}]:`, {
            status: v.status,
            videoUrl: v.videoUrl ? 'EXISTS' : 'NULL',
            line: v.line?.substring(0, 50)
          });
        });
        
        const statuses = videoResults.map(v => v.status).filter(Boolean);
        const statusCounts = {};
        statuses.forEach(s => statusCounts[s] = (statusCounts[s] || 0) + 1);
        console.log('\nStatus counts:', statusCounts);
      } else {
        console.log('videoResults is empty or not an array!');
      }
    } else {
      console.log('videoResults is NULL!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkSession54();
