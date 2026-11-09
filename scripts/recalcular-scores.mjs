// Recalculo de scores de GRUPO para una escuela, replicando exactamente la
// logica de src/lib/scoring/calculate.ts + src/lib/services/scoring-service.ts
// (incluye los fixes B6/B7). Pensado para desbloquear cuando el endpoint
// POST /api/admin/recalcular no surte efecto.
//
// Uso:
//   node scripts/recalcular-scores.mjs --dry     (solo muestra, no escribe)
//   node scripts/recalcular-scores.mjs           (escribe scores + badges)
//
// Requiere en .env.local (no imprime valores):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DRY = process.argv.includes("--dry");
const SCHOOL_ID = "a7661634-cb91-4efa-8f0e-fce1ca8dbba8"; // Colegios Cruz Azul

// --- env ---
function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --- reglas (copiadas 1:1 de src/lib/scoring/rules.ts + calculate.ts) ---
const W = {
  experimentCompleted: 20, evidenceComplete: 15, stepsMax: 15, gamesMax: 10,
  participationMax: 10, wasteReductionMax: 10, reusedItemsMax: 10,
  recycledItemsMax: 10, equivalentKgMax: 30
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function timeDecayFactor(d) {
  if (d <= 0) return 1.0;
  if (d === 1) return 0.97;
  if (d === 2) return 0.94;
  if (d === 3) return 0.9;
  if (d <= 5) return 0.85;
  if (d <= 7) return 0.8;
  if (d <= 10) return 0.7;
  if (d <= 14) return 0.6;
  return 0.5;
}
function computeDaysElapsed(startDate, submittedAt) {
  if (!startDate) return 0;
  const submittedDay = (submittedAt ?? new Date().toISOString()).slice(0, 10);
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`);
  const got = Date.parse(`${submittedDay}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(got)) return 0;
  const diff = Math.round((got - start) / 86_400_000);
  return diff > 0 ? diff : 0;
}
function calculateScore(m) {
  const participationPct = m.expectedParticipants > 0
    ? (m.participantsCount / m.expectedParticipants) * 100 : 0;
  const participation = clamp(Math.round(participationPct / 10), 0, W.participationMax);
  const usesCatalog = m.usesMaterialCatalog === true;
  const equivalentKg = usesCatalog
    ? clamp(Math.round((m.equivalentKg ?? 0) * 0.5 * 10) / 10, 0, W.equivalentKgMax) : 0;
  const waste = usesCatalog ? 0 : clamp(Math.round(m.kgSeparated * 0.5 * 10) / 10, 0, W.wasteReductionMax);
  const reuse = usesCatalog ? 0 : clamp(m.reusedItems, 0, W.reusedItemsMax);
  const recycle = usesCatalog ? 0 : clamp(m.recycledItems ?? 0, 0, W.recycledItemsMax);
  const experiment = W.experimentCompleted;
  const evidence = m.hasEvidenceFile ? W.evidenceComplete : 0;
  const steps = Math.round(clamp(m.stepsCompletionRatio ?? 0, 0, 1) * W.stepsMax);
  const games = Math.round(clamp(m.gamesCompletionRatio ?? 0, 0, 1) * W.gamesMax);
  const subtotal = experiment + evidence + steps + games + participation + equivalentKg + waste + reuse + recycle;
  const daysElapsed = m.daysElapsed ?? (m.isOnTime ? 0 : 1);
  const factor = timeDecayFactor(daysElapsed);
  const basePoints = clamp(Math.round(subtotal * factor), 0, 100);
  const studentPoints = Math.max(0, Math.round(m.studentPointsTotal ?? 0));
  return {
    pointsTotal: basePoints + studentPoints,
    breakdown: {
      experimentCompleted: experiment, evidenceComplete: evidence, steps, games,
      participation, equivalentKg, wasteReduction: waste, reusedItems: reuse,
      recycledItems: recycle, usesMaterialCatalog: usesCatalog ? 1 : 0,
      subtotal, daysElapsed, timeFactor: factor, basePoints, studentPoints
    }
  };
}

const pickOne = (v) => (Array.isArray(v) ? v[0] ?? null : v ?? null);

