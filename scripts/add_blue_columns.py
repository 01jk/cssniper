#!/usr/bin/env python3
"""
Database migration script to add playside_blue and backside_blue columns to target_skins table
"""

import sqlite3
import os
from pathlib import Path

def add_blue_columns_to_db():
    """Add playside_blue and backside_blue columns to target_skins table"""
    
    # Find database file
    db_path = None
    possible_paths = [
        "database/database.db",
        "database/cssniper.db",
        "cssniper.db",
        "data/database.db"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        # Try to find any .db file in the project
        for root, dirs, files in os.walk("."):
            for file in files:
                if file.endswith(".db") and not file.startswith("test_"):
                    db_path = os.path.join(root, file)
                    break
            if db_path:
                break
    
    if not db_path:
        print("❌ Database file not found!")
        print("Please run this script from the project root directory")
        return False
    
    print(f"📁 Using database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(target_skins)")
        columns = [row[1] for row in cursor.fetchall()]
        
        columns_to_add = []
        
        if 'playside_blue_min' not in columns:
            columns_to_add.append("playside_blue_min REAL DEFAULT 0.0")
        
        if 'playside_blue_max' not in columns:
            columns_to_add.append("playside_blue_max REAL DEFAULT 100.0")
        
        if 'backside_blue_min' not in columns:
            columns_to_add.append("backside_blue_min REAL DEFAULT 0.0")
        
        if 'backside_blue_max' not in columns:
            columns_to_add.append("backside_blue_max REAL DEFAULT 100.0")
        
        if not columns_to_add:
            print("✅ All blue columns already exist in database!")
            conn.close()
            return True
        
        # Add missing columns
        for column_def in columns_to_add:
            try:
                sql = f"ALTER TABLE target_skins ADD COLUMN {column_def}"
                cursor.execute(sql)
                print(f"✅ Added column: {column_def}")
            except sqlite3.Error as e:
                print(f"❌ Error adding column {column_def}: {e}")
                conn.close()
                return False
        
        # Commit changes
        conn.commit()
        
        # Verify columns were added
        cursor.execute("PRAGMA table_info(target_skins)")
        updated_columns = [row[1] for row in cursor.fetchall()]
        
        print("\n📋 Updated table structure:")
        blue_columns = [col for col in updated_columns if 'blue' in col.lower()]
        for col in blue_columns:
            print(f"   - {col}")
        
        conn.close()
        print("\n✅ Database migration completed successfully!")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("🔄 Starting database migration for blue percentage columns...")
    success = add_blue_columns_to_db()
    
    if success:
        print("\n🎉 Migration completed! You can now restart the API server.")
    else:
        print("\n💥 Migration failed! Please check the error messages above.")
        exit(1)
