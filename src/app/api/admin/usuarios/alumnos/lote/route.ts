import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildStoredHash,
  codePrefix,
  generateAccessCode
} from "@/lib/students/access-code";

const rowSchema = z.object({
  grupo: z.string().trim().min(1, "Grupo vacio"),
  alias: z.string().trim().min(2, "Alias muy corto").max(40, "Alias muy largo"),
  grado: z.string().trim().max(20).optional()
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1, "No hay filas").max(1000, "Demasiadas filas")
});

type RowResult = {
  grupo: string;
  alias: string;
  grado: string | null;
  status: "created" | "skipped" | "error";
  // Solo presente en status === "created": codigo en claro (se muestra una sola vez).
  code?: string;
  message?: string;
};

/**
 * Carga masiva de alumnos (admin). Recibe filas {grupo, alias, grado?},
 * resuelve el grupo por su nombre dentro de la escuela del admin, crea el
 * alumno y emite su primer codigo de acceso. Los alias ya existentes dentro
 * de un grupo se omiten (no abortan el lote). Devuelve los codigos en claro
 * para que el admin genere los PDFs imprimibles por grupo.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdminWithSchool();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Mapa nombre-de-grupo (normalizado) -> {id, name, grade} dentro de la escuela.
    const { data: groups, error: groupsError } = await supabase
      .from("groups")
      .select("id, name, grade")
      .eq("school_id", session.schoolId);
    if (groupsError) throw groupsError;

    const groupByName = new Map<string, { id: string; name: string; grade: string }>();
    for (const g of groups ?? []) {
      groupByName.set(normalizeGroupName(g.name), {
        id: g.id as string,
        name: g.name as string,
        grade: g.grade as string
      });
    }

    const results: RowResult[] = [];
    // Evita alias duplicados dentro del mismo lote (antes de tocar la BD).
    const seenInBatch = new Set<string>();

    for (const row of parsed.data.rows) {
      const grado = row.grado && row.grado.length > 0 ? row.grado : null;
      const group = groupByName.get(normalizeGroupName(row.grupo));

      if (!group) {
        results.push({
          grupo: row.grupo,
          alias: row.alias,
          grado,
          status: "error",
          message: `El grupo "${row.grupo}" no existe en tu escuela`
        });
        continue;
      }

      const batchKey = `${group.id}::${row.alias.toLowerCase()}`;
      if (seenInBatch.has(batchKey)) {
        results.push({
          grupo: group.name,
          alias: row.alias,
          grado,
          status: "skipped",
          message: "Alias repetido en el archivo"
        });
        continue;
      }
      seenInBatch.add(batchKey);

      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          school_id: session.schoolId,
          group_id: group.id,
          alias: row.alias,
          grade: grado
        })
        .select("id, alias, grade")
        .single();

      if (studentError) {
        // 23505 = alias duplicado dentro del grupo (unique (group_id, alias)).
        if (studentError.code === "23505") {
          results.push({
            grupo: group.name,
            alias: row.alias,
            grado,
            status: "skipped",
            message: "Ya existe un alumno con ese alias en el grupo"
          });
          continue;
        }
        results.push({
          grupo: group.name,
          alias: row.alias,
          grado,
          status: "error",
          message: studentError.message
        });
        continue;
      }

      // Emite el primer codigo de acceso (se muestra una sola vez).
      const code = generateAccessCode();
      const { error: codeError } = await supabase.from("student_access_codes").insert({
        student_id: student.id,
        code_hash: buildStoredHash(code),
        code_prefix: codePrefix(code),
        is_active: true
      });

      if (codeError) {
        results.push({
          grupo: group.name,
          alias: student.alias as string,
          grado,
          status: "error",
          message: `Alumno creado pero fallo el codigo: ${codeError.message}`
        });
        continue;
      }

      results.push({
        grupo: group.name,
        alias: student.alias as string,
        grado,
        status: "created",
        code
      });
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (error) {
    return jsonError(error);
  }
}

/** Normaliza el nombre de grupo para emparejar sin distinguir mayusculas/espacios. */
function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}
