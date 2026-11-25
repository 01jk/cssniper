"""
Migration script to add rarity_name column to target_skins table
"""
from database.database import engine
from sqlalchemy import text

def add_rarity_column():
    print("🔧 Adding rarity_name column to target_skins table...")
    
    with engine.connect() as conn:
        try:
            # Check if column already exists
            result = conn.execute(text("PRAGMA table_info(target_skins)"))
            columns = [row[1] for row in result]
            
            if 'rarity_name' in columns:
                print("✅ Column rarity_name already exists!")
                return
            
            # Add the column
            conn.execute(text("ALTER TABLE target_skins ADD COLUMN rarity_name VARCHAR"))
            conn.commit()
            print("✅ Column rarity_name added successfully!")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            raise

if __name__ == "__main__":
    add_rarity_column()
    print("\n🎉 Migration complete! You can now use rarity filtering.")
