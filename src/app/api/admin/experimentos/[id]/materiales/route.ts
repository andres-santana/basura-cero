import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const kindSchema = z.enum(["separado", "reutilizado", "reciclado"]);

const createSchema = z.object({
  label: z.string().trim().min(2, "El nombre del material es obligatorio").max(80),
  unitLabel: z.string().trim().min(1, "La unidad es obligatoria").max(40),
  kgPerUnit: z.coerce.number().min(0).max(10000),
  kind: kindSchema,
  displayOrder: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional()
});

type MaterialRow = {
  id: string;
  label: string;
  unit_label: string;
  kg_per_unit: number;
  kind: string;
  display_order: number;
  is_active: boolean;
};

function toMaterial(row: MaterialRow) {
  return {
    id: row.id,
    label: row.label,
    unitLabel: row.unit_label,
    kgPerUnit: Number(row.kg_per_unit),
    kind: row.kind,
    displayOrder: row.display_order,
    isActive: row.is_active
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
      .from("experiment_materials")
      .select("id, label, unit_label, kg_per_unit, kind, display_order, is_active")
      .eq("experiment_id", id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ data: (data ?? []).map((r) => toMaterial(r as MaterialRow)) });
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
    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Si no se indica orden, colocar al final.
    let displayOrder = parsed.data.displayOrder;
    if (displayOrder === undefined) {
      const { data: last } = await supabase
        .from("experiment_materials")
        .select("display_order")
        .eq("experiment_id", id)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      displayOrder = (last?.display_order ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from("experiment_materials")
      .insert({
        experiment_id: id,
        label: parsed.data.label,
        unit_label: parsed.data.unitLabel,
        kg_per_unit: parsed.data.kgPerUnit,
        kind: parsed.data.kind,
        display_order: displayOrder,
        is_active: parsed.data.isActive ?? true
      })
      .select("id, label, unit_label, kg_per_unit, kind, display_order, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un material con ese nombre en el experimento" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, data: toMaterial(data as MaterialRow) });
  } catch (error) {
    return jsonError(error);
  }
}
