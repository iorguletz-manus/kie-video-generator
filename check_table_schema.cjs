const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Checking context_sessions table schema...\n');
    
    const [columns] = await connection.query('DESCRIBE context_sessions');
    
    console.log('Columns in context_sessions:');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
    });
    
  } finally {
    await connection.end();
  }
}

checkSchema().catch(console.error);
