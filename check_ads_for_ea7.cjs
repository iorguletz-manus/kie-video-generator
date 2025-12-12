const mysql = require('mysql2/promise');

async function checkAds() {
  const connection = await mysql.createConnection({
    host: 'shuttle.proxy.rlwy.net',
    port: 50469,
    user: 'root',
    password: 'LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
    database: 'railway'
  });

  try {
    console.log('=== Checking ADs for Emotional Angle 7 ===\n');
    
    // Get all ADs for emotional angle 7
    const [ads] = await connection.execute(
      'SELECT * FROM ads WHERE emotionalAngleId = 7 ORDER BY id'
    );
    
    console.log(`Found ${ads.length} ADs for Emotional Angle 7:\n`);
    ads.forEach(ad => {
      console.log(`AD ${ad.id}: "${ad.name}" (emotionalAngleId=${ad.emotionalAngleId}, userId=${ad.userId})`);
    });
    
    console.log('\n=== All ADs in database ===\n');
    const [allAds] = await connection.execute('SELECT * FROM ads ORDER BY id');
    allAds.forEach(ad => {
      console.log(`AD ${ad.id}: "${ad.name}" (emotionalAngleId=${ad.emotionalAngleId}, userId=${ad.userId})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkAds();
