import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function verifyTables() {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n📊 Tables created in database:');
    console.log('================================');
    tables.forEach((row, index) => {
      const tableName = Object.values(row)[0];
      console.log(`${index + 1}. ${tableName}`);
    });
    
    console.log('\n✅ Database schema setup complete!');
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyTables();
