#!/usr/bin/env bash
# Tries Yarn's database migrations on a throwaway Postgres 16 (nothing to do with your real Supabase).
# Each tNNNN_*.sql file prints what it checks with "expect ..." next to each step: read the output.
# Needs Postgres 16 installed (e.g. /usr/lib/postgresql/16/bin) and root (it runs Postgres as the "postgres" user).
set -eu
root="$(cd "$(dirname "$0")/../.." && pwd)"
bin=/usr/lib/postgresql/16/bin
dir=/var/tmp/yarn-pgtest
port=5544
if [ ! -d "$dir/data" ]; then
  mkdir -p "$dir" && chown postgres "$dir"
  su postgres -c "$bin/initdb -D $dir/data -A trust >/dev/null"
fi
su postgres -c "$bin/pg_ctl -D $dir/data -o '-p $port -k $dir' -l $dir/log start" >/dev/null 2>&1 || true
sleep 2
psql_() { psql -h "$dir" -p $port -U postgres -q "$@"; }
for t in "$root"/dev-tests/postgres/t*.sql; do
  name="$(basename "$t" .sql)"; db="${name//[^a-z0-9]/_}"
  echo "=== $name"
  psql_ -d postgres -c "drop database if exists $db" -c "create database $db"
  psql_ -v ON_ERROR_STOP=1 -d "$db" -f "$root/dev-tests/postgres/stub.sql"
  for m in "$root"/supabase/migrations/*.sql; do psql_ -v ON_ERROR_STOP=1 -d "$db" -f "$m"; done
  psql_ -d "$db" -f "$t" 2>&1
done
su postgres -c "$bin/pg_ctl -D $dir/data stop" >/dev/null 2>&1 || true
