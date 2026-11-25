import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "cssniper.db")

print(f"Connecting to DB at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    # Check if column exists
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(target_skins)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "description" not in columns:
        print("Column 'description' not found. Adding it...")
        conn.execute("ALTER TABLE target_skins ADD COLUMN description VARCHAR;")
        conn.commit()
        print("Successfully added 'description' column to target_skins.")
    else:
        print("Column 'description' already exists.")
        
    if "charm_profit_use_lowest_price" not in columns:
        print("Column 'charm_profit_use_lowest_price' not found. Adding it...")
        conn.execute("ALTER TABLE target_skins ADD COLUMN charm_profit_use_lowest_price BOOLEAN DEFAULT 0;")
        conn.commit()
        print("Successfully added 'charm_profit_use_lowest_price' column to target_skins.")
    else:
        print("Column 'charm_profit_use_lowest_price' already exists.")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
