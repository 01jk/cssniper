from database.database import get_db, init_db
from database.models import TargetSkin, StickerTier

def seed():
    init_db()
    db = next(get_db())
    
    # Check if we already have data
    if db.query(TargetSkin).count() > 0:
        print("Database already seeded.")
        return

    print("Seeding database...")
    
    # 1. Add a test target (broad enough to match something likely, or specific for testing)
    target = TargetSkin(
        item_name="AK-47 | Redline",
        min_price=1.0,
        max_price=20.0,
        min_float=0.15,
        max_float=0.30,
        mode="Notify Only"
    )
    db.add(target)
    
    # Add a wildcard target for testing scanner flow
    test_target = TargetSkin(
        item_name="*", # Special logic in analyzer handles this
        min_price=0.0,
        max_price=200.0, # Target a realistic range for wildcard
        min_float=0.0,
        max_float=1.0,
        mode="Notify Only"
    )
    db.add(test_target)
    
    db.commit()
    print("Database seeded with test targets.")

if __name__ == "__main__":
    seed()
