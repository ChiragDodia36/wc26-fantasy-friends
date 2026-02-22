FROM python:3.11-slim

WORKDIR /code

# Install system deps for psycopg2 and other C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies from pyproject.toml
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy application code (overridden by docker-compose volume mount in dev)
COPY app/ app/
COPY alembic/ alembic/ 2>/dev/null || true
COPY alembic.ini . 2>/dev/null || true

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
