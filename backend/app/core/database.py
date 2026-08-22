from sqlalchemy import create_engine, String, Text, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import JSON
from sqlalchemy.ext.compiler import compiles
from app.core.config import settings

_IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

if _IS_SQLITE:
    try:
        from sqlalchemy.dialects.postgresql import INET, JSONB
        from sqlalchemy import BigInteger

        @compiles(INET, "sqlite")
        def _compile_inet_sqlite(type_, compiler, **kw):
            return compiler.visit_string(String(45), **kw)

        @compiles(JSONB, "sqlite")
        def _compile_jsonb_sqlite(type_, compiler, **kw):
            return compiler.visit_text(Text(), **kw)

        @compiles(BigInteger, "sqlite")
        def _compile_bigint_sqlite(type_, compiler, **kw):
            from sqlalchemy import Integer
            return compiler.visit_integer(Integer(), **kw)
    except ImportError:
        pass

engine_kwargs = dict(
    pool_pre_ping=True,
    echo=settings.DEBUG,
)
if not _IS_SQLITE:
    engine_kwargs.update(dict(pool_size=20, max_overflow=40))
else:
    engine_kwargs.update(dict(connect_args={"check_same_thread": False}))

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

if _IS_SQLITE:
    from sqlalchemy import BigInteger, Integer, Column as Col
    import app.models as _all_models  # noqa: F401  ensure all mapper classes registered

    _SKIP_SQLITE_CHECKS = {
        "chk_email_format",
        "chk_joining_date_not_future",
        "chk_status_timestamps",
    }

    for _table in Base.metadata.tables.values():
        if len(_table.primary_key.columns) == 1:
            _pk = list(_table.primary_key.columns)[0]
            if isinstance(_pk.type, BigInteger) or isinstance(_pk.type, Integer):
                _pk.autoincrement = True

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        except Exception:
            pass

    @event.listens_for(Base.metadata, "before_create")
    def _sqlite_strip_checks(target, connection, **kw):
        from sqlalchemy import CheckConstraint, MetaData
        if not isinstance(target, MetaData):
            return
        for table in target.tables.values():
            to_remove = [
                c for c in list(table.constraints)
                if isinstance(c, CheckConstraint) and c.name in _SKIP_SQLITE_CHECKS
            ]
            for c in to_remove:
                table.constraints.remove(c)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
