#!/usr/bin/env bash
#
# backup-db.sh — Backup manual de la base de datos Supabase (plan Free, sin backups automáticos).
#
# Hace un pg_dump completo (esquema + datos) a docs/backups/db-<fecha>.sql
# y, por defecto, también un dump solo-datos y solo-esquema por separado.
#
# Uso:
#   1. Copia la connection string (URI) desde el dashboard de Supabase:
#        Project Settings → Database → Connection string → URI
#      Para plan Free en red IPv4 usa el "Session pooler" (puerto 5432).
#
#   2. (Recomendado) Guárdala en .env.local, que ya está en .gitignore:
#        SUPABASE_DB_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-....pooler.supabase.com:5432/postgres"
#      y simplemente ejecuta:
#        ./scripts/backup-db.sh
#
#      Alternativas: exportarla como variable de entorno, o pasarla como argumento:
#        export SUPABASE_DB_URL="postgresql://..."   &&  ./scripts/backup-db.sh
#        ./scripts/backup-db.sh "postgresql://..."
#
# Auto-limpieza: borra dumps db-*.sql con más de BACKUP_RETENTION_DAYS días
# (por defecto 30). Desactívala con BACKUP_RETENTION_DAYS=0.
#
# Restaurar un dump completo en otra base:
#   psql "<CONNECTION_STRING_DESTINO>" -f docs/backups/db-XXXX.sql
#
set -euo pipefail

# --- Configuración ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/docs/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Carga SUPABASE_DB_URL desde .env.local si no viene por argumento ni entorno.
ENV_FILE="$PROJECT_ROOT/.env.local"
if [[ -z "${SUPABASE_DB_URL:-}" && -f "$ENV_FILE" ]]; then
  env_line="$(grep -E '^[[:space:]]*SUPABASE_DB_URL=' "$ENV_FILE" | tail -n 1 || true)"
  if [[ -n "$env_line" ]]; then
    env_value="${env_line#*=}"                 # quita todo hasta el primer '='
    env_value="${env_value%$'\r'}"             # quita posible CR de Windows
    env_value="${env_value#[\"\']}"            # quita comilla inicial (" o ')
    env_value="${env_value%[\"\']}"            # quita comilla final (" o ')
    SUPABASE_DB_URL="$env_value"
  fi
fi

# Prioridad: argumento > variable de entorno / .env.local
DB_URL="${1:-${SUPABASE_DB_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: falta la connection string."
  echo "  Opciones (en orden de prioridad):"
  echo "    1. Pásala como argumento:   ./scripts/backup-db.sh \"postgresql://...\""
  echo "    2. Expórtala:               export SUPABASE_DB_URL=\"postgresql://...\""
  echo "    3. Guárdala en .env.local:  SUPABASE_DB_URL=\"postgresql://...\""
  echo "  La encuentras en: Supabase Dashboard → Project Settings → Database → Connection string (URI)."
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump no está instalado. Instálalo con:"
  echo "  brew install libpq && brew link --force libpq"
  echo "  (o: brew install postgresql@17)"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "==> pg_dump versión: $(pg_dump --version)"
echo "==> Guardando backups en: $BACKUP_DIR"

COMMON_OPTS=(--no-owner --no-privileges)

FULL_FILE="$BACKUP_DIR/db-$STAMP.sql"
SCHEMA_FILE="$BACKUP_DIR/db-$STAMP.schema.sql"
DATA_FILE="$BACKUP_DIR/db-$STAMP.data.sql"

echo "==> 1/3 Backup COMPLETO (esquema + datos)..."
pg_dump "$DB_URL" "${COMMON_OPTS[@]}" -f "$FULL_FILE"

echo "==> 2/3 Backup solo ESQUEMA..."
pg_dump "$DB_URL" "${COMMON_OPTS[@]}" --schema-only -f "$SCHEMA_FILE"

echo "==> 3/3 Backup solo DATOS..."
pg_dump "$DB_URL" "${COMMON_OPTS[@]}" --data-only -f "$DATA_FILE"

echo ""
echo "✅ Backup completado:"
ls -lh "$FULL_FILE" "$SCHEMA_FILE" "$DATA_FILE"

# --- Auto-limpieza de backups antiguos -------------------------------------
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ && "$RETENTION_DAYS" -gt 0 ]]; then
  echo ""
  echo "==> Limpieza: eliminando dumps db-*.sql con más de $RETENTION_DAYS días..."
  # Solo toca los dumps de la base (db-*.sql, incluidos .schema/.data).
  # No borra backups manuales con otros nombres.
  deleted=0
  while IFS= read -r -d '' old; do
    rm -f "$old"
    echo "    borrado: $(basename "$old")"
    deleted=$((deleted + 1))
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db-*.sql' -mtime "+$RETENTION_DAYS" -print0 2>/dev/null)
  if [[ "$deleted" -eq 0 ]]; then
    echo "    nada que borrar."
  fi
fi

echo ""
echo "Para restaurar el backup completo en otra base:"
echo "  psql \"<CONNECTION_STRING_DESTINO>\" -f \"$FULL_FILE\""
