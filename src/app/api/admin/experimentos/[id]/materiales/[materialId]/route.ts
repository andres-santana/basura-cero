import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const kindSchema = z.enum(["separado", "reutilizado", "reciclado"]);

const updateSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  unitLabel: z.string().trim().min(1).max(40).optional(),
  kgPerUnit: z.coerce.number().min(0).max(10000).optional(),
  kind: kindSchema.optional(),
  displayOrder: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    await requireAdmin();
    const { id, materialId } = await params;
    const json = await request.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.label !== undefined) updates.label = parsed.data.label;
    if (parsed.data.unitLabel !== undefined) updates.unit_label = parsed.data.unitLabel;
    if (parsed.data.kgPerUnit !== undefined) updates.kg_per_unit = parsed.data.kgPerUnit;
    if (parsed.data.kind !== undefined) updates.kind = parsed.data.kind;
    if (parsed.data.displayOrder !== undefined) {
      updates.display_order = parsed.data.displayOrder;
    }
    if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("experiment_materials")
      .update(updates)
      .eq("id", materialId)
      .eq("experiment_id", id);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un material con ese nombre en el experimento" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    await requireAdmin();
    const { id, materialId } = await params;
    const supabase = createServerSupabase();

    // Si el material ya tiene cantidades reportadas por alumnos, no se borra:
    // se desactiva para no perder el historico (on delete restrict en la FK).
    const { count, error: countError } = await supabase
      .from("student_submission_materials")
      .select("id", { count: "exact", head: true })
      .eq("material_id", materialId);
    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      const { error: deactivateError } = await supabase
        .from("experiment_materials")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", materialId)
        .eq("experiment_id", id);
      if (deactivateError) throw deactivateError;
      return NextResponse.json({ ok: true, deactivated: true });
    }

    const { error } = await supabase
      .from("experiment_materials")
      .delete()
      .eq("id", materialId)
      .eq("experiment_id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, deactivated: false });
  } catch (error) {
    return jsonError(error);
  }
}
