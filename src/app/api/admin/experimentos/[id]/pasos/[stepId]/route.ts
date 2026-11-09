import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const updateSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(2).max(300).optional(),
  points: z.coerce.number().int().min(0).max(100).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    await requireAdmin();
    const { id, stepId } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.points !== undefined) updates.points = parsed.data.points;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("experiment_steps")
      .update(updates)
      .eq("id", stepId)
      .eq("experiment_id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    await requireAdmin();
    const { id, stepId } = await params;
    const confirmed = new URL(request.url).searchParams.get("confirm") === "1";
    const supabase = createServerSupabase();

    const { count: total, error: totalError } = await supabase
      .from("experiment_steps")
      .select("id", { count: "exact", head: true })
      .eq("experiment_id", id);
    if (totalError) throw totalError;

    if ((total ?? 0) <= 1) {
      return NextResponse.json(
        { error: "El experimento debe tener al menos 1 paso" },
        { status: 400 }
      );
    }

    // Borrar un paso borra (cascade) el progreso de los alumnos y baja su puntaje.
    const { count: completed, error: countError } = await supabase
      .from("student_step_progress")
      .select("id", { count: "exact", head: true })
      .eq("step_id", stepId);
    if (countError) throw countError;

    if ((completed ?? 0) > 0 && !confirmed) {
      return NextResponse.json(
        {
          error: `${completed} alumno(s) ya completaron este paso; confirma para borrarlo`,
          requiresConfirm: true,
          completedCount: completed
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("experiment_steps")
      .delete()
      .eq("id", stepId)
      .eq("experiment_id", id);
    if (error) throw error;

    // Compactar el orden a 1..n con los pasos restantes.
    const { data: remaining, error: remainingError } = await supabase
      .from("experiment_steps")
      .select("id")
      .eq("experiment_id", id)
      .order("step_order", { ascending: true });
    if (remainingError) throw remainingError;

    if ((remaining ?? []).length > 0) {
      const { error: reorderError } = await supabase.rpc("reorder_experiment_steps", {
        p_experiment_id: id,
        p_step_ids: (remaining ?? []).map((r) => r.id)
      });
      if (reorderError) throw reorderError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
