"""
Migration script to add stickers_price_percent fields to target_skins table
"""
import sqlite3
import os

# Path to the database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'cssniper.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(target_skins)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Add stickers_price_percent_enabled if it doesn't exist
        if 'stickers_price_percent_enabled' not in columns:
            print("Adding stickers_price_percent_enabled column...")
            cursor.execute("""
                ALTER TABLE target_skins 
                ADD COLUMN stickers_price_percent_enabled BOOLEAN DEFAULT 0
            """)
            print("✓ Added stickers_price_percent_enabled")
        
        # Add stickers_price_percent_min if it doesn't exist
        if 'stickers_price_percent_min' not in columns:
            print("Adding stickers_price_percent_min column...")
            cursor.execute("""
                ALTER TABLE target_skins 
                ADD COLUMN stickers_price_percent_min FLOAT DEFAULT 0.0
            """)
            print("✓ Added stickers_price_percent_min")
        
        # Add stickers_price_percent_max if it doesn't exist
        if 'stickers_price_percent_max' not in columns:
            print("Adding stickers_price_percent_max column...")
            cursor.execute("""
                ALTER TABLE target_skins 
                ADD COLUMN stickers_price_percent_max FLOAT DEFAULT 100.0
            """)
            print("✓ Added stickers_price_percent_max")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
