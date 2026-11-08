import { NextResponse } from "next/server";
import { jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { recalcAllScoresForSchool } from "@/lib/services/scoring-service";

/**
 * Recalcula el puntaje e insignias de todas las entregas de grupo de la
 * escuela del admin. Pensado para refrescar datos ya cargados tras ajustes en
 * la logica de puntaje, sin reaprobar evidencia por evidencia.
 */
export async function POST() {
  try {
    const session = await requireAdminWithSchool();
    const recalculated = await recalcAllScoresForSchool(session.schoolId);
    return NextResponse.json({ ok: true, recalculated });
  } catch (error) {
    return jsonError(error);
  }
}
