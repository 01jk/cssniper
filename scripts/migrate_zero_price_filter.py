#!/usr/bin/env python3
"""
Database migration script to add zero_price_filter field to target_skins table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import init_db, get_db
from database.models import TargetSkin
from sqlalchemy import text

def migrate_zero_price_filter():
    """Add zero_price_filter column to target_skins table if it doesn't exist"""
    print("Starting migration for zero_price_filter field...")
    
    # Initialize database connection
    init_db()
    db = next(get_db())
    
    try:
        # Check if column already exists
        result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM pragma_table_info('target_skins') 
            WHERE name = 'zero_price_filter'
        """))
        
        column_exists = result.fetchone()[0] > 0
        
        if column_exists:
            print("✅ zero_price_filter column already exists. Migration not needed.")
            return
        
        # Add the column
        print("📝 Adding zero_price_filter column to target_skins table...")
        db.execute(text("""
            ALTER TABLE target_skins 
            ADD COLUMN zero_price_filter BOOLEAN DEFAULT 0
        """))
        
        db.commit()
        print("✅ Migration completed successfully!")
        print("   - Added zero_price_filter column with default value FALSE")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_zero_price_filter()
