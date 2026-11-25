
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base
import os

# Use SQLite for MVP, switch to Postgres later if needed
# For now, resolve database path relative to CONFIG_PATH if configured on remote hosts
config_path = os.getenv("CONFIG_PATH")
if config_path:
    db_dir = os.path.dirname(config_path)
    db_file_path = os.path.join(db_dir, "cssniper.db")
    DB_URL = f"sqlite:///{db_file_path}"
else:
    DB_URL = "sqlite:///./cssniper.db"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if "sqlite" in DB_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
