// Recuperacion de evidencias huerfanas tras borrar un weekly_challenge.
//
// CONTEXTO: al eliminar un reto (weekly_challenges) se borraron en cascada las
// filas de submissions / student_submissions / *_files / impact_metrics /
// scores. Los OBJETOS del bucket de Storage "evidencias" NO se borran al
// eliminar esas filas, por lo que siguen ahi, huerfanos. El path codifica:
//   evidencias/<schoolId>/<groupId>/<studentId>/<challengeId>/<archivo>
// (ver migracion 017). Con eso podemos reconstruir el vinculo escuela ->
// grupo -> alumno -> reto y re-enlazar los archivos.
//
// ESTE SCRIPT ES DE SOLO LECTURA. No inserta ni borra nada: solo lista el
// bucket, parsea los paths y reporta que sobrevive y a que corresponde,
// cruzando contra la BD actual (grupos, alumnos, retos) para saber que sigue
// existiendo y que habria que recrear.
//
// Uso:
//   node scripts/recuperar-evidencias.mjs
// Requiere en .env.local (no se imprimen sus valores):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BUCKET = "evidencias";

// --- Carga simple de .env.local (sin dependencias) --------------------------
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(
      "No encontre .env.local en la raiz del proyecto. Crealo con " +
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
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local."
  );
  process.exit(1);
}

const supabase = createClient(url.trim().replace(/\/+$/, ""), serviceRole.trim(), {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --- Listado recursivo del bucket ------------------------------------------
async function listAll(prefix = "") {
  const out = [];
  const pageSize = 100;
  let offset = 0;
  // Nota: list() no es recursivo. Devuelve "carpetas" (sin id) y archivos
  // (con id). Recorremos en profundidad.
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
        const nested = await listAll(childPath);
        out.push(...nested);
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

function parsePath(path) {
  // evidencias/<schoolId>/<groupId>/<studentId>/<challengeId>/<archivo>
  // (el nombre del bucket NO viene incluido en los paths de list()).
  const parts = path.split("/");
  if (parts.length < 5) return null;
  const [schoolId, groupId, studentId, challengeId, ...rest] = parts;
  return { schoolId, groupId, studentId, challengeId, fileName: rest.join("/") };
}

async function main() {
  console.log(`Listando el bucket "${BUCKET}" (solo lectura)...\n`);
  const files = await listAll("");
  if (files.length === 0) {
    console.log(
      "El bucket esta vacio o no hay archivos accesibles. Si esperabas " +
        "evidencias aqui, revisa el nombre del bucket y la service role key."
    );
    return;
  }

  const parsed = [];
  const unparseable = [];
  for (const f of files) {
    const p = parsePath(f.path);
    if (p) parsed.push({ ...f, ...p });
    else unparseable.push(f);
  }

  // Agrupar por challenge para ver que retos tienen archivos huerfanos.
  const byChallenge = new Map();
  for (const f of parsed) {
    const key = f.challengeId;
    if (!byChallenge.has(key)) byChallenge.set(key, []);
    byChallenge.get(key).push(f);
  }

  const schoolIds = [...new Set(parsed.map((f) => f.schoolId))];
  const groupIds = [...new Set(parsed.map((f) => f.groupId))];
  const studentIds = [...new Set(parsed.map((f) => f.studentId))];
  const challengeIds = [...new Set(parsed.map((f) => f.challengeId))];

  // Cruce con la BD actual: que de esos IDs sigue existiendo.
  const [groupsRes, studentsRes, challengesRes] = await Promise.all([
    supabase.from("groups").select("id, name, grade, school_id").in("id", groupIds),
    supabase.from("students").select("id, alias, group_id").in("id", studentIds),
    supabase.from("weekly_challenges").select("id, experiment_id, start_date, end_date").in("id", challengeIds)
  ]);

  const existingGroups = new Map((groupsRes.data ?? []).map((g) => [g.id, g]));
  const existingStudents = new Map((studentsRes.data ?? []).map((s) => [s.id, s]));
  const existingChallenges = new Map((challengesRes.data ?? []).map((c) => [c.id, c]));

  console.log("==================== RESUMEN ====================");
  console.log(`Archivos en el bucket:            ${files.length}`);
  console.log(`Con path reconocible:             ${parsed.length}`);
  console.log(`Con path NO reconocible:          ${unparseable.length}`);
  console.log(`Escuelas distintas:               ${schoolIds.length}`);
  console.log(`Grupos distintos:                 ${groupIds.length}`);
  console.log(`Alumnos distintos:                ${studentIds.length}`);
  console.log(`Retos (challenges) distintos:     ${challengeIds.length}`);
  console.log("");

  console.log("==================== POR RETO ====================");
  for (const [challengeId, group] of byChallenge) {
    const ch = existingChallenges.get(challengeId);
    const estado = ch
      ? `EXISTE en BD (reto ${ch.start_date} a ${ch.end_date})`
      : "NO EXISTE en BD (borrado) -> habria que recrearlo para re-enlazar";
    const alumnos = new Set(group.map((f) => f.studentId));
    console.log(`\nChallenge ${challengeId}`);
    console.log(`  ${estado}`);
    console.log(`  Archivos huerfanos: ${group.length}  |  Alumnos: ${alumnos.size}`);
    for (const f of group.slice(0, 5)) {
      const st = existingStudents.get(f.studentId);
      const g = existingGroups.get(f.groupId);
      console.log(
        `    - grupo ${g ? g.name : "(borrado)"} / alumno ${st ? st.alias : "(borrado)"} / ${f.fileName}`
      );
    }
    if (group.length > 5) console.log(`    ... y ${group.length - 5} mas`);
  }

  if (unparseable.length) {
    console.log("\n==================== PATHS NO RECONOCIBLES ====================");
    for (const f of unparseable.slice(0, 20)) console.log(`  ${f.path}`);
    if (unparseable.length > 20) console.log(`  ... y ${unparseable.length - 20} mas`);
  }

  console.log("\nSolo lectura: no se modifico nada. Comparte este resumen para");
  console.log("preparar el script de reinsercion de las evidencias huerfanas.");
}

main().catch((err) => {
  console.error("Error:", err?.message ?? err);
  process.exit(1);
});
