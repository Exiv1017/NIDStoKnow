# MySQL export/import quick guide

This folder contains a portable helper to export your MySQL database.

## Export (dump)

Use `dump_db.sh`. You can pass flags or rely on environment variables. Make it executable once:

```bash
chmod +x backend/scripts/dump_db.sh
```

Examples:

- From a local MySQL server:

  ```bash
  ./dump_db.sh -h 127.0.0.1 -P 3306 -u myuser -p 'mypassword' -d nids_to_know
  ```

- Using environment variables (recommended):

  ```bash
  DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=hanz DB_PASSWORD='...'
  DB_NAME=nids_to_know ./dump_db.sh
  ```

- From a Dockerized MySQL (container name `mysql`):

  ```bash
  ./dump_db.sh --container mysql -u root -p 'secret' -d nids_to_know
  ```

The script writes to `backups/<db>_YYYYmmdd_HHMMSS.sql` by default. Create the backups directory if you prefer a custom location and use `-o`.

## Import (restore)

Two common ways:

- Into a local MySQL server:

  ```bash
  mysql -h 127.0.0.1 -P 3306 -u myuser -p nids_to_know < backups/your_dump.sql
  ```

- Into a Dockerized MySQL container (named `mysql`):

  ```bash
  docker exec -i mysql mysql -u root -p nids_to_know < backups/your_dump.sql
  ```

Ensure the target database exists (e.g., `CREATE DATABASE nids_to_know CHARACTER SET utf8mb4;`).

## Notes

- The app also includes `backend/scripts/reset_and_seed.py` to reset tables and seed demo/admin users if needed.
- Don’t commit dumps; repo root `.gitignore` ignores `backups/` and `*.sql`.
- For production databases, prefer read replicas or maintenance windows to avoid impacting users.
