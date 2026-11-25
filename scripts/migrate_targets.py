import sqlite3
import datetime

def upgrade_db():
    conn = sqlite3.connect('cssniper.db')
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(target_skins)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'created_at' not in columns:
            print("Adding created_at column to target_skins table...")
            # SQLite workaround: add as NULL, then update existing to current time
            cursor.execute("ALTER TABLE target_skins ADD COLUMN created_at DATETIME;")
            current_time = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("UPDATE target_skins SET created_at = ?", (current_time,))
            conn.commit()
            print("Successfully added created_at column and updated existing rows.")
        else:
            print("Column created_at already exists.")
            
    except Exception as e:
        print(f"Error updating database: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    upgrade_db()
