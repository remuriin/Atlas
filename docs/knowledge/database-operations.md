# Database operations for Atlas

This page explains how the Atlas PostgreSQL database is created, changed, filled with sample data, reset, protected and backed up. It covers `npm run db:migrate`, `npm run db:seed`, the two database users, the nightly backup script, the connection pool and the SSL setting. Items marked "planned" are written and committed in the repository but not yet set up on the live server.

## How do database migrations work in Atlas?

Atlas has no migration framework and no table that records applied versions. `npm run db:migrate`, run in the `backend/` folder, starts `backend/db/migrate.js`, which reads the whole of `backend/db/schema.sql` and sends it to PostgreSQL as one batch. Every statement in schema.sql checks for itself whether it is still needed: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, ALTER TABLE ... ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, DO blocks that look in `pg_constraint` before adding a check, and UPDATE statements that only touch rows still missing a value. So the migration is idempotent, meaning safe to run again and again: run it after pulling changes and after every change to schema.sql, locally and on the server. The batch has no parameters, so PostgreSQL runs all of it as one transaction: if one statement fails, none of the changes stay. Success prints "Database is ready: all tables and indexes exist." New schema changes are added to schema.sql in the same repeatable style. Migrations never add sample data; that is `npm run db:seed`.

## Which database user runs Atlas migrations?

Creating and changing tables needs the owner of the tables, not the API's limited user. `backend/db/migrate.js` and `backend/db/seed.js` connect with `MIGRATION_DATABASE_URL` from `backend/.env`. When it is empty they use `DATABASE_URL`, which is normal in development, where one database user does everything. In production `DATABASE_URL` is meant for the limited user `learnhub_api` and `MIGRATION_DATABASE_URL` for the owner `learnhub_app`; on the live server the limited user exists and `MIGRATION_DATABASE_URL` is set for the owner (checked 2026-10-31, see [Which database users does Atlas have?](database-operations.md#which-database-users-does-atlas-have)). Both scripts load `backend/src/config/env.js` first, so they need the same valid settings as the API: a real DATABASE_URL that is not the placeholder, a FIREBASE_PROJECT_ID, and a valid CLAMAV_MODE. Without them they stop with "Atlas backend cannot start yet." just like the API. If a migration runs as a user that may not change tables, PostgreSQL answers with error code 42501.

## What errors can npm run db:migrate print?

When a migration fails, `backend/db/migrate.js` prints "Migration failed:", the error message, the code in brackets, and one plain next step:

| Code | What it means |
| --- | --- |
| ECONNREFUSED | The host was reached, but nothing listens on that address and port |
| ETIMEDOUT, or "timeout" in the message | No answer within 10 seconds: blocked, or the host is not reachable from this computer |
| ENOTFOUND | The host name in the URL does not exist, often a typing mistake |
| 28000 | PostgreSQL refused this computer or user (no matching line in pg_hba.conf) |
| 28P01 | The user name or password is wrong |
| 3D000 | The database named at the end of the URL does not exist |
| 42501 | The user may not create or change tables |
| any other | Check the URL and that PostgreSQL is running |

The hints always name DATABASE_URL, but the URL actually used is MIGRATION_DATABASE_URL whenever that is set. For the live database, a timeout usually means this computer is not connected to the server's private network. Fixes for each code are in [Why does npm run db:migrate fail to connect?](troubleshooting.md#why-does-npm-run-dbmigrate-fail-to-connect) and [Why does npm run db:migrate say the login or permission is wrong?](troubleshooting.md#why-does-npm-run-dbmigrate-say-the-login-or-permission-is-wrong).

## How do I add the sample data to Atlas?

`npm run db:seed`, run in `backend/`, starts `backend/db/seed.js`. It adds six sample students (`seed-user-1` to `seed-user-6`, such as Andrea Santos, with emails at `atlas.example`) and sixteen study reviewers, two for each strand: All strands, STEM, ABM, HUMSS, GAS, TVL, Arts and Design, and Sports. Each reviewer is an original PDF in `backend/db/seed-files/`, written for Atlas and long enough for at least 10 flashcards. Each PDF passes the same content check as a real upload (`checkFileContents`), is copied into `UPLOAD_DIR` under its own name, and gets its SHA-256 `file_hash`. The posting dates are spread from 32 to 2 days ago so the New tab has an order, and the students upvote each other's reviewers (1 to 5 upvotes each). The sample students have no Firebase account, so nobody can log in as them. If `seed-user-1` already exists the script prints "Sample data is already there. Nothing to do." The database work runs in one transaction; on failure it prints "Seeding failed, nothing was changed:" and asks whether `npm run db:migrate` was run first. The seed never runs by itself and does not run the virus scan.

