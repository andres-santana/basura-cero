// backup-storage.mjs — Backup del Storage de Supabase (bucket "evidencias").
//
// pg_dump NO respalda los archivos de Storage (fotos de evidencias), solo la
// base de datos. Este script descarga TODOS los objetos del bucket a una
// carpeta local con fecha, escribe un manifiesto JSON con los paths/tamaños,
// y (si hay `zip` disponible) comprime todo en un .zip.
//
// SOLO LECTURA sobre Supabase: descarga, nunca borra ni modifica el bucket.
//
// Uso:
//   node scripts/backup-storage.mjs
//
// Requiere en .env.local (no se imprimen sus valores):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Variables opcionales:
//   STORAGE_BUCKET=evidencias          # bucket a respaldar (default: evidencias)
//   STORAGE_RETENTION_DAYS=30          # borra backups de storage más viejos (0 = no limpiar)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const BACKUP_ROOT = join(PROJECT_ROOT, "docs", "backups");

// --- Carga simple de .env.local (sin dependencias) --------------------------
function loadEnvLocal() {
  const path = resolve(PROJECT_ROOT, ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(
      "No encontré .env.local en la raíz del proyecto. Créalo con " +
        "NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de correr esto."
    );
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const BUCKET = (process.env.STORAGE_BUCKET || "evidencias").trim();
const RETENTION_DAYS = Number.parseInt(process.env.STORAGE_RETENTION_DAYS ?? "30", 10);

const supabase = createClient(url.trim().replace(/\/+$/, ""), serviceRole.trim(), {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --- Listado recursivo del bucket ------------------------------------------
async function listAll(prefix = "") {
  const out = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const childPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id === null || entry.id === undefined;
      if (isFolder) {
        out.push(...(await listAll(childPath)));
      } else {
        out.push({
          path: childPath,
          size: entry.metadata?.size ?? null,
          updatedAt: entry.updated_at ?? entry.created_at ?? null
        });
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// --- Auto-limpieza de backups de storage antiguos --------------------------
function cleanupOldBackups() {
  if (!Number.isInteger(RETENTION_DAYS) || RETENTION_DAYS <= 0) return;
  if (!existsSync(BACKUP_ROOT)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(BACKUP_ROOT)) {
    if (!name.startsWith("storage-")) continue;
    const full = join(BACKUP_ROOT, name);
    try {
      if (statSync(full).mtimeMs < cutoff) {
        rmSync(full, { recursive: true, force: true });
        console.log(`    borrado (antiguo): ${name}`);
      }
    } catch {
      /* ignorar */
    }
  }
}

async function main() {
  const label = `storage-${BUCKET}-${stamp()}`;
  const destDir = join(BACKUP_ROOT, label);
  const filesDir = join(destDir, "files");
  mkdirSync(filesDir, { recursive: true });

  console.log(`==> Backup de Storage · bucket "${BUCKET}"`);
  console.log(`==> Destino: ${destDir}`);
  console.log("==> Listando objetos...");

  const files = await listAll("");
  if (files.length === 0) {
    console.log("El bucket está vacío o no hay archivos accesibles. Revisa el nombre del bucket y la service role key.");
    return;
  }
  console.log(`==> ${files.length} archivos a descargar.`);

  let ok = 0;
  let failed = 0;
  const manifest = [];

  for (const [i, f] of files.entries()) {
    const { data, error } = await supabase.storage.from(BUCKET).download(f.path);
    if (error || !data) {
      failed++;
      manifest.push({ ...f, downloaded: false, error: error?.message ?? "sin datos" });
      console.warn(`  [${i + 1}/${files.length}] FALLÓ ${f.path}: ${error?.message ?? "sin datos"}`);
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    const localPath = join(filesDir, f.path);
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, buf);
    ok++;
    manifest.push({ ...f, downloaded: true, bytes: buf.length });
    if ((i + 1) % 25 === 0 || i + 1 === files.length) {
      console.log(`  ...${i + 1}/${files.length}`);
    }
  }

  const manifestPath = join(destDir, "manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      { bucket: BUCKET, createdAt: new Date().toISOString(), total: files.length, ok, failed, files: manifest },
      null,
      2
    )
  );

  console.log("");
  console.log(`✅ Descargados: ${ok}/${files.length}${failed ? `  (fallidos: ${failed})` : ""}`);
  console.log(`   Manifiesto: ${manifestPath}`);

  // --- Comprimir a .zip si hay `zip` disponible -----------------------------
  const hasZip = spawnSync("which", ["zip"]).status === 0;
  if (hasZip) {
    const zipPath = `${destDir}.zip`;
    console.log("==> Comprimiendo a .zip...");
    const res = spawnSync("zip", ["-r", "-q", `${label}.zip`, label], { cwd: BACKUP_ROOT });
    if (res.status === 0) {
      rmSync(destDir, { recursive: true, force: true });
      console.log(`✅ Comprimido: ${zipPath} (carpeta temporal eliminada)`);
    } else {
      console.warn("No se pudo comprimir; se conserva la carpeta sin comprimir.");
    }
  } else {
    console.log("(Instala `zip` para comprimir automáticamente: la carpeta queda sin comprimir.)");
  }

  console.log("==> Limpieza de backups de Storage antiguos...");
  cleanupOldBackups();
}

main().catch((err) => {
  console.error("Error:", err?.message ?? err);
  process.exit(1);
});
