# MySQL export/import quick guide

This project includes a portable helper to export/import your MySQL database.

## Export (dump)

Use `backend/scripts/dump_db.sh`. Make it executable once:

```bash
chmod +x backend/scripts/dump_db.sh
```

Examples:

- From a local MySQL server:

  ```bash
  backend/scripts/dump_db.sh -h 127.0.0.1 -P 3306 -u myuser -p 'mypassword' -d nids_to_know
  ```

- Using environment variables (recommended):

  ```bash
  DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=hanz DB_PASSWORD='...'
  DB_NAME=nids_to_know backend/scripts/dump_db.sh
  ```

- From a Dockerized MySQL (container name `nidstoknow-mysql` by default):

  ```bash
  backend/scripts/dump_db.sh --container nidstoknow-mysql -u root -p 'secret' -d nids_to_know
  ```

The script writes to `backups/<db>_YYYYmmdd_HHMMSS.sql` by default or to `-o` if provided.

## Import (restore)

- Into MySQL container:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mysql bash -lc \
    'mysql -uhanz -p"$MYSQL_PASSWORD" nids_to_know' < backups/your_dump.sql
  ```

Ensure the target database exists (e.g., `CREATE DATABASE nids_to_know CHARACTER SET utf8mb4;`).

## Notes

- `backend/scripts/reset_and_seed.py` can reset and seed demo/admin users if needed.
- Don’t commit dumps; `.gitignore` ignores `backups/` and `*.sql`.
- For production databases, prefer read replicas or maintenance windows to avoid impacting users.
