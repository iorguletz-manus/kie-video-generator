import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute('DESCRIBE users');
  console.log('\n📋 users table columns:\n');
  rows.forEach((row) => {
    console.log(`- ${row.Field} (${row.Type})`);
  });
} finally {
  await connection.end();
}
