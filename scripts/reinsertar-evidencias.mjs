// Reinsercion de evidencias de alumno huerfanas tras borrar un weekly_challenge.
//
// Reconstruye, a partir de los OBJETOS que siguen en el bucket "evidencias",
// las filas borradas de student_submissions y student_evidence_files. El path
// de cada objeto es la fuente de verdad del vinculo:
//   <schoolId>/<groupId>/<studentId>/<challengeId>/<archivo>
//
// Que recupera:
//   - La foto y su vinculo escuela -> grupo -> alumno -> reto.
//   - Una student_submission por (alumno, reto) con status 'submitted'.
//     (El estado aprobado/rechazado, kg, materiales y comentarios se perdieron
//      con las filas; el maestro/admin re-aprueba despues.)
//   - submitted_at = fecha de subida mas antigua del archivo del alumno, o
//     la que se parsea del nombre del archivo (prefijo epoch-ms) como respaldo.
//
// Si el challenge fue borrado, lo RECREA con el MISMO id (necesario para que
// los paths del bucket sigan cuadrando). Requiere saber a que experimento
// apuntaba: se detecta por --week o se intenta la semana 1.
//
// SEGURIDAD: por defecto hace DRY-RUN (no escribe). Para escribir de verdad,
// pasar --commit. Es idempotente: usa upsert con onConflict en claves unicas,
// asi que correrlo dos veces no duplica.
//
// Uso:
//   node scripts/reinsertar-evidencias.mjs --challenge <id> [--week N] [--start YYYY-MM-DD --end YYYY-MM-DD] [--commit]
//
// Ejemplos:
//   # Ver que haria para el reto borrado (sin escribir):
//   node scripts/reinsertar-evidencias.mjs --challenge bc112383-a96f-4398-893b-067369db56a9 --week 1
//   # Ejecutar de verdad:
//   node scripts/reinsertar-evidencias.mjs --challenge bc112383-a96f-4398-893b-067369db56a9 --week 1 --commit

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BUCKET = "evidencias";

// --- args -------------------------------------------------------------------
const args = process.argv.slice(2);
function argVal(name) {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}
const CHALLENGE_ID = argVal("--challenge");
const WEEK = argVal("--week") ? Number(argVal("--week")) : null;
const START = argVal("--start");
const END = argVal("--end");
const COMMIT = args.includes("--commit");

if (!CHALLENGE_ID) {
  console.error("Falta --challenge <id>. Usa el id que aparece en el resumen de recuperacion.");
  process.exit(1);
}

