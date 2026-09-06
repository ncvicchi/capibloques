#!/bin/sh
set -eu
# Sólo se ejecuta al inicializar un volumen vacío. Nunca usar xtrace.
CAPI_DB_APP_PASSWORD="$(cat /run/secrets/db_app_password)"
export CAPI_DB_APP_PASSWORD
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password CAPI_DB_APP_PASSWORD
SELECT format('CREATE ROLE capibloques LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_password') \gexec
ALTER DATABASE capibloques OWNER TO capibloques;
ALTER SCHEMA public OWNER TO capibloques;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
unset CAPI_DB_APP_PASSWORD
