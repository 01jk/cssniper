"""Migration: Add float_rank column to target_skins table."""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cssniper.db')
print(f"DB path: {db_path}")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check existing columns
cols = [r[1] for r in cur.execute('PRAGMA table_info(target_skins)')]
print(f"Existing columns: {cols}")

if 'float_rank' not in cols:
    cur.execute('ALTER TABLE target_skins ADD COLUMN float_rank TEXT')
    conn.commit()
    print("SUCCESS: Added 'float_rank' column to target_skins.")
else:
    print("SKIP: 'float_rank' column already exists.")

conn.close()
