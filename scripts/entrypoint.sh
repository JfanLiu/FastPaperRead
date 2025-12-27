#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/venv/bin:${PATH}"
export NODE_ENV=${NODE_ENV:-production}
export LANG=${LANG:-C.UTF-8}
export LC_ALL=${LC_ALL:-C.UTF-8}

POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
POSTGRES_DB=${POSTGRES_DB:-fastpaperread}
PGDATA=${PGDATA:-/data/postgres}
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
UVICORN_WORKERS=${UVICORN_WORKERS:-2}
DATABASE_URL=${DATABASE_URL:-"postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"}
export DATABASE_URL

PG_BIN=$(pg_config --bindir)

init_database() {
  if [ ! -s "${PGDATA}/PG_VERSION" ]; then
    echo "Initializing PostgreSQL data directory at ${PGDATA}..."
    mkdir -p "${PGDATA}"
    chown -R postgres:postgres "${PGDATA}"
    gosu postgres "${PG_BIN}/initdb" -D "${PGDATA}" --encoding=UTF8 --locale=C.UTF-8
    echo "listen_addresses='*'" >> "${PGDATA}/postgresql.conf"
    echo "host all all 0.0.0.0/0 md5" >> "${PGDATA}/pg_hba.conf"
    echo "host all all ::/0 md5" >> "${PGDATA}/pg_hba.conf"
  fi
}

start_database() {
  gosu postgres "${PG_BIN}/pg_ctl" -D "${PGDATA}" -o "-c listen_addresses='*'" -w start

  # Ensure role + database exist
  ROLE_EXISTS=$(gosu postgres psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'" || true)
  if [[ "${ROLE_EXISTS}" != "1" ]]; then
    gosu postgres psql -U postgres -c "CREATE USER ${POSTGRES_USER} WITH SUPERUSER PASSWORD '${POSTGRES_PASSWORD}';"
  else
    gosu postgres psql -U postgres -c "ALTER USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';"
  fi

  DB_EXISTS=$(gosu postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" || true)
  if [[ "${DB_EXISTS}" != "1" ]]; then
    gosu postgres createdb -O "${POSTGRES_USER}" "${POSTGRES_DB}"
  fi
}

start_backend() {
  cd /app/backend
  mkdir -p uploads output temp
  uvicorn app.main:app --host 0.0.0.0 --port "${BACKEND_PORT}" --workers "${UVICORN_WORKERS}" &
  BACKEND_PID=$!
}

start_frontend() {
  cd /app/frontend
  npm run start -- --hostname 0.0.0.0 --port "${FRONTEND_PORT}" &
  FRONTEND_PID=$!
}

shutdown() {
  echo "Shutting down services..."
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" || true
  fi
  gosu postgres "${PG_BIN}/pg_ctl" -D "${PGDATA}" -m fast stop || true
}

trap shutdown INT TERM

init_database
start_database
start_backend
start_frontend

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
EXIT_CODE=$?
shutdown
exit "${EXIT_CODE}"
