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
    
    # Check for Liliana user
    cursor.execute("SELECT id, name, email FROM users WHERE name LIKE %s OR email LIKE %s", ('%Liliana%', '%liliana%'))
    users = cursor.fetchall()
    
    if users:
        print("✅ Found Liliana user(s):")
        for user in users:
            print(f"  ID: {user[0]}, Name: {user[1]}, Email: {user[2]}")
            
            # Check for videos
            cursor.execute("SELECT COUNT(*) FROM videoResults WHERE userId = %s", (user[0],))
            video_count = cursor.fetchone()[0]
            print(f"  Videos: {video_count}")
    else:
        print("❌ No user named Liliana found")
        
        # Show all users
        cursor.execute("SELECT id, name, email FROM users")
        all_users = cursor.fetchall()
        print(f"\n📋 Total users in database: {len(all_users)}")
        for user in all_users:
            print(f"  - {user[1]} ({user[2]})")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
