import mysql.connector
from mysql.connector import Error
import time

max_retries = 3
for attempt in range(max_retries):
    try:
        print(f"🔄 Connection attempt {attempt + 1}/{max_retries}...")
        
        conn = mysql.connector.connect(
            host='shuttle.proxy.rlwy.net',
            port=50469,
            user='root',
            password='LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
            database='railway',
            connection_timeout=10
        )
        
        print("✅ Connected successfully!")
        
        cursor = conn.cursor()
        
        # Show all tables
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        
        print(f"\n📋 Tables in database: {len(tables)}")
        for table in tables:
            print(f"  - {table[0]}")
            
            # Count rows in each table
            cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
            count = cursor.fetchone()[0]
            print(f"    Rows: {count}")
        
        cursor.close()
        conn.close()
        break
        
    except Error as e:
        print(f"❌ Error: {e}")
        if attempt < max_retries - 1:
            print(f"⏳ Retrying in 2 seconds...")
            time.sleep(2)