// --- env --------------------------------------------------------------------
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error("No encontre .env.local con las variables de Supabase.");
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}
const supabase = createClient(url.trim().replace(/\/+$/, ""), serviceRole.trim(), {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --- helpers ----------------------------------------------------------------
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
      if (isFolder) out.push(...(await listAll(childPath)));
      else
        out.push({
          path: childPath,
          size: entry.metadata?.size ?? null,
          mimetype: entry.metadata?.mimetype ?? null,
          createdAt: entry.created_at ?? null,
          updatedAt: entry.updated_at ?? entry.created_at ?? null
        });
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function parsePath(path) {
  const parts = path.split("/");
  if (parts.length < 5) return null;
  const [schoolId, groupId, studentId, challengeId, ...rest] = parts;
  return { schoolId, groupId, studentId, challengeId, fileName: rest.join("/") };
}

// Deriva un submitted_at razonable: usa el prefijo epoch-ms del nombre si
// existe (p.ej. "1794014512835-IMG.jpeg"), si no la fecha de creacion del obj.
function deriveSubmittedAt(file) {
  const fileName = file.parsed?.fileName ?? file.fileName ?? "";
  const base = fileName.split("/").pop() ?? "";
  const m = base.match(/^(\d{10,13})-/);
  if (m) {
    const n = Number(m[1]);
    const ms = m[1].length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return file.createdAt ?? new Date().toISOString();
}

function guessMime(fileName) {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    mp4: "video/mp4",
    mov: "video/quicktime",
    pdf: "application/pdf"
  };
  return map[ext] ?? "application/octet-stream";
}

async function main() {
  console.log(`Modo: ${COMMIT ? "COMMIT (escribe en la BD)" : "DRY-RUN (no escribe)"}`);
  console.log(`Challenge objetivo: ${CHALLENGE_ID}\n`);

  // 1. Archivos del challenge objetivo.
  const all = await listAll("");
  const files = all
    .map((f) => ({ ...f, parsed: parsePath(f.path) }))
    .filter((f) => f.parsed && f.parsed.challengeId === CHALLENGE_ID);

  if (files.length === 0) {
    console.log("No hay archivos en el bucket para ese challenge. Nada que reinsertar.");
    return;
  }

  // 2. Asegurar que el challenge existe (recrearlo con el MISMO id si falta).
  const { data: existingChallenge } = await supabase
    .from("weekly_challenges")
    .select("id, experiment_id, school_id, start_date, end_date")
    .eq("id", CHALLENGE_ID)
    .maybeSingle();

  const schoolId = files[0].parsed.schoolId;

  if (!existingChallenge) {
    console.log("El challenge NO existe en la BD; hay que recrearlo con su id original.");
    // Experimento: por --week, o se intenta semana 1.
    const weekNumber = WEEK ?? 1;
    const { data: exp } = await supabase
      .from("experiments")
      .select("id, week_number, title")
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (!exp) {
      console.error(
        `No encontre un experimento de la semana ${weekNumber}. Pasa --week N con la semana correcta.`
      );
      process.exit(1);
    }
    const startDate = START ?? new Date().toISOString().slice(0, 10);
    const endDate = END ?? startDate;
    console.log(
      `  -> Recrear weekly_challenge id=${CHALLENGE_ID} school=${schoolId} ` +
        `experiment=semana ${exp.week_number} (${exp.title}) fechas ${startDate}..${endDate} is_current=false`
    );
    if (COMMIT) {
      const { error } = await supabase.from("weekly_challenges").insert({
        id: CHALLENGE_ID,
        school_id: schoolId,
        experiment_id: exp.id,
        start_date: startDate,
        end_date: endDate,
        is_current: false
      });
      if (error) throw error;
      console.log("  recreado.");
    }
  } else {
    console.log(
      `El challenge ya existe (semana/fechas ${existingChallenge.start_date}..${existingChallenge.end_date}). ` +
        "No se recrea; solo se reinsertan evidencias faltantes."
    );
  }

  // 3. Agrupar archivos por alumno -> una student_submission por alumno.
  const byStudent = new Map();
  for (const f of files) {
    const sid = f.parsed.studentId;
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid).push(f);
  }

  // Validar que los alumnos/grupos aun existen (si no, se omiten y se reportan).
  const studentIds = [...byStudent.keys()];
  const { data: studentsRows } = await supabase
    .from("students")
    .select("id, alias, group_id")
    .in("id", studentIds);
  const existingStudents = new Map((studentsRows ?? []).map((s) => [s.id, s]));

  let plannedSubs = 0;
  let plannedFiles = 0;
  const skipped = [];

  for (const [studentId, studentFiles] of byStudent) {
    const student = existingStudents.get(studentId);
    if (!student) {
      skipped.push({ studentId, reason: "alumno no existe en BD", files: studentFiles.length });
      continue;
    }
    const groupId = student.group_id ?? studentFiles[0].parsed.groupId;
    const submittedAt = studentFiles
      .map(deriveSubmittedAt)
      .sort()[0]; // la mas antigua

    plannedSubs += 1;
    plannedFiles += studentFiles.length;

    console.log(
      `\nAlumno ${student.alias} (${studentId}) - ${studentFiles.length} archivo(s), submitted_at=${submittedAt}`
    );

    if (!COMMIT) {
      for (const f of studentFiles) console.log(`    + ${f.path}`);
      continue;
    }

    // Upsert de la student_submission (unique challenge_id, student_id).
    const { data: sub, error: subErr } = await supabase
      .from("student_submissions")
      .upsert(
        {
          challenge_id: CHALLENGE_ID,
          student_id: studentId,
          group_id: groupId,
          status: "submitted",
          submitted_at: submittedAt
        },
        { onConflict: "challenge_id,student_id" }
      )
      .select("id")
      .single();
    if (subErr) throw subErr;

    // Reinsertar archivos. No hay unique natural en student_evidence_files, asi
    // que primero vemos cuales ya estan por file_path para no duplicar.
    const { data: already } = await supabase
      .from("student_evidence_files")
      .select("file_path")
      .eq("student_submission_id", sub.id);
    const have = new Set((already ?? []).map((r) => r.file_path));

    const toInsert = studentFiles
      .filter((f) => !have.has(f.path))
      .map((f) => ({
        student_submission_id: sub.id,
        file_path: f.path,
        file_type: f.mimetype ?? guessMime(f.parsed?.fileName ?? f.path)
      }));

    if (toInsert.length) {
      const { error: filesErr } = await supabase
        .from("student_evidence_files")
        .insert(toInsert);
      if (filesErr) throw filesErr;
    }
    console.log(`    insertados ${toInsert.length} archivo(s) (ya existian ${studentFiles.length - toInsert.length}).`);
  }

  console.log("\n==================== PLAN ====================");
  console.log(`student_submissions a crear/asegurar: ${plannedSubs}`);
  console.log(`student_evidence_files a reinsertar:  ${plannedFiles}`);
  if (skipped.length) {
    console.log(`\nOmitidos (requieren revision manual):`);
    for (const s of skipped) console.log(`  - ${s.studentId}: ${s.reason} (${s.files} archivos)`);
  }

  if (!COMMIT) {
    console.log("\nDRY-RUN: no se escribio nada. Si el plan se ve bien, repite con --commit.");
  } else {
    console.log("\nListo. Ahora en el panel admin pulsa 'Recalcular estadisticas' para");
    console.log("regenerar entregas de grupo, puntajes, ranking e insignias. Revisa las");
    console.log("fechas del reto con 'Editar fechas' y re-aprueba lo que corresponda.");
  }
}

main().catch((err) => {
  console.error("Error:", err?.message ?? err);
  process.exit(1);
});
