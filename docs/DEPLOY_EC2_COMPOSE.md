# Deploy on EC2 with Docker Compose (with MySQL container)

## Prerequisites
- EC2 instance (Ubuntu 22.04+ recommended)
- Docker and docker compose plugin installed
- Repo on the server (git clone or scp)
- A `.env` created from `.env.example` with strong passwords

## Start services (including MySQL)

```bash
# In project root on EC2
cp .env.example .env  # then edit .env and set strong DB_PASSWORD

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Initialize or import database

Option A: import an existing dump file `nids_to_know_backup.sql` in the project root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mysql bash -lc \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4;"'

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mysql bash -lc \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" $DB_NAME' < nids_to_know_backup.sql
```

Option B: run the reset/seed script (creates admin + demo users):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python backend/scripts/reset_and_seed.py
```

## Access
- Backend API: `http://<server>:8000` (or behind your reverse proxy)
- FastAPI docs: `http://<server>:8000/docs`
- Frontend: `http://<server>:5173` (dev/preview)
- Cowrie ports (exposed): 2224/2225

## Logs and health
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=200 mysql backend frontend cowrie
```

## Notes
- For HTTPS and routing, add a reverse proxy (Caddy/Nginx/Traefik) as a separate container or install on the host.
- Avoid exposing `:5173` to the internet in production; prefer serving built static files.
- Back up `nidstoknow-mysql-data` volume or run scheduled dumps to object storage.
