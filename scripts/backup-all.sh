#!/usr/bin/env bash
#
# backup-all.sh — Backup COMPLETO del proyecto: base de datos + Storage.
#
# Ejecuta backup-db.sh (pg_dump) y backup-storage.mjs (objetos del bucket).
# Pensado para correr a mano o desde cron/launchd (backups periódicos).
#
# Uso:
#   ./scripts/backup-all.sh
#
# Lee SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
# desde .env.local automáticamente (igual que los scripts individuales).
#
# Retención (opcional, ambos default 30 días; 0 = no limpiar):
#   BACKUP_RETENTION_DAYS=30   STORAGE_RETENTION_DAYS=30
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "######################################################"
echo "#  Backup completo — $(date '+%Y-%m-%d %H:%M:%S')"
echo "######################################################"

echo ""
echo ">>> [1/2] Base de datos"
bash "$SCRIPT_DIR/backup-db.sh"

echo ""
echo ">>> [2/2] Storage"
node "$SCRIPT_DIR/backup-storage.mjs"

echo ""
echo "✅ Backup completo terminado. Archivos en: $PROJECT_ROOT/docs/backups"
