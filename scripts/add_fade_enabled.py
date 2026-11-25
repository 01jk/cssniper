"""
Database migration script to add fade_enabled column to target_skins table
"""

import sqlite3
import os

def add_fade_enabled_column():
    """Add fade_enabled column to target_skins table"""
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cssniper.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return
    
    print(f"📂 Opening database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(target_skins)")
        columns_info = cursor.fetchall()
        columns = [col[1] for col in columns_info]
        
        print(f"📋 Current columns in target_skins: {', '.join(columns)}")
        
        # Add fade_enabled column if it doesn't exist
        if 'fade_enabled' not in columns:
            print("➕ Adding fade_enabled column...")
            cursor.execute("ALTER TABLE target_skins ADD COLUMN fade_enabled BOOLEAN DEFAULT FALSE")
            print("✅ fade_enabled column added successfully!")
        else:
            print("⚠️ fade_enabled column already exists, skipping")
        
        conn.commit()
        
        # Verify
        cursor.execute("PRAGMA table_info(target_skins)")
        columns_info = cursor.fetchall()
        columns = [col[1] for col in columns_info]
        
        print(f"\n📋 Updated columns in target_skins: {', '.join(columns)}")
        
        if 'fade_enabled' in columns:
            print("\n✅ Migration completed successfully!")
        else:
            print("\n❌ Migration failed - fade_enabled column not found")
            
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()
        print("🔒 Database connection closed")

if __name__ == "__main__":
    print("🚀 Starting migration: Add fade_enabled column to target_skins")
    print("=" * 60)
    add_fade_enabled_column()
    print("=" * 60)
    print("🏁 Migration script finished")
