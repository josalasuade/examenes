import { exigirAlumno } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizarEntrega } from "@/lib/entregas";
import { formatearCodigo } from "@/lib/hashEntrega";
import { ApiError, json, leerJson, manejar } from "@/lib/http";

// Entrega definitiva: después de esto no se puede editar.
export const POST = manejar(async (req: Request) => {
  const ctx = await exigirAlumno(req);
  if (ctx.asignacion.estado !== "en_curso") throw new ApiError(409, "El examen no está en curso.");
  if ((await leerJson(req, 1_000)).confirmar !== true) throw new ApiError(400, "Falta confirmar la entrega.");
  await finalizarEntrega(ctx.asignacion.id, "alumno");
  const [a] = await db()`select entregado_en, hash_entrega from asignaciones where id = ${ctx.asignacion.id}`;
  return json({ ok: true, entregadoEn: a.entregado_en, codigo: formatearCodigo(a.hash_entrega) });
});
