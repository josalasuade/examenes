import { exigirAlumno } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar, texto } from "@/lib/http";

// Empieza el examen: a partir de acá corre el tiempo (se muestra el caso).
export const POST = manejar(async (req: Request) => {
  const ctx = await exigirAlumno(req);
  const carrera = texto((await leerJson(req, 5_000)).carrera, "carrera", { max: 200 });
  const sql = db();
  const activas = await sql`select nombre from carreras where activa`;
  if (activas.length && !activas.some((c) => c.nombre === carrera)) throw new ApiError(400, "Elegí una carrera de la lista.");
  const [a] = await sql`
    update asignaciones
    set carrera = ${carrera}, estado = 'en_curso', iniciado_en = now(),
        vence_en = now() + make_interval(mins => ${ctx.examen.duracion_min})
    where id = ${ctx.asignacion.id} and estado = 'pendiente'
    returning id`;
  if (a) {
    await sql`insert into eventos (asignacion_id, tipo, detalle) values (${a.id}, 'inicio', ${sql.json({ carrera })})`;
  }
  return json({ ok: true });
});
