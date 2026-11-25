"""
Migration: Add notifications_enabled column to target_skins table
"""

import sqlite3
from pathlib import Path

def run_migration():
    """Add notifications_enabled column to target_skins table"""
    
    # Find database file
    db_paths = [
        Path("cssniper.db"),
        Path("database.db"),
        Path("data/cssniper.db"),
        Path("../cssniper.db"),
    ]
    
    db_path = None
    for path in db_paths:
        if path.exists():
            db_path = path
            break
    
    if not db_path:
        print("Database file not found")
        return False

    print(f"Using database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(target_skins)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "notifications_enabled" in columns:
            print("Column 'notifications_enabled' already exists")
            conn.close()
            return True

        # Add column
        print("Adding 'notifications_enabled' column...")
        cursor.execute("""
            ALTER TABLE target_skins 
            ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1
        """)
        
        conn.commit()
        print("Migration completed successfully!")

        # Verify
        cursor.execute("PRAGMA table_info(target_skins)")
        columns = [col[1] for col in cursor.fetchall()]

        if "notifications_enabled" in columns:
            print("Column verified in database")
        else:
            print("Column not found after migration")

        conn.close()
        return True

    except Exception as e:
        print(f"Migration failed: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    success = run_migration()
    exit(0 if success else 1)
