#!/usr/bin/env bash

set -o nounset
set -e

MYSQL_SRC_HOST=${MYSQL_SRC_HOST:-}
MYSQL_SRC_PORT=${MYSQL_SRC_PORT:-}
MYSQL_SRC_USER=${MYSQL_SRC_USER:-}
MYSQL_SRC_PASSWORD=${MYSQL_SRC_PASSWORD:-}
MYSQL_SRC_DATABASE=${MYSQL_SRC_DATABASE:-}

MYSQL_DEST_HOST=${MYSQL_DEST_HOST:-}
MYSQL_DEST_PORT=${MYSQL_DEST_PORT:-}
MYSQL_DEST_USER=${MYSQL_DEST_USER:-}
MYSQL_DEST_PASSWORD=${MYSQL_DEST_PASSWORD:-}
MYSQL_DEST_DATABASE=${MYSQL_DEST_DATABASE:-}

POSTGRES_SRC_HOST=${POSTGRES_SRC_HOST:-}
POSTGRES_SRC_PORT=${POSTGRES_SRC_PORT:-}
POSTGRES_SRC_USER=${POSTGRES_SRC_USER:-}
POSTGRES_SRC_PASSWORD=${POSTGRES_SRC_PASSWORD:-}
POSTGRES_SRC_DATABASE=${POSTGRES_SRC_DATABASE:-}

POSTGRES_DEST_HOST=${POSTGRES_DEST_HOST:-}
POSTGRES_DEST_PORT=${POSTGRES_DEST_PORT:-}
POSTGRES_DEST_USER=${POSTGRES_DEST_USER:-}
POSTGRES_DEST_PASSWORD=${POSTGRES_DEST_PASSWORD:-}
POSTGRES_DEST_DATABASE=${POSTGRES_DEST_DATABASE:-}

# Exit if any variable doesn't exist.
if [[ \
  -z "${MYSQL_SRC_HOST}" \
  || -z "${MYSQL_SRC_PORT}" \
  || -z "${MYSQL_SRC_USER}" \
  || -z "${MYSQL_SRC_PASSWORD}" \
  || -z "${MYSQL_SRC_DATABASE}" \
  || -z "${MYSQL_DEST_HOST}" \
  || -z "${MYSQL_DEST_PORT}" \
  || -z "${MYSQL_DEST_USER}" \
  || -z "${MYSQL_DEST_PASSWORD}" \
  || -z "${MYSQL_DEST_DATABASE}" \
  || -z "${POSTGRES_SRC_HOST}" \
  || -z "${POSTGRES_SRC_PORT}" \
  || -z "${POSTGRES_SRC_USER}" \
  || -z "${POSTGRES_SRC_PASSWORD}" \
  || -z "${POSTGRES_SRC_DATABASE}" \
  || -z "${POSTGRES_DEST_HOST}" \
  || -z "${POSTGRES_DEST_PORT}" \
  || -z "${POSTGRES_DEST_USER}" \
  || -z "${POSTGRES_DEST_PASSWORD}" \
  || -z "${POSTGRES_DEST_DATABASE}" \
]]; then
  echo -e "Please make sure that all environment variables are defined."
  echo -e "See the entrypoint file for more information."
  exit 1
fi

# First compare and sync the Postgres database via Pyrseas.
echo -e "Beginning Postgres schema sync..."
echo -e " --> Exporting source Postgres database '${POSTGRES_SRC_DATABASE}' to YAML..."
export PGPASSWORD=${POSTGRES_SRC_PASSWORD}
dbtoyaml -H ${POSTGRES_SRC_HOST} \
  -p ${POSTGRES_SRC_PORT} \
  -U ${POSTGRES_SRC_USER} \
  ${POSTGRES_SRC_DATABASE} > /opt/postgres.yaml

echo -e " --> Comparing YAML definition against destination database '${POSTGRES_DEST_DATABASE}'..."
export PGHOST=${POSTGRES_DEST_HOST}
export PGPORT=${POSTGRES_DEST_PORT}
export PGUSER=${POSTGRES_DEST_USER}
export PGPASSWORD=${POSTGRES_DEST_PASSWORD}
yamltodb ${POSTGRES_DEST_DATABASE} /opt/postgres.yaml > /opt/postgres.sql

echo -e " --> Applying migrations to '${POSTGRES_DEST_DATABASE}'..."
psql ${POSTGRES_DEST_DATABASE} -f /opt/postgres.sql

echo -e "Postgres schema sync complete!"

# Then do the same with the MySQL one via DBDiff.
echo -e "Beginning MySQL schema sync..."
echo -e " --> Diffing database '${MYSQL_SRC_DATABASE}' against '${MYSQL_DEST_DATABASE}'..."
dbdiff --server1="${MYSQL_SRC_USER}:${MYSQL_SRC_PASSWORD}@${MYSQL_SRC_HOST}:${MYSQL_SRC_PORT}" \
  --server2="${MYSQL_DEST_USER}:${MYSQL_DEST_PASSWORD}@${MYSQL_DEST_HOST}:${MYSQL_DEST_PORT}" \
  --type=schema \
  --include=up \
  --nocomments=true \
  "server1.${MYSQL_SRC_DATABASE}:server2.${MYSQL_DEST_DATABASE}" \
  --output=/opt/mysql.sql

if [[ ! -f "/opt/mysql.sql" ]]; then
  echo -e " --> MySQL migrations not found (schemas are likely identical), skipping apply."
  echo -e "MySQL schema sync complete!"
  exit 0
fi

echo -e " --> Applying migrations to '${MYSQL_DEST_DATABASE}'..."
mysql --host=${MYSQL_DEST_HOST} \
  --port=${MYSQL_DEST_PORT} \
  --user=${MYSQL_DEST_USER} \
  --password=${MYSQL_DEST_PASSWORD} \
  ${MYSQL_DEST_DATABASE} < /opt/mysql.sql

echo -e "MySQL schema sync complete!"