## How do I reset the Atlas database to the sample data?

The reset replaces all data with the sample data and refuses to run without a backup file:

```
npm run db:seed -- --reset --backup ../../atlas-reset-backup.json
```

1. It saves every row of all eight tables to the JSON file, reads the file back, and checks the row counts.
2. In one transaction it deletes every flashcard, saved item with its notes, report, upvote, recently viewed row, reviewer and rate limit row, and every user whose role is not `'admin'`.
3. It adds the six sample students and sixteen reviewers.

If step 2 or 3 fails, the transaction is rolled back and nothing is deleted. Admins keep their account and admin role, but their own reviewers, saved items, notes and flashcards are deleted like everyone else's. The reset deletes rows only: old uploaded files stay in the uploads folder until someone removes them. The backup JSON holds every user's email and notes, so keep it private and outside the repository; the `--` makes npm pass the flags to the script. No tool loads the JSON back automatically. The live database was reset this way on 2026-10-31: afterwards it held the six sample students, the sixteen sample reviewers and the kept admin account.

## How do the sample PDF files reach the server's uploads folder?

The Atlas seed script copies the 16 sample PDFs from `backend/db/seed-files/` into `UPLOAD_DIR` on the computer where the script runs, and the database rows point at those names, such as `seed-rock-cycle.pdf`. When the seed runs on a different computer from the API, for example a laptop connected to the live database through the server's private network, the PDFs land in the laptop's uploads folder instead of the server's. Every sample reviewer then answers "The file for this study reviewer is missing." until the PDFs are copied into the server's uploads folder, the folder named by UPLOAD_DIR in the server's `backend/.env`. The file names must stay exactly as they are in seed-files. Running the seed on the server itself, with the server's `backend/.env`, writes the PDFs to the right place. The same rule applies to any study reviewer: the database row and its file must be on the same machine as the API.

## Which database users does Atlas have?

Atlas is designed to use two PostgreSQL users (roles) on the live server:

| User | Rights | Used by |
| --- | --- | --- |
| `learnhub_app` | Owns the `learnhub` database and its tables | `npm run db:migrate`, `npm run db:seed` and the backup script, through `MIGRATION_DATABASE_URL` |
| `learnhub_api` | Only SELECT, INSERT, UPDATE and DELETE on the tables, plus the id counters | The API, through `DATABASE_URL` |

The idea is least privilege: each part gets only the rights it needs. If the API were ever broken into, an attacker acting as `learnhub_api` could change rows, but could not drop or alter tables, create users, or touch other apps' tables on the server. `backend/db/api-user.sql` creates the limited role and must be run by the PostgreSQL superuser. On the live server `learnhub_api` exists, and `MIGRATION_DATABASE_URL` is set for the owner `learnhub_app` (checked 2026-10-31). In local development one user does everything and `MIGRATION_DATABASE_URL` stays empty.

## How does api-user.sql set up the limited API user?

`backend/db/api-user.sql` is run once with psql from the `backend/db` folder, connected to the `learnhub` database as the PostgreSQL superuser, after the tables exist. The new password is passed as the psql variable `api_password`, so it is never written in the file:

```
psql -d learnhub -v api_password='A-LONG-RANDOM-PASSWORD' -f api-user.sql
```

1. It creates the role `learnhub_api` with LOGIN if it does not exist.
2. It sets the password and the limits NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOBYPASSRLS.
3. It removes the right that PostgreSQL 14 gives every user to create tables in the `public` schema, and gives USAGE and CREATE on it back to `learnhub_app` only.
4. It grants `learnhub_api` USAGE on the schema, SELECT, INSERT, UPDATE and DELETE on all tables, and USAGE and SELECT on all sequences (the SERIAL id counters).
5. It sets default privileges, so tables and sequences that `learnhub_app` creates later get the same grants by themselves.

It stops at the first error (ON_ERROR_STOP) and is safe to run again, which also changes the password. Afterwards DATABASE_URL uses `learnhub_api`, MIGRATION_DATABASE_URL uses `learnhub_app`, and the API is restarted. A quick check: as `learnhub_api`, `CREATE TABLE api_check (id INTEGER);` must fail with "permission denied for schema public". On the live server the role exists (checked 2026-10-31).

## How do Atlas database backups work?

`backend/scripts/backup.sh` is a bash script meant to run every night from cron, for example at 02:30, as the user that runs the API. Status: planned, not yet installed on the live server. Each run writes two files into the backup folder on the server (`BACKUP_DIR`):

