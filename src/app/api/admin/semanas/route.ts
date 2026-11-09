import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const createSchema = z.object({
  experimentId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activateNow: z.boolean().optional()
});

export async function GET() {
  try {
    const session = await requireAdminWithSchool();
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("weekly_challenges")
      .select(
        "id, start_date, end_date, is_current, experiment_id, experiments(week_number, title, objective)"
      )
      .eq("school_id", session.schoolId)
      .order("start_date", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((c) => {
        const exp = Array.isArray(c.experiments) ? c.experiments[0] : c.experiments;
        return {
          id: c.id,
          startDate: c.start_date,
          endDate: c.end_date,
          isCurrent: c.is_current,
          experimentId: c.experiment_id,
          weekNumber: exp?.week_number ?? null,
          title: exp?.title ?? null,
          objective: exp?.objective ?? null
        };
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminWithSchool();
    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    if (parsed.data.endDate < parsed.data.startDate) {
      return NextResponse.json(
        { error: "La fecha fin no puede ser anterior a la de inicio" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: exp, error: expErr } = await supabase
      .from("experiments")
      .select("id, status")
      .eq("id", parsed.data.experimentId)
      .maybeSingle();
    if (expErr) throw expErr;
    if (!exp) {
      return NextResponse.json({ error: "Experimento no existe" }, { status: 400 });
    }

    // Cada experimento debe usarse una sola vez por escuela: evita retos/semanas
    // duplicados que dupliquen la puntuacion en el ranking.
    const { data: existing, error: existingErr } = await supabase
      .from("weekly_challenges")
      .select("id")
      .eq("school_id", session.schoolId)
      .eq("experiment_id", parsed.data.experimentId)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) {
      return NextResponse.json(
        { error: "Este experimento ya tiene una semana programada en tu escuela" },
        { status: 409 }
      );
    }

    if (parsed.data.activateNow) {
      const { error: clearError } = await supabase
        .from("weekly_challenges")
        .update({ is_current: false })
        .eq("school_id", session.schoolId)
        .eq("is_current", true);
      if (clearError) throw clearError;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("weekly_challenges")
      .insert({
        school_id: session.schoolId,
        experiment_id: parsed.data.experimentId,
        start_date: parsed.data.startDate,
        end_date: parsed.data.endDate,
        is_current: parsed.data.activateNow ?? false
      })
      .select("id")
      .single();
    if (insertError) {
      // Red de seguridad ante una condicion de carrera: el indice unico
      // (school_id, experiment_id) puede disparar 23505 aunque la verificacion
      // previa haya pasado.
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "Este experimento ya tiene una semana programada en tu escuela" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (error) {
    return jsonError(error);
  }
}
