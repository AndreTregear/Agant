#!/bin/sh
# Least-privilege DB users, created on first boot via docker-entrypoint-initdb.d.
# Application containers should never use root once this runs.
set -eu

if [ -n "${WORDPRESS_DB_PASSWORD:-}" ]; then
  mysql --protocol=socket -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS wordpress
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wordpress'@'%' IDENTIFIED BY '${WORDPRESS_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON wordpress.* TO 'wordpress'@'%';
FLUSH PRIVILEGES;
SQL
else
  echo "[init-users] WORDPRESS_DB_PASSWORD not set; skipping WP user" >&2
fi

# Read-only user for Superset / BI. SELECT-only so dashboards can't mutate
# application data even if Superset is compromised.
if [ -n "${SUPERSET_READ_PASSWORD:-}" ]; then
  mysql --protocol=socket -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS 'superset_read'@'%' IDENTIFIED BY '${SUPERSET_READ_PASSWORD}';
GRANT SELECT ON *.* TO 'superset_read'@'%';
FLUSH PRIVILEGES;
SQL
fi
