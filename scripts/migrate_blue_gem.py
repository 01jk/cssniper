import sqlite3
import os

db_path = "cssniper.db"

def migrate():
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return

    print(f"Migrating database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check columns
        cursor.execute("PRAGMA table_info(target_skins)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'blue_gem_tier' not in columns:
            print("Adding 'blue_gem_tier' column to 'target_skins' table...")
            cursor.execute("ALTER TABLE target_skins ADD COLUMN blue_gem_tier INTEGER")
            conn.commit()
            print("Column added successfully.")
        else:
            print("Column 'blue_gem_tier' already exists.")

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
