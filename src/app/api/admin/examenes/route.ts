import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ESCALA_DEFECTO } from "@/lib/escala";
import { ApiError, json, leerJson, manejar, numero, texto } from "@/lib/http";
import { CONDICIONES_DEFECTO, CONSIGNAS_GENERALES_DEFECTO } from "@/lib/textos";

export const GET = manejar(async (req: Request) => {
  exigirAdmin(req);
  const filas = await db()`
    select e.id, e.materia, e.instancia, to_char(e.fecha, 'YYYY-MM-DD') as fecha, e.estado, e.duracion_min,
           (select count(*)::int from temas t where t.examen_id = e.id) as temas,
           (select count(*)::int from asignaciones a where a.examen_id = e.id) as alumnos,
           (select count(*)::int from asignaciones a where a.examen_id = e.id and a.estado = 'entregado') as entregados
    from examenes e order by e.fecha desc, e.creado_en desc`;
  return json(filas);
});

export const POST = manejar(async (req: Request) => {
  exigirAdmin(req);
  const b = await leerJson(req);
  const fecha = texto(b.fecha, "fecha", { max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ApiError(400, "Fecha inválida.");
  const sql = db();
  const [e] = await sql`
    insert into examenes (materia, docente, instancia, fecha, duracion_min, consignas_generales, condiciones_aprobacion, escala)
    values (${texto(b.materia, "materia", { max: 200 })}, ${texto(b.docente, "docente", { max: 200 })},
            ${texto(b.instancia, "instancia", { max: 200 })}, ${fecha},
            ${numero(b.duracionMin ?? 120, "duración", { min: 1, max: 600 })},
            ${CONSIGNAS_GENERALES_DEFECTO}, ${CONDICIONES_DEFECTO}, ${sql.json(ESCALA_DEFECTO)})
    returning id`;
  return json({ id: e.id });
});
