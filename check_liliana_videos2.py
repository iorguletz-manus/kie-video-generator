import mysql.connector
from mysql.connector import Error
import sys
import time

max_retries = 3
for attempt in range(max_retries):
    try:
        print(f"🔄 Connection attempt {attempt + 1}/{max_retries}...")
        
        # Connect to database with timeout
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
        
        # Check for videos with Liliana in videoName
        print("🔍 Searching for videos with 'Liliana'...")
        cursor.execute("SELECT id, videoName, status, userId FROM videoResults WHERE videoName LIKE %s", ('%Liliana%',))
        videos = cursor.fetchall()
        
        if videos:
            print(f"\n✅ Found {len(videos)} video(s) with 'Liliana' in videoName:")
            for video in videos:
                print(f"\n  📹 Video ID: {video[0]}")
                print(f"     VideoName: {video[1]}")
                print(f"     Status: {video[2]}")
                print(f"     UserID: {video[3]}")
        else:
            print("\n❌ No videos with 'Liliana' in videoName found")
            
            # Check total videos in database
            cursor.execute("SELECT COUNT(*) FROM videoResults")
            total_videos = cursor.fetchone()[0]
            print(f"\n📋 Total videos in database: {total_videos}")
            
            if total_videos > 0:
                # Show sample videoNames
                cursor.execute("SELECT videoName FROM videoResults LIMIT 10")
                sample_videos = cursor.fetchall()
                print("\n📺 Sample videoNames:")
                for video in sample_videos:
                    print(f"  - {video[0]}")
        
        cursor.close()
        conn.close()
        sys.exit(0)
        
    except Error as e:
        print(f"❌ Connection error: {e}")
        if attempt < max_retries - 1:
            print(f"⏳ Retrying in 2 seconds...")
            time.sleep(2)
        else:
            print("❌ Max retries reached. Failed to connect.")
            sys.exit(1)
