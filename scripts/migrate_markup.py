import sqlite3
import os

db_path = 'cssniper.db'

def migrate():
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add markup_pct
        cursor.execute("ALTER TABLE target_skins ADD COLUMN markup_pct FLOAT DEFAULT 0.0")
        print("Added markup_pct column.")
    except sqlite3.OperationalError:
        print("markup_pct column already exists.")

    try:
        # Add markup_pct to sales_history
        cursor.execute("ALTER TABLE sales_history ADD COLUMN markup_pct FLOAT DEFAULT NULL")
        print("Added markup_pct column to sales_history.")
    except sqlite3.OperationalError:
        print("markup_pct column in sales_history already exists.")

    try:
        # Add markup_mult to sales_history
        cursor.execute("ALTER TABLE sales_history ADD COLUMN markup_mult FLOAT DEFAULT NULL")
        print("Added markup_mult column to sales_history.")
    except sqlite3.OperationalError:
        print("markup_mult column in sales_history already exists.")

    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
