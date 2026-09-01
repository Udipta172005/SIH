"""
AquaGNN - SQLite Database Configuration & Session Management
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database file lives in backend/data/aquagnn.db
_db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(_db_dir, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(_db_dir, 'aquagnn.db')}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite + FastAPI
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables defined by ORM models."""
    from ..models import node, edge, alert  # noqa: F401  — ensure models are imported
    Base.metadata.create_all(bind=engine)
