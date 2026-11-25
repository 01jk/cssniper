import sys
import os
import sqlite3

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cssniper.db")

def migrate():
    print(f"Migrating database at {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Database not found. Skipping migration (will be created on startup).")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get existing columns
    cursor.execute("PRAGMA table_info(target_skins)")
    columns = [row[1] for row in cursor.fetchall()]
    
    new_columns = [
        ("discount_overpay_min", "FLOAT"),
        ("discount_overpay_max", "FLOAT"),
        ("fade_min", "FLOAT"),
        ("fade_max", "FLOAT")
    ]
    
    for col_name, col_type in new_columns:
        if col_name not in columns:
            print(f"Adding column {col_name}...")
            try:
                cursor.execute(f"ALTER TABLE target_skins ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
