#!/usr/bin/env bash
# Nightly backup of Atlas: the database and the uploaded files.
# Run it from cron on the VPS (see "Backups" in the README):
#   30 2 * * * /var/www/learnhub/backend/scripts/backup.sh >> /var/log/atlas-backup.log 2>&1
#
# It writes two files per night into BACKUP_DIR and keeps the last KEEP_DAYS nights:
#   atlas-db-YYYY-MM-DD.sql.gz        everything in Postgres (pg_dump)
#   atlas-uploads-YYYY-MM-DD.tar.gz   the uploads folder
# A backup on the same disk does not survive the disk dying, so copy BACKUP_DIR to another
# machine too (the README shows one way).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/atlas}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# This script lives in backend/scripts, so backend/ is one folder up.
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Read DATABASE_URL and UPLOAD_DIR from backend/.env, the same settings the API uses.
read_setting() {
  grep -E "^$1=" "$BACKEND_DIR/.env" | tail -n 1 | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//'
}
# The owner's URL if there is one: it can read every table for sure.
DATABASE_URL="$(read_setting MIGRATION_DATABASE_URL)"
DATABASE_URL="${DATABASE_URL:-$(read_setting DATABASE_URL)}"
UPLOAD_DIR="$(read_setting UPLOAD_DIR)"
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
# A relative upload folder is relative to backend/, as in the API.
case "$UPLOAD_DIR" in
  /*) ;;
  *) UPLOAD_DIR="$BACKEND_DIR/${UPLOAD_DIR#./}" ;;
esac

if [ -z "$DATABASE_URL" ]; then
  echo "$(date -Is) backup failed: DATABASE_URL is not set in $BACKEND_DIR/.env"
  exit 1
fi

TODAY="$(date +%F)"
mkdir -p "$BACKUP_DIR"
# Only the owner may read backups: they hold every user's email and notes.
chmod 700 "$BACKUP_DIR"

# Write to a temporary name first, so a half-written file never looks like a good backup.
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$BACKUP_DIR/atlas-db-$TODAY.sql.gz.part"
mv "$BACKUP_DIR/atlas-db-$TODAY.sql.gz.part" "$BACKUP_DIR/atlas-db-$TODAY.sql.gz"

tar -czf "$BACKUP_DIR/atlas-uploads-$TODAY.tar.gz.part" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
mv "$BACKUP_DIR/atlas-uploads-$TODAY.tar.gz.part" "$BACKUP_DIR/atlas-uploads-$TODAY.tar.gz"

# Remove backups older than KEEP_DAYS nights.
find "$BACKUP_DIR" -maxdepth 1 -name 'atlas-*.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup done: $(du -sh "$BACKUP_DIR" | cut -f 1) in $BACKUP_DIR"
