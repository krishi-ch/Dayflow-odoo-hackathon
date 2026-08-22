from app.core.database import SessionLocal, Base, engine
from app import models  # noqa: F401  (ensure all models registered on Base.metadata)


def init_db():
    """
    Create all tables from SQLAlchemy models.
    (Use ONLY if you aren't applying the raw SQL migration.
    The raw SQL migration file 001_init_schema.sql is recommended for production / demo
    because it includes PostgreSQL-specific enums, triggers, and additional indexes.)
    """
    print("Creating tables using SQLAlchemy metadata...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created")


if __name__ == "__main__":
    init_db()
