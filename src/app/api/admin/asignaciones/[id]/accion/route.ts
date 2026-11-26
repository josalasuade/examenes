import { exigirAdmin } from "@/lib/auth";
import type { Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { enviarMailEntrega, finalizarEntrega } from "@/lib/entregas";
import { ApiError, json, leerJson, manejar, uuid } from "@/lib/http";

export const POST = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const { accion } = await leerJson(req);
  const sql = db();
  const [a] = await sql`select estado from asignaciones where id = ${id}`;
  if (!a) throw new ApiError(404, "Asignación inexistente.");

  switch (accion) {
    case "forzar_entrega":
      if (a.estado !== "en_curso") throw new ApiError(409, "El alumno no está rindiendo.");
      await finalizarEntrega(id, "docente");
      return json({ ok: true });
    case "revocar_sesion":
      await sql`update sesiones set revocada_en = now() where asignacion_id = ${id} and revocada_en is null`;
      await sql`insert into eventos (asignacion_id, tipo) values (${id}, 'docente_revoco_sesion')`;
      return json({ ok: true });
    case "reiniciar":
      // Para cuando alguien ingresó con el LU de otro: vuelve a "pendiente" sin respuestas.
      if (a.estado === "entregado") throw new ApiError(409, "No se puede reiniciar un examen entregado.");
      await sql.begin(async (tx) => {
        await tx`update sesiones set revocada_en = now() where asignacion_id = ${id} and revocada_en is null`;
        await tx`delete from sesiones where asignacion_id = ${id}`;
        await tx`delete from respuestas where asignacion_id = ${id}`;
        await tx`update solicitudes_reingreso set estado = 'rechazada', resuelta_en = now() where asignacion_id = ${id} and estado = 'pendiente'`;
        await tx`update asignaciones set estado = 'pendiente', iniciado_en = null, vence_en = null, carrera = null where id = ${id}`;
        await tx`insert into eventos (asignacion_id, tipo) values (${id}, 'docente_reinicio')`;
      });
      return json({ ok: true });
    case "reenviar_mail":
      if (a.estado !== "entregado") throw new ApiError(409, "El alumno todavía no entregó.");
      try {
        await enviarMailEntrega(id);
      } catch (e) {
        throw new ApiError(502, `No se pudo enviar el mail: ${(e as Error).message}`);
      }
      return json({ ok: true });
    default:
      throw new ApiError(400, "Acción desconocida.");
  }
});
