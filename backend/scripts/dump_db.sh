#!/usr/bin/env bash

# Simple, portable MySQL dump helper.
#
# Supports dumping from:
#  - a locally reachable MySQL server (host/port)
#  - a Docker container running MySQL (via docker exec)
#
# Reads DB settings from CLI flags first, then environment variables:
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#
# Output defaults to backups/<db>_YYYYmmdd_HHMMSS.sql (created if missing).
#
# Usage examples:
#   ./dump_db.sh -h 127.0.0.1 -P 3306 -u myuser -p 'mypassword' -d nids_to_know
#   ./dump_db.sh --container my-mysql -u root -p 'secret' -d nids_to_know
#   DB_HOST=127.0.0.1 DB_USER=hanz DB_PASSWORD=*** DB_NAME=nids_to_know ./dump_db.sh
#
set -euo pipefail

HOST=${DB_HOST:-127.0.0.1}
PORT=${DB_PORT:-3306}
USER=${DB_USER:-hanz}
PASS=${DB_PASSWORD:-0222-1754chepol}
DB=${DB_NAME:-nids_to_know}
OUT="nidstoknow.sql"
CONTAINER=""

print_help() {
  cat <<EOF
MySQL dump helper

Flags:
  -h HOST           MySQL host (default: "+${HOST}")
  -P PORT           MySQL port (default: ${PORT})
  -u USER           MySQL username
  -p PASSWORD       MySQL password (use quotes if it contains special chars)
  -d DATABASE       Database name to dump
  -o OUTPUT.sql     Output file path (default: backups/<db>_YYYYmmdd_HHMMSS.sql)
  --container NAME  Docker container name running MySQL (uses docker exec)
  -? | --help       Show this help

Env vars (fallbacks): DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
EOF
}

# Parse args
while (( "$#" )); do
  case "$1" in
    -h) HOST="$2"; shift 2;;
    -P) PORT="$2"; shift 2;;
    -u) USER="$2"; shift 2;;
    -p) PASS="$2"; shift 2;;
    -d) DB="$2"; shift 2;;
    -o) OUT="$2"; shift 2;;
    --container) CONTAINER="$2"; shift 2;;
    -\?|--help) print_help; exit 0;;
    *) echo "Unknown arg: $1" >&2; print_help; exit 2;;
  esac
done

if [[ -z "$DB" ]]; then
  echo "Error: database name is required (-d or DB_NAME)." >&2
  exit 2
fi

timestamp=$(date +%Y%m%d_%H%M%S)
if [[ -z "$OUT" ]]; then
  mkdir -p backups
  OUT="backups/${DB}_${timestamp}.sql"
fi

# Build mysqldump arg list
build_args() {
  local -n arr=$1
  arr+=("--single-transaction" "--quick" "--routines" "--triggers" "--events" "--set-gtid-purged=OFF" "--default-character-set=utf8mb4")
  [[ -n "$HOST" ]] && arr+=("-h" "$HOST")
  [[ -n "$PORT" ]] && arr+=("-P" "$PORT")
  [[ -n "$USER" ]] && arr+=("-u" "$USER")
  if [[ -n "$PASS" ]]; then
    arr+=("--password=$PASS")
  fi
  arr+=("$DB")
}

if [[ -n "$CONTAINER" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Error: docker not found. Install Docker or omit --container." >&2
    exit 1
  fi
  # Check container exists
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "Error: container '$CONTAINER' is not running." >&2
    exit 1
  fi
  # When executing inside the container, host should usually be 127.0.0.1
  # Override to 127.0.0.1 if host was left as default
  if [[ "$HOST" == "127.0.0.1" || "$HOST" == "localhost" ]]; then
    HOST="127.0.0.1"
  fi
  args=( )
  build_args args
  echo "[info] Dumping from container '$CONTAINER' database '$DB' -> $OUT"
  docker exec -i "$CONTAINER" mysqldump "${args[@]}" > "$OUT"
else
  if ! command -v mysqldump >/dev/null 2>&1; then
    echo "Error: mysqldump not found. Install MySQL client tools (e.g., 'sudo apt-get install mysql-client')." >&2
    exit 1
  fi
  args=( )
  build_args args
  echo "[info] Dumping from $HOST:${PORT} database '$DB' -> $OUT"
  mysqldump "${args[@]}" > "$OUT"
fi

echo "[done] Wrote $OUT"
