#!/usr/bin/env bash
#
# install-backup-schedule.sh — Programa backups periódicos en macOS con launchd.
#
# Registra un LaunchAgent que ejecuta scripts/backup-all.sh de forma periódica.
# launchd es preferible a cron en macOS: sobrevive reinicios y, si el equipo
# estaba apagado/dormido a la hora prevista, lanza el trabajo al despertar.
#
# Uso:
#   ./scripts/install-backup-schedule.sh            # diario a las 22:00 (default)
#   ./scripts/install-backup-schedule.sh 9 30       # diario a las 09:30
#   ./scripts/install-backup-schedule.sh --uninstall
#
# Ver estado / logs:
#   launchctl list | grep basuracero
#   tail -f docs/backups/backup.log
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LABEL="org.proyectobasuracero.backup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_FILE="$PROJECT_ROOT/docs/backups/backup.log"

# Resolver binarios con ruta absoluta (launchd no hereda tu PATH de la shell).
BASH_BIN="$(command -v bash)"
NODE_BIN="$(command -v node || true)"
# Carpeta de node/brew para exponerla en el PATH del agente (pg_dump incluido).
EXTRA_PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
if [[ -n "$NODE_BIN" ]]; then
  EXTRA_PATH="$(dirname "$NODE_BIN"):$EXTRA_PATH"
fi

uninstall() {
  if [[ -f "$PLIST" ]]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✅ Desinstalado el backup programado ($LABEL)."
  else
    echo "No había backup programado ($PLIST no existe)."
  fi
}

if [[ "${1:-}" == "--uninstall" ]]; then
  uninstall
  exit 0
fi

HOUR="${1:-22}"
MINUTE="${2:-0}"

if ! [[ "$HOUR" =~ ^[0-9]+$ && "$MINUTE" =~ ^[0-9]+$ ]] || (( HOUR > 23 || MINUTE > 59 )); then
  echo "ERROR: hora inválida. Uso: ./scripts/install-backup-schedule.sh [HORA 0-23] [MIN 0-59]"
  exit 1
fi

mkdir -p "$(dirname "$PLIST")"
mkdir -p "$PROJECT_ROOT/docs/backups"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$BASH_BIN</string>
    <string>$SCRIPT_DIR/backup-all.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PROJECT_ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$EXTRA_PATH</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>$HOUR</integer>
    <key>Minute</key>
    <integer>$MINUTE</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>
</dict>
</plist>
PLIST_EOF

# Recargar (unload + load) para aplicar cambios si ya existía.
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

printf -v PRETTY "%02d:%02d" "$HOUR" "$MINUTE"
echo "✅ Backup programado todos los días a las $PRETTY."
echo "   Agente:  $LABEL"
echo "   Plist:   $PLIST"
echo "   Log:     $LOG_FILE"
echo ""
echo "Comandos útiles:"
echo "   Ver estado:   launchctl list | grep basuracero"
echo "   Ver log:      tail -f \"$LOG_FILE\""
echo "   Ejecutar ya:  launchctl start $LABEL"
echo "   Quitar:       ./scripts/install-backup-schedule.sh --uninstall"
