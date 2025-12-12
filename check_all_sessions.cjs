const mysql = require('mysql2/promise');

async function checkAllSessions() {
  const connection = await mysql.createConnection({
    host: 'shuttle.proxy.rlwy.net',
    port: 50469,
    user: 'root',
    password: 'LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
    database: 'railway'
  });

  try {
    // Get all sessions for user 1
    const [sessions] = await connection.execute(
      'SELECT id, userId, tamId, coreBeliefId, emotionalAngleId, adId, characterId, currentStep FROM context_sessions WHERE userId = 1 ORDER BY id'
    );
    
    console.log(`Total sessions for user 1: ${sessions.length}\n`);
    
    sessions.forEach(s => {
      console.log(`Session ${s.id}: TAM=${s.tamId}, CoreBelief=${s.coreBeliefId}, EmotionalAngle=${s.emotionalAngleId}, AD=${s.adId}, Character=${s.characterId}, Step=${s.currentStep}`);
    });
    
    // Get all ADs
    console.log('\n--- All ADs ---');
    const [ads] = await connection.execute('SELECT id, name FROM ads WHERE userId = 1 ORDER BY id');
    ads.forEach(ad => {
      console.log(`AD ${ad.id}: ${ad.name}`);
    });
    
    // Check which sessions have videoResults
    console.log('\n--- Sessions with videoResults ---');
    const [sessionsWithVideos] = await connection.execute(
      'SELECT id, adId, characterId, JSON_LENGTH(videoResults) as videoCount FROM context_sessions WHERE userId = 1 AND videoResults IS NOT NULL AND JSON_LENGTH(videoResults) > 0 ORDER BY id'
    );
    
    sessionsWithVideos.forEach(s => {
      console.log(`Session ${s.id}: AD=${s.adId}, Character=${s.characterId}, Videos=${s.videoCount}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkAllSessions();
