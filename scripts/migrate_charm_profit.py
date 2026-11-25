import sqlite3
import sys

def migrate():
    try:
        conn = sqlite3.connect('cssniper.db')
        c = conn.cursor()
        
        # Check if column exists
        c.execute("PRAGMA table_info(target_skins)")
        columns = [col[1] for col in c.fetchall()]
        
        if 'charm_profit_enabled' not in columns:
            print("Adding charm_profit_enabled to target_skins")
            c.execute("ALTER TABLE target_skins ADD COLUMN charm_profit_enabled BOOLEAN DEFAULT 0")
            
        if 'charm_profit_min' not in columns:
            print("Adding charm_profit_min to target_skins")
            c.execute("ALTER TABLE target_skins ADD COLUMN charm_profit_min FLOAT DEFAULT 0.0")
            
        if 'charm_profit_max' not in columns:
            print("Adding charm_profit_max to target_skins")
            c.execute("ALTER TABLE target_skins ADD COLUMN charm_profit_max FLOAT DEFAULT 100.0")
            
        conn.commit()
        print("Database migration successful!")
    except Exception as e:
        print(f"Database migration failed: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    migrate()
