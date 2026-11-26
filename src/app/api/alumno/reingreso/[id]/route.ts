import { cookieAlumno, exigirMismoOrigen, exigirSebSiCorresponde } from "@/lib/auth";
import { iguales, sha256Hex, tokenAleatorio } from "@/lib/cripto";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar, texto, uuid } from "@/lib/http";

// El alumno consulta (polling) si el docente aprobó su reingreso.
export const POST = manejar(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  exigirMismoOrigen(req);
  const id = uuid((await ctx.params).id);
  const secreto = texto((await leerJson(req, 5_000)).secreto, "secreto", { max: 200 });
  const sql = db();
  const [s] = await sql`
    select s.id, s.estado, s.secreto_hash, s.asignacion_id, a.sin_seb, e.requiere_seb, e.seb_config_key
    from solicitudes_reingreso s
    join asignaciones a on a.id = s.asignacion_id
    join examenes e on e.id = a.examen_id
    where s.id = ${id}`;
  if (!s || !iguales(s.secreto_hash, sha256Hex(secreto))) throw new ApiError(404, "Solicitud inexistente.");
  if (s.estado === "pendiente") return json({ estado: "pendiente" });
  if (s.estado === "rechazada") return json({ estado: "rechazada" });
  if (s.estado === "usada") throw new ApiError(410, "Esta solicitud ya fue utilizada.");

  exigirSebSiCorresponde(req, s as never, s.sin_seb);
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300);
  const token = tokenAleatorio();
  await sql.begin(async (tx) => {
    const [u] = await tx`update solicitudes_reingreso set estado = 'usada' where id = ${id} and estado = 'aprobada' returning id`;
    if (!u) throw new ApiError(410, "Esta solicitud ya fue utilizada.");
    await tx`update sesiones set revocada_en = now() where asignacion_id = ${s.asignacion_id} and revocada_en is null`;
    await tx`insert into sesiones (asignacion_id, token_hash, user_agent) values (${s.asignacion_id}, ${sha256Hex(token)}, ${userAgent})`;
    await tx`insert into eventos (asignacion_id, tipo, detalle) values (${s.asignacion_id}, 'reingreso', ${tx.json({ user_agent: userAgent })})`;
  });
  return json({ estado: "ok" }, { headers: { "Set-Cookie": cookieAlumno(token) } });
});