async function countActiveStudents(groupId) {
  const { count } = await supabase.from("students")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId).eq("is_active", true);
  return count ?? 0;
}
async function experimentHasMaterials(experimentId) {
  const { count } = await supabase.from("experiment_materials")
    .select("id", { count: "exact", head: true })
    .eq("experiment_id", experimentId).eq("is_active", true);
  return (count ?? 0) > 0;
}
async function countStudentEvidenceFiles(groupId, challengeId) {
  const { data } = await supabase.from("student_submissions")
    .select("id, student_evidence_files(id)")
    .eq("group_id", groupId).eq("challenge_id", challengeId)
    .in("status", ["submitted", "approved"]);
  return (data ?? []).reduce((s, r) =>
    s + (Array.isArray(r.student_evidence_files) ? r.student_evidence_files.length : 0), 0);
}
async function aggregateStudentProgress(groupId, challengeId, experimentId) {
  const [{ data: students }, { data: steps }, { data: games }] = await Promise.all([
    supabase.from("students").select("id").eq("group_id", groupId).eq("is_active", true),
    supabase.from("experiment_steps").select("id, points").eq("experiment_id", experimentId),
    supabase.from("experiment_games").select("id, points").eq("experiment_id", experimentId).eq("is_active", true)
  ]);
  const active = students ?? [], stepRows = steps ?? [], gameRows = games ?? [];
  const totalSteps = stepRows.length, totalGames = gameRows.length;
  if (active.length === 0 || (totalSteps === 0 && totalGames === 0))
    return { stepsCompletionRatio: 0, gamesCompletionRatio: 0, studentPointsTotal: 0 };
  const ids = active.map((s) => s.id);
  const stepPts = new Map(stepRows.map((s) => [s.id, Number(s.points ?? 0)]));
  const gamePts = new Map(gameRows.map((g) => [g.id, Number(g.points ?? 0)]));
  const [{ data: sp }, { data: gp }] = await Promise.all([
    supabase.from("student_step_progress").select("student_id, step_id").eq("challenge_id", challengeId).in("student_id", ids),
    supabase.from("student_game_progress").select("student_id, game_id, completed_at").eq("challenge_id", challengeId).in("student_id", ids)
  ]);
  const stepsByStu = new Map(); let studentPointsTotal = 0;
  for (const r of sp ?? []) {
    stepsByStu.set(r.student_id, (stepsByStu.get(r.student_id) ?? 0) + 1);
    studentPointsTotal += stepPts.get(r.step_id) ?? 0;
  }
  const stepsRatioSum = ids.reduce((s, id) => totalSteps === 0 ? s : s + Math.min(1, (stepsByStu.get(id) ?? 0) / totalSteps), 0);
  const stepsCompletionRatio = totalSteps === 0 ? 0 : stepsRatioSum / active.length;
  const gamesByStu = new Map();
  for (const r of gp ?? []) if (r.completed_at) {
    gamesByStu.set(r.student_id, (gamesByStu.get(r.student_id) ?? 0) + 1);
    studentPointsTotal += gamePts.get(r.game_id) ?? 0;
  }
  const gamesRatioSum = ids.reduce((s, id) => totalGames === 0 ? s : s + Math.min(1, (gamesByStu.get(id) ?? 0) / totalGames), 0);
  const gamesCompletionRatio = totalGames === 0 ? 0 : gamesRatioSum / active.length;
  return { stepsCompletionRatio, gamesCompletionRatio, studentPointsTotal };
}

async function recalc(submissionId) {
  const { data } = await supabase.from("submissions")
    .select("id, group_id, challenge_id, participants_count, submitted_at, status, weekly_challenges(start_date, end_date, experiment_id), impact_metrics(kg_separated, reused_items, recycled_items, equivalent_kg), evidence_files(id)")
    .eq("id", submissionId).maybeSingle();
  if (!data) return null;
  const challenge = pickOne(data.weekly_challenges);
  const metrics = pickOne(data.impact_metrics);
  const groupFiles = Array.isArray(data.evidence_files) ? data.evidence_files.length : 0;
  const studentFiles = await countStudentEvidenceFiles(data.group_id, data.challenge_id);
  const daysElapsed = challenge ? computeDaysElapsed(challenge.start_date, data.submitted_at) : 0;
  const active = await countActiveStudents(data.group_id);
  const expectedParticipants = active > 0 ? active : Math.max(data.participants_count ?? 0, 1);
  const progress = challenge
    ? await aggregateStudentProgress(data.group_id, data.challenge_id, challenge.experiment_id)
    : { stepsCompletionRatio: 0, gamesCompletionRatio: 0, studentPointsTotal: 0 };
  const usesMaterialCatalog = challenge ? await experimentHasMaterials(challenge.experiment_id) : false;
  const score = calculateScore({
    participantsCount: data.participants_count ?? 0, expectedParticipants,
    kgSeparated: Number(metrics?.kg_separated ?? 0),
    reusedItems: Number(metrics?.reused_items ?? 0),
    recycledItems: Number(metrics?.recycled_items ?? 0),
    equivalentKg: Number(metrics?.equivalent_kg ?? 0),
    usesMaterialCatalog, hasEvidenceFile: (groupFiles + studentFiles) > 0,
    daysElapsed, isOnTime: daysElapsed === 0,
    stepsCompletionRatio: progress.stepsCompletionRatio,
    gamesCompletionRatio: progress.gamesCompletionRatio,
    studentPointsTotal: progress.studentPointsTotal
  });
  if (!DRY) {
    const { error } = await supabase.from("scores").upsert({
      submission_id: submissionId, points_total: score.pointsTotal,
      breakdown_json: score.breakdown, calculated_at: new Date().toISOString()
    }, { onConflict: "submission_id" });
    if (error) throw new Error(`upsert scores fallo: ${error.message}`);
  }
  return { ...score, expectedParticipants, participants: data.participants_count };
}

async function main() {
  console.log(`Modo: ${DRY ? "DRY (solo lectura)" : "ESCRITURA"} | escuela ${SCHOOL_ID}`);
  const { data, error } = await supabase.from("submissions")
    .select("id, group_id, groups!inner(name, school_id)")
    .eq("groups.school_id", SCHOOL_ID)
    .in("status", ["submitted", "approved"]);
  if (error) { console.error("Error seleccionando submissions:", error.message); process.exit(1); }
  const rows = data ?? [];
  console.log(`Entregas a recalcular: ${rows.length}\n`);
  for (const r of rows) {
    const name = pickOne(r.groups)?.name ?? r.group_id;
    try {
      const s = await recalc(r.id);
      console.log(`${name}: ${s.pointsTotal} pts (base ${s.breakdown.basePoints} + stud ${s.breakdown.studentPoints}) | part ${s.breakdown.participation} (exp ${s.expectedParticipants}, reales ${s.participants}) | factor ${s.breakdown.timeFactor} (d${s.breakdown.daysElapsed})`);
    } catch (e) {
      console.error(`${name}: ERROR -> ${e.message}`);
    }
  }
  console.log(`\n${DRY ? "Nada escrito (DRY)." : "Scores actualizados."}`);
}
main();
