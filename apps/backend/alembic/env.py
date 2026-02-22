import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Load all models so autogenerate detects them
from app.core.db import Base
import app.models  # noqa: F401 — registers all ORM models with Base.metadata

# Alembic Config object
config = context.config

# Logging setup from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use our SQLAlchemy metadata for autogenerate
target_metadata = Base.metadata


def get_url() -> str:
    """Read DATABASE_URL from environment, falling back to alembic.ini value."""
    return os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection needed, emits SQL)."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to live DB)."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
