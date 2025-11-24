import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [rows] = await connection.execute('SHOW TABLES');
  console.log('\n📋 Tables in database:\n');
  rows.forEach((row, i) => {
    console.log(`${i + 1}. ${Object.values(row)[0]}`);
  });
} finally {
  await connection.end();
}
