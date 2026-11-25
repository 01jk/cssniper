"""
Migration script to add is_stattrak column to target_skins table.
Run this script once to update the database schema.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.database import engine
from sqlalchemy import text

def migrate():
    print("Adding is_stattrak column to target_skins table...")
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("PRAGMA table_info(target_skins)"))
        columns = [row[1] for row in result]
        
        if 'is_stattrak' in columns:
            print("[OK] Column 'is_stattrak' already exists. Skipping migration.")
            return
        
        # Add the new column
        conn.execute(text("""
            ALTER TABLE target_skins 
            ADD COLUMN is_stattrak BOOLEAN DEFAULT NULL
        """))
        conn.commit()
        
        print("[OK] Successfully added is_stattrak column!")
        print("  - NULL = Match any (StatTrak or not)")
        print("  - TRUE = Match StatTrak only")
        print("  - FALSE = Match Non-StatTrak only")

if __name__ == "__main__":
    migrate()
