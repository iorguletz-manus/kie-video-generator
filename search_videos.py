import mysql.connector
from mysql.connector import Error
import time

def connect():
    for i in range(10):
        try:
            conn = mysql.connector.connect(
                host='shuttle.proxy.rlwy.net',
                port=50469,
                user='root',
                password='LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
                database='railway',
                connection_timeout=30
            )
            return conn
        except:
            time.sleep(2)
    return None

conn = connect()
if not conn:
    print("Failed to connect")
    exit(1)

cursor = conn.cursor()

# Search in videos table
print("🔍 Searching in 'videos' table for Liliana...")
cursor.execute("SELECT id, videoName, status FROM videos WHERE videoName LIKE %s", ('%Liliana%',))
results = cursor.fetchall()

if results:
    print(f"\n✅ Found {len(results)} video(s) with 'Liliana':")
    for row in results:
        print(f"  ID: {row[0]}, Name: {row[1]}, Status: {row[2]}")
else:
    print("\n❌ No videos with 'Liliana' found")
    
    # Show total and samples
    cursor.execute("SELECT COUNT(*) FROM videos")
    total = cursor.fetchone()[0]
    print(f"\n📊 Total videos: {total}")
    
    if total > 0:
        cursor.execute("SELECT videoName FROM videos LIMIT 10")
        samples = cursor.fetchall()
        print("\n📺 Sample videoNames:")
        for s in samples:
            print(f"  - {s[0]}")

cursor.close()
conn.close()
