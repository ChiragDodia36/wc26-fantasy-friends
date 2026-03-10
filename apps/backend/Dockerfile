FROM python:3.11-slim

WORKDIR /code

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Install Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY entrypoint.sh .
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x entrypoint.sh

# Pull Ollama model at build time so cold starts don't re-download it
# Start ollama in background, wait, pull, then stop
RUN /bin/bash -c '\
    ollama serve & \
    OLLAMA_PID=$! && \
    echo "Waiting for Ollama to start..." && \
    for i in $(seq 1 30); do \
        curl -sf http://localhost:11434/api/tags > /dev/null 2>&1 && break; \
        sleep 1; \
    done && \
    echo "Pulling qwen3:4b..." && \
    ollama pull qwen3:4b || { echo "ERROR: ollama pull qwen3:4b failed"; exit 1; } && \
    echo "Model pulled successfully." && \
    kill $OLLAMA_PID && \
    wait $OLLAMA_PID 2>/dev/null || true'

# HuggingFace Spaces requires port 7860
EXPOSE 7860

# supervisord manages: ollama serve + entrypoint.sh (uvicorn)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
