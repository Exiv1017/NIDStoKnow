# SQL migrations

This folder contains idempotent SQL migration files used to create and alter schema objects.

20251029_create_simulation_rooms.sql - ensures `simulation_rooms` and `simulation_room_members` exist for instructor-created Rooms and per-student memberships.

To apply on your production EC2 MySQL instance:

mysql -u <user> -p <database> < 20251029_create_simulation_rooms.sql

Or, when using docker-compose with the mysql service:

docker-compose exec mysql sh -c "mysql -u$MYSQL_ROOT_USER -p$MYSQL_ROOT_PASSWORD $MYSQL_DATABASE < /path/to/20251029_create_simulation_rooms.sql"
