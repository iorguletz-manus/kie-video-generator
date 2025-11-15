import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('✅ Database connection successful!');
    
    const [rows] = await connection.execute('SELECT DATABASE() as db_name, VERSION() as version');
    console.log('Connected to database:', rows[0].db_name);
    console.log('MySQL version:', rows[0].version);
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