- `atlas-db-YYYY-MM-DD.sql.gz`: the whole database, made by `pg_dump --no-owner --no-privileges` and compressed with gzip.
- `atlas-uploads-YYYY-MM-DD.tar.gz`: the uploads folder.

The script reads MIGRATION_DATABASE_URL, or else DATABASE_URL, and UPLOAD_DIR from `backend/.env`, the same settings the API uses. Each file is written under a `.part` name first and renamed when complete, so a half-written file never looks like a good backup. The folder is limited to its owner (chmod 700), because backups hold every user's email and notes. Backups older than `KEEP_DAYS` nights, 14 by default, are deleted. The script needs `pg_dump` from the `postgresql-client` package with the same major version as the server, PostgreSQL 14; a pg_dump older than the server refuses to dump it. Each run prints "backup done" with the folder size, or "backup failed: DATABASE_URL is not set" when no URL is found.

## How do I restore Atlas from a backup?

A study reviewer is a database row plus a file, so always restore the database dump and the uploads archive from the same night. In general terms:

1. Stop the API so nothing writes during the restore.
2. Create an empty database, or empty the old one.
3. Load the dump as the table owner, for example `gunzip -c atlas-db-2026-10-29.sql.gz | psql "OWNER-DATABASE-URL"`.
4. The dump leaves out owners and grants, so whoever loads it becomes the owner of the tables. Run `backend/db/api-user.sql` again if the limited API user is in use.
5. Unpack the uploads archive in the folder that contains the uploads folder, because the archive holds the uploads folder itself. Every `stored_name` then has its file again.
6. Start the API and open a few study reviewers to check that their files load.

The JSON file made by `npm run db:seed -- --reset --backup` is a different thing: a one-off copy taken before a reset, with no tool that loads it back automatically.

## Why should Atlas backups be copied to another machine?

A backup on the same disk as the Atlas database is lost together with that disk, the server or the hosting account. `backend/scripts/backup.sh` only writes to the backup folder on the server, so the plan is to also copy that folder to another machine every night, for example with rsync from a second cron line. That off-machine copy is recommended but not yet set up. The copy must stay as private as the original: the database dumps contain every user's email, display name and notes, and the uploads archives contain every uploaded file. Keep at least the 14 nights that KEEP_DAYS keeps, so a problem noticed late can still be undone. Try a restore into a scratch database now and then, because a backup that has never been restored is not proven to work.

## How does the Atlas API connect to the database?

`backend/src/config/createPool.js` builds a node-postgres (`pg`) connection pool: a few open connections that are reused instead of opening a new one for every request. Its settings are at most 10 connections (`max: 10`) and 10 seconds to connect before giving up (`connectionTimeoutMillis: 10000`). The API uses one shared pool made from DATABASE_URL (`backend/src/config/db.js`), which the models and the rate-limit store share. `migrate.js` and `seed.js` build their own pool from MIGRATION_DATABASE_URL. An error on an idle connection is logged as "Unexpected database connection error:" instead of crashing the process. When the API is asked to stop (SIGINT or SIGTERM, for example Ctrl+C or a restart), it finishes open requests and then closes the pool. All SQL lives in `backend/src/models/` (plus `backend/db/`) and passes values through `$1, $2` placeholders, never by gluing text together, which prevents SQL injection.

## What does DATABASE_SSL do in Atlas?

`DATABASE_SSL` in `backend/.env` turns on SSL for every Atlas database connection when it is exactly `true`; any other value, including the default `false`, means no SSL. With SSL on, `backend/src/config/createPool.js` passes `ssl: { rejectUnauthorized: false }`: the connection is encrypted, but the server's certificate is not verified. That suits a self-signed certificate on a private network. It stops anyone on the way from reading the traffic, but it would not notice a different machine pretending to be the database. Use it only when PostgreSQL runs on another machine and requires SSL. When the API and PostgreSQL run on the same server and connect through localhost, as the README recommends, it stays false. The setting applies to the API, migrations and the seed script alike, because all of them build their pool with createPool.js.

## Who can reach the Atlas database?

The live Atlas database is private. It can only be reached through the server's own private network (a VPN), never from the open internet, and the API runs on that same server. This is a deliberate design, not a weakness: because the database is not exposed to the internet, nobody outside can even try a password. Running migrations or the seed script against the live database therefore happens on the server itself or from a computer connected to that private network; without the connection, attempts time out. The limited API user `learnhub_api`, which exists on the live server, adds a second layer inside the server: connected as that user, even the API itself could not change the table structure. Local development never needs the live database; it uses a local PostgreSQL instead, and the README section "If the database must be on a different machine" lists what to change if the setup ever moves.
