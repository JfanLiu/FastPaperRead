# Build frontend assets
FROM node:20-bookworm AS frontend-builder
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# Final runtime image (frontend + backend + PostgreSQL)
FROM node:20-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production

# System dependencies for Python, PostgreSQL and build steps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 python3-venv python3-pip python3-dev \
        build-essential libpq-dev \
        gosu curl ca-certificates \
        postgresql postgresql-contrib && \
    rm -rf /var/lib/apt/lists/*

# Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Install backend dependencies
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt
COPY backend .

# Install frontend runtime deps and copy build artifacts
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY --from=frontend-builder /frontend/.next ./.next
COPY --from=frontend-builder /frontend/public ./public
COPY --from=frontend-builder /frontend/next.config.ts ./next.config.ts
COPY --from=frontend-builder /frontend/postcss.config.mjs ./postcss.config.mjs
COPY --from=frontend-builder /frontend/tsconfig.json ./tsconfig.json
COPY --from=frontend-builder /frontend/eslint.config.mjs ./eslint.config.mjs

# Entrypoint + runtime defaults
WORKDIR /app
COPY scripts/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh && \
    mkdir -p /data/postgres && \
    chown -R postgres:postgres /data/postgres && \
    mkdir -p /app/backend/uploads /app/backend/output /app/backend/temp

ENV POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres \
    POSTGRES_DB=fastpaperread \
    PGDATA=/data/postgres \
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fastpaperread \
    HOST=0.0.0.0 \
    PORT=8000 \
    DEBUG=false \
    BACKEND_PORT=8000 \
    FRONTEND_PORT=3000 \
    NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 \
    UVICORN_WORKERS=2

EXPOSE 3000 8000 5432

CMD ["/entrypoint.sh"]
