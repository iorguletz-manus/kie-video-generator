import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL
});

try {
  const [users] = await connection.execute('SELECT id, email FROM users LIMIT 10');
  console.log('\n📋 Users in database:\n');
  users.forEach((user) => {
    console.log(`${user.id}: ${user.email}`);
  });
} finally {
  await connection.end();
}
