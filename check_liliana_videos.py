import mysql.connector
import sys

try:
    # Connect to database
    conn = mysql.connector.connect(
        host='shuttle.proxy.rlwy.net',
        port=50469,
        user='root',
        password='LeqAXtyXPxxxVXauGDTXALwrRjTEwmUD',
        database='railway'
    )
    
    cursor = conn.cursor()
    
    # Check for videos with Liliana in videoName
    cursor.execute("SELECT id, videoName, status, userId FROM videoResults WHERE videoName LIKE %s", ('%Liliana%',))
    videos = cursor.fetchall()
    
    if videos:
        print(f"✅ Found {len(videos)} video(s) with 'Liliana' in videoName:")
        for video in videos:
            print(f"  ID: {video[0]}")
            print(f"  VideoName: {video[1]}")
            print(f"  Status: {video[2]}")
            print(f"  UserID: {video[3]}")
            print("  ---")
    else:
        print("❌ No videos with 'Liliana' in videoName found")
        
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
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
