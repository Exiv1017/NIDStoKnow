# NIDS to Know

A training platform for Network Intrusion Detection Systems (NIDS) with:
- Backend: FastAPI (Uvicorn)
- Frontend: Vite/React
- Honeypot: Cowrie (SSH/Telnet)
- Database: MySQL 8 (containerized)

This repo includes Docker Compose files to run all services locally or on a server.

## Quick start (Docker Compose)

- Prereqs: Docker Engine + Docker Compose plugin (docker compose ...)
- Create `.env` from `.env.example` and set strong values for DB credentials.

Start the full stack:

```bash
# from repo root
cp .env.example .env  # edit values

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Check status:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Services and ports:
- Backend API: http://localhost:8000
- Frontend (Vite preview): http://localhost:5173
- Cowrie honeypot: SSH 2224, Telnet 2225 (exposed on host)
- MySQL: internal only (container network)

## Environment variables

See `.env.example` for all variables. Most-used:
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_ROOT_PASSWORD
- COWRIE_LOG_PATH (default is the mounted Cowrie JSON log)
- VITE_API_URL (frontend build-time API base URL)

## Database: import/export

- Import an existing dump into the running MySQL container:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mysql bash -lc \
  'mysql -uhanz -p"$MYSQL_PASSWORD" nids_to_know' < nids_to_know_backup.sql
```
- Export using the helper script:
```bash
chmod +x backend/scripts/dump_db.sh
bash backend/scripts/dump_db.sh --container nidstoknow-mysql -u hanz -p '...PASSWORD...' -d nids_to_know -o nids_to_know_$(date +%F_%H%M%S).sql
```

More details in `docs/DB_EXPORT_IMPORT.md`.

## Deploying to a server (EC2, etc.)

Use the same compose files on a Linux host with Docker + Compose. Guide in `docs/DEPLOY_EC2_COMPOSE.md`.

For production, consider adding a reverse proxy (nginx/Traefik/Caddy) to terminate TLS and route:
- 443 → backend:8000 (API)
- 443 or static host → frontend (built static files)

## Project layout

- `backend/` FastAPI app, Dockerfile, and runtime scripts
- `frontend/` Vite/React app, Dockerfile
- `cowrie/` Cowrie data (mounted into the Cowrie container)
- `docker-compose.yml` Base services (cowrie/backend/frontend)
- `docker-compose.prod.yml` MySQL service, env, health checks, and dependencies
- `docker/` MySQL config (`conf.d/trust.cnf`)
- `docs/` Deployment and DB import/export guides

## Common commands

```bash
# Follow logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=200 mysql backend frontend cowrie

# Rebuild a single service
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

## Notes
- `.env`, `*.sql`, `backups/`, `uploads/`, Cowrie logs, and local envs are ignored by git.
- Don’t expose port 3306 publicly. Use exec/tunnels for DB access.
