FROM python:3.12-slim-bookworm

ENV TZ=UTC \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/gressus \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=0 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

WORKDIR /gressus

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    curl \
    docker.io \
    && pip install --no-cache-dir poetry \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/poetry.lock ./backend/
RUN cd backend && poetry install --no-root --no-cache

COPY backend ./backend
COPY docker/backend/start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh

CMD ["/start.sh"]
