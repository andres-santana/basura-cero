import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const MAX_STEPS = 6;

const createSchema = z.object({
  title: z.string().trim().min(2, "El titulo del paso es obligatorio").max(80),
  description: z.string().trim().min(2, "La descripcion del paso es obligatoria").max(300),
  points: z.coerce.number().int().min(0).max(100).default(5)
});

const reorderSchema = z.object({
  stepIds: z.array(z.string().uuid()).min(1).max(MAX_STEPS)
});

type StepRow = {
  id: string;
  step_order: number;
  title: string;
  description: string;
  points: number;
};

function toStep(row: StepRow, completedCount = 0) {
  return {
    id: row.id,
    order: row.step_order,
    title: row.title,
    description: row.description,
    points: row.points,
    completedCount
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("experiment_steps")
      .select("id, step_order, title, description, points")
      .eq("experiment_id", id)
      .order("step_order", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as StepRow[];

    // Cuantos alumnos marcaron cada paso (para avisar antes de borrar).
    const counts = new Map<string, number>();
    if (rows.length > 0) {
      const { data: progress, error: progressError } = await supabase
        .from("student_step_progress")
        .select("step_id")
        .in(
          "step_id",
          rows.map((r) => r.id)
        );
      if (progressError) throw progressError;
      for (const p of progress ?? []) {
        counts.set(p.step_id, (counts.get(p.step_id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      data: rows.map((r) => toStep(r, counts.get(r.id) ?? 0)),
      maxSteps: MAX_STEPS
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: existing, error: existingError } = await supabase
      .from("experiment_steps")
      .select("step_order")
      .eq("experiment_id", id)
      .order("step_order", { ascending: false });
    if (existingError) throw existingError;

    if ((existing ?? []).length >= MAX_STEPS) {
      return NextResponse.json(
        { error: `Un experimento puede tener maximo ${MAX_STEPS} pasos` },
        { status: 400 }
      );
    }

    const nextOrder = (existing?.[0]?.step_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("experiment_steps")
      .insert({
        experiment_id: id,
        step_order: nextOrder,
        title: parsed.data.title,
        description: parsed.data.description,
        points: parsed.data.points
      })
      .select("id, step_order, title, description, points")
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Conflicto al asignar el orden, intenta de nuevo" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, data: toStep(data as StepRow) });
  } catch (error) {
    return jsonError(error);
  }
}

// Reordenar: recibe los ids en el orden deseado.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = reorderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { error } = await supabase.rpc("reorder_experiment_steps", {
      p_experiment_id: id,
      p_step_ids: parsed.data.stepIds
    });
    if (error) {
      if (error.code === "22023") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
