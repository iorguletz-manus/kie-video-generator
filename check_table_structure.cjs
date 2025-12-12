const mysql = require('mysql2/promise');

async function checkTable() {
  const connection = await mysql.createConnection({
    host: 'shuttle.proxy.rlwy.net',
    port: 50469,
    user: 'root',
    password: 'LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
    database: 'railway'
  });

  try {
    // Show tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Tables:', tables);
    
    // Describe context_sessions table
    const [columns] = await connection.execute('DESCRIBE context_sessions');
    console.log('\nContext Sessions columns:');
    console.log(columns);
    
    // Get session 54
    const [rows] = await connection.execute('SELECT * FROM context_sessions WHERE id = 54');
    console.log('\nSession 54:');
    if (rows.length > 0) {
      console.log('Keys:', Object.keys(rows[0]));
      console.log('Data:', {
        ...rows[0],
        videoResults: rows[0].videoResults ? `${rows[0].videoResults.substring(0, 100)}...` : null
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTable();
