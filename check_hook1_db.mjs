import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: 'junction.proxy.rlwy.net',
  port: 21186,
  user: 'root',
  password: 'JZGBPJLOQQvQNMNdPHLHfnMQNMOqMHIg',
  database: 'railway'
});

const [rows] = await connection.execute(
  'SELECT videoResults FROM contextSessions WHERE adId = 1 AND emotionalAngleId = 1 AND characterId = 1 ORDER BY id DESC LIMIT 1'
);

if (rows.length > 0) {
  const videoResults = JSON.parse(rows[0].videoResults || '[]');
  const hook1 = videoResults.find(v => v.videoName === 'T1_C1_E1_AD1_HOOK1_TEST');
  
  console.log('HOOK1 in database:');
  console.log(JSON.stringify(hook1, null, 2));
} else {
  console.log('No context session found');
}

await connection.end();
