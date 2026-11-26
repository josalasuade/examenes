import { cookieAlumno, exigirMismoOrigen, exigirSebSiCorresponde } from "@/lib/auth";
import { sha256Hex, tokenAleatorio } from "@/lib/cripto";
import { db } from "@/lib/db";
import { finalizarVencidas } from "@/lib/entregas";
import { ApiError, json, leerJson, manejar, texto } from "@/lib/http";

// Ingreso del alumno con código del examen + LU.
// * Primer ingreso: solo dentro de la ventana de ingreso que abre el docente.
// * Si ya tuvo una sesión (cuelgue, otro equipo, alguien usó su LU): se crea una
//   solicitud de reingreso que el docente aprueba o rechaza desde el panel.
export const POST = manejar(async (req: Request) => {
  exigirMismoOrigen(req);
  const body = await leerJson(req, 10_000);
  const codigo = texto(body.codigo, "código", { max: 50 }).toUpperCase();
  const lu = texto(body.lu, "LU", { max: 30 }).replace(/\.0+$/, "");
  const sql = db();

  const [cand] = await sql`
    select a.id, a.estado, a.sin_seb, a.vence_en, e.id as examen_id, e.requiere_seb, e.seb_config_key
    from asignaciones a
    join alumnos al on al.id = a.alumno_id
    join examenes e on e.id = a.examen_id
    where al.lu = ${lu} and e.estado = 'publicado' and upper(e.codigo_ingreso) = ${codigo} and e.codigo_ingreso <> ''`;
  if (!cand) throw new ApiError(401, "Código o LU incorrectos, o no estás asignado a este examen.");

  exigirSebSiCorresponde(req, cand as never, cand.sin_seb);

  if (cand.estado === "en_curso") await finalizarVencidas(cand.examen_id);

  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300);
  const resultado = await sql.begin(async (tx) => {
    const [a] = await tx`
      select a.id, a.estado, e.ingreso_hasta
      from asignaciones a join examenes e on e.id = a.examen_id
      where a.id = ${cand.id} for update of a`;
    if (a.estado === "entregado") throw new ApiError(409, "Ya entregaste este examen.", "entregado");

    const [{ sesiones }] = await tx`select count(*)::int as sesiones from sesiones where asignacion_id = ${a.id}`;
    if (a.estado === "pendiente" && sesiones === 0) {
      if (!a.ingreso_hasta || new Date(a.ingreso_hasta) < new Date()) {
        throw new ApiError(403, "El ingreso no está habilitado en este momento. Esperá la indicación del docente.", "ingreso_cerrado");
      }
      const token = tokenAleatorio();
      await tx`insert into sesiones (asignacion_id, token_hash, user_agent) values (${a.id}, ${sha256Hex(token)}, ${userAgent})`;
      await tx`insert into eventos (asignacion_id, tipo, detalle) values (${a.id}, 'ingreso', ${tx.json({ user_agent: userAgent })})`;
      return { tipo: "ok" as const, token };
    }

    // Reingreso: requiere aprobación del docente.
    await tx`update solicitudes_reingreso set estado = 'rechazada', resuelta_en = now()
             where asignacion_id = ${a.id} and estado = 'pendiente'`;
    const secreto = tokenAleatorio();
    const [s] = await tx`
      insert into solicitudes_reingreso (asignacion_id, secreto_hash)
      values (${a.id}, ${sha256Hex(secreto)}) returning id`;
    await tx`insert into eventos (asignacion_id, tipo, detalle) values (${a.id}, 'reingreso_solicitado', ${tx.json({ user_agent: userAgent })})`;
    return { tipo: "reingreso" as const, solicitudId: s.id as string, secreto };
  });

  if (resultado.tipo === "ok") {
    return json({ estado: "ok" }, { headers: { "Set-Cookie": cookieAlumno(resultado.token) } });
  }
  return json({ estado: "reingreso", solicitudId: resultado.solicitudId, secreto: resultado.secreto });
});
