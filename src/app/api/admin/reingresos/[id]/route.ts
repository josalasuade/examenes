import { exigirAdmin } from "@/lib/auth";
import type { Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar, uuid } from "@/lib/http";

export const POST = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const aprobar = (await leerJson(req)).aprobar === true;
  const sql = db();
  const [s] = await sql`
    update solicitudes_reingreso set estado = ${aprobar ? "aprobada" : "rechazada"}, resuelta_en = now()
    where id = ${id} and estado = 'pendiente' returning asignacion_id`;
  if (!s) throw new ApiError(409, "La solicitud ya no está pendiente.");
  await sql`insert into eventos (asignacion_id, tipo) values (${s.asignacion_id}, ${aprobar ? "docente_aprobo_reingreso" : "docente_rechazo_reingreso"})`;
  return json({ ok: true });
});
