# Backups (plan Free de Supabase)

El plan Free no incluye backups automáticos, así que los hacemos nosotros.
Todo se guarda en `docs/backups/` (ignorada por git).

## Requisitos (una sola vez)

- `pg_dump` 17+: `brew install postgresql@17` y añade su `bin` al PATH.
- `zip` (viene con macOS) para comprimir el backup de Storage.
- En `.env.local`:
  - `SUPABASE_DB_URL` → connection string del **Session pooler** (puerto 5432).
  - `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (ya los tienes).

## Scripts

| Script | Qué hace |
|---|---|
| `backup-db.sh` | `pg_dump` de la base → `docs/backups/db-<fecha>.sql` (+ `.schema.sql`, `.data.sql`). Auto-limpia dumps con más de 30 días. |
| `backup-storage.mjs` | Descarga el bucket `evidencias` → `docs/backups/storage-evidencias-<fecha>.zip` + `manifest.json`. Auto-limpia los antiguos. |
| `backup-all.sh` | Ejecuta los dos de arriba. Es el que corre el backup programado. |
| `install-backup-schedule.sh` | Programa `backup-all.sh` a diario con launchd. |

## Uso manual

```bash
./scripts/backup-db.sh        # solo base de datos
node scripts/backup-storage.mjs   # solo Storage
./scripts/backup-all.sh       # todo
```

## Backups periódicos (macOS / launchd)

```bash
./scripts/install-backup-schedule.sh          # diario a las 22:00
./scripts/install-backup-schedule.sh 9 30     # diario a las 09:30
./scripts/install-backup-schedule.sh --uninstall
```

Estado y logs:

```bash
launchctl list | grep basuracero
tail -f docs/backups/backup.log
launchctl start org.proyectobasuracero.backup   # forzar una corrida ahora
```

> launchd solo corre con tu sesión iniciada. Si el equipo está apagado/dormido
> a la hora prevista, el trabajo se lanza al despertar. Para backups que no
> dependan de tu Mac, conviene además guardar copias de `docs/backups/` en otro
> sitio (Dropbox, que ya usas, o un bucket externo).

## Retención

Por defecto se conservan 30 días. Ajusta con variables de entorno:

```bash
BACKUP_RETENTION_DAYS=14 STORAGE_RETENTION_DAYS=14 ./scripts/backup-all.sh
# usa 0 para no borrar nada
```

## Restaurar

```bash
# Base de datos (idealmente en OTRA base, no sobre producción):
set -a && source .env.local && set +a
psql "$SUPABASE_DB_URL" -f docs/backups/db-XXXX.sql

# Storage: descomprime el .zip y re-sube los archivos del bucket según manifest.json.
```
