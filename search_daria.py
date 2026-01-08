import mysql.connector
import time

def connect():
    for i in range(15):
        try:
            print(f"🔄 Attempt {i+1}/15...")
            conn = mysql.connector.connect(
                host='shuttle.proxy.rlwy.net',
                port=50469,
                user='root',
                password='LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
                database='railway',
                connection_timeout=30
            )
            print("✅ Connected!")
            return conn
        except Exception as e:
            print(f"❌ {e}")
            time.sleep(3)
    return None

conn = connect()
if not conn:
    print("\n❌ Failed to connect")
    exit(1)

cursor = conn.cursor()

# Search in videos table for DARIA
print("\n🔍 Searching for 'DARIA' in videos table...")
cursor.execute("SELECT id, videoName, status, userId FROM videos WHERE videoName LIKE %s OR videoName LIKE %s", ('%DARIA%', '%Daria%'))
results = cursor.fetchall()

if results:
    print(f"\n✅ Found {len(results)} video(s) with 'DARIA':\n")
    for row in results:
        print(f"  📹 Video ID: {row[0]}")
        print(f"     VideoName: {row[1]}")
        print(f"     Status: {row[2]}")
        print(f"     UserID: {row[3]}")
        print()
else:
    print("\n❌ No videos with 'DARIA' found")
    
    # Show total and samples
    cursor.execute("SELECT COUNT(*) FROM videos")
    total = cursor.fetchone()[0]
    print(f"\n📊 Total videos in database: {total}")
    
    if total > 0:
        print("\n📺 Sample videoNames (first 15):")
        cursor.execute("SELECT videoName FROM videos LIMIT 15")
        samples = cursor.fetchall()
        for s in samples:
            print(f"  - {s[0]}")

cursor.close()
conn.close()
print("\n✅ Done!")
