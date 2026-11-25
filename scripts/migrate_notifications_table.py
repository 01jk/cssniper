"""
Migration: Add notifications table
"""

import sqlite3
import os

DB_PATH = "cssniper.db"

def migrate():
    """Add notifications table to database"""
    
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found. Run the bot first to create it.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='notifications'
        """)
        
        if cursor.fetchone():
            print("Table 'notifications' already exists")
        else:
            print("Creating 'notifications' table...")
            cursor.execute("""
                CREATE TABLE notifications (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    source TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    read BOOLEAN DEFAULT 0,
                    data JSON
                )
            """)
            print("Table 'notifications' created successfully")
        
        # Check for index
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND name='idx_notifications_timestamp'
        """)
        
        if not cursor.fetchone():
            print("Creating index on timestamp...")
            cursor.execute("""
                CREATE INDEX idx_notifications_timestamp 
                ON notifications(timestamp DESC)
            """)
            print("Index created successfully")
        
        # Check for index on read
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND name='idx_notifications_read'
        """)
        
        if not cursor.fetchone():
            print("Creating index on read...")
            cursor.execute("""
                CREATE INDEX idx_notifications_read 
                ON notifications(read)
            """)
            print("Index created successfully")
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
