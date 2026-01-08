import mysql.connector
from mysql.connector import Error
import time

def connect_with_retry(max_retries=10):
    for attempt in range(max_retries):
        try:
            print(f"🔄 Attempt {attempt + 1}/{max_retries}...")
            
            conn = mysql.connector.connect(
                host='shuttle.proxy.rlwy.net',
                port=50469,
                user='root',
                password='LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
                database='railway',
                connection_timeout=30,
                autocommit=True
            )
            
            print("✅ Connected!")
            return conn
            
        except Error as e:
            print(f"❌ Error: {e}")
            if attempt < max_retries - 1:
                wait_time = min(2 ** attempt, 10)  # Exponential backoff
                print(f"⏳ Waiting {wait_time}s...")
                time.sleep(wait_time)
    
    return None

# Connect
conn = connect_with_retry()
if not conn:
    print("❌ Failed to connect after all retries")
    exit(1)

try:
    cursor = conn.cursor()
    
    # First, check what tables exist
    print("\n📋 Checking tables...")
    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()
    print(f"Found {len(tables)} tables:")
    for table in tables:
        print(f"  - {table[0]}")
    
    # Try to find the correct video table name
    video_table = None
    for table in tables:
        table_name = table[0]
        if 'video' in table_name.lower() or 'result' in table_name.lower():
            video_table = table_name
            print(f"\n✅ Found video table: {video_table}")
            break
    
    if not video_table:
        print("\n❌ No video table found!")
        cursor.close()
        conn.close()
        exit(1)
    
    # Check table structure
    print(f"\n📊 Table structure for {video_table}:")
    cursor.execute(f"DESCRIBE {video_table}")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  - {col[0]} ({col[1]})")
    
    # Search for Liliana
    print(f"\n🔍 Searching for 'Liliana' in {video_table}...")
    
    # Find the videoName column
    video_name_col = None
    for col in columns:
        if 'name' in col[0].lower():
            video_name_col = col[0]
            break
    
    if not video_name_col:
        print("❌ No name column found!")
        cursor.close()
        conn.close()
        exit(1)
    
    print(f"Using column: {video_name_col}")
    
    query = f"SELECT * FROM {video_table} WHERE {video_name_col} LIKE %s LIMIT 20"
    cursor.execute(query, ('%Liliana%',))
    results = cursor.fetchall()
    
    if results:
        print(f"\n✅ Found {len(results)} video(s) with 'Liliana':")
        for row in results:
            print(f"\n  📹 {row}")
    else:
        print("\n❌ No videos with 'Liliana' found")
        
        # Show total count
        cursor.execute(f"SELECT COUNT(*) FROM {video_table}")
        total = cursor.fetchone()[0]
        print(f"\n📊 Total videos in table: {total}")
        
        if total > 0:
            # Show sample
            cursor.execute(f"SELECT {video_name_col} FROM {video_table} LIMIT 5")
            samples = cursor.fetchall()
            print("\n📺 Sample videoNames:")
            for sample in samples:
                print(f"  - {sample[0]}")
    
    cursor.close()
    conn.close()
    print("\n✅ Done!")
    
except Exception as e:
    print(f"\n❌ Query error: {e}")
    if conn:
        conn.close()
    exit(1)
