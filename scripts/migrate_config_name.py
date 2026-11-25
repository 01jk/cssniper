
import sqlite3
import os

DB_PATH = "cssniper.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(target_skins)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "config_name" not in columns:
            print("Adding 'config_name' column to 'target_skins'...")
            cursor.execute("ALTER TABLE target_skins ADD COLUMN config_name TEXT DEFAULT 'Default'")
            print("Column added successfully.")
        else:
            print("'config_name' column already exists.")

        conn.commit()
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
