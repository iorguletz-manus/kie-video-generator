import mysql from 'mysql2/promise';
import fs from 'fs';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const sql = fs.readFileSync('add_cleanvoice_api_key.sql', 'utf8');
  console.log('Running migration:', sql);
  
  await connection.execute(sql);
  
  console.log('✅ Migration completed successfully!');
  
  // Verify the column was added
  const [rows] = await connection.execute('DESCRIBE app_users');
  console.log('\n📋 Updated app_users columns:\n');
  rows.forEach((row) => {
    console.log(`- ${row.Field} (${row.Type})`);
  });
} catch (error) {
  console.error('❌ Migration failed:', error.message);
} finally {
  await connection.end();
}
