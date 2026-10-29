-- Creates the limited database user the API runs as. Run ONCE on the VPS, as the
-- postgres superuser, after the tables exist (npm run db:migrate):
--
--   sudo -u postgres psql -d learnhub -v api_password='choose-a-long-random-password' -f api-user.sql
--
-- Afterwards:
--   learnhub_app  owns the tables. Only migrations use it (MIGRATION_DATABASE_URL).
--   learnhub_api  can read and change rows, nothing else (DATABASE_URL, used by the API).
-- So if the API is ever broken into, the attacker cannot drop or alter tables, create
-- users, or read the other apps' tables on this server (it has no rights on them).
--
-- Safe to run again: it only changes the password and repeats the grants.

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnhub_api') THEN
    CREATE ROLE learnhub_api LOGIN;
  END IF;
END $$;

-- The password comes from the psql command line, so it is never written in this file.
ALTER ROLE learnhub_api WITH LOGIN PASSWORD :'api_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- In Postgres 14 every user may create tables in "public". Take that away, and give it
-- back only to the owner, who needs it for migrations.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO learnhub_app;

-- What the API needs: rows in, rows out, and the id counters (SERIAL columns).
GRANT USAGE ON SCHEMA public TO learnhub_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO learnhub_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learnhub_api;

-- Tables that future migrations add (made by learnhub_app) get the same rights by themselves.
ALTER DEFAULT PRIVILEGES FOR ROLE learnhub_app IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO learnhub_api;
ALTER DEFAULT PRIVILEGES FOR ROLE learnhub_app IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO learnhub_api;
