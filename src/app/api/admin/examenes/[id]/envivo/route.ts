import { exigirAdmin } from "@/lib/auth";
import { examenOError, type Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { finalizarVencidas } from "@/lib/entregas";
import { json, manejar, uuid } from "@/lib/http";

// Salidas de la ventana más cortas que esto se consideran ruido (notificaciones).
const SALIDA_CORTA_MS = 2000;

export const GET = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const e = await examenOError(id);
  if (e.estado === "publicado") await finalizarVencidas(id);
  const sql = db();
  const alumnos = await sql`
    select a.id, al.lu, al.nombre, t.numero as tema, a.parte, a.sin_seb, a.estado, a.carrera,
           a.iniciado_en, a.vence_en, a.entregado_en, a.entrega_tipo,
           exists (select 1 from sesiones s where s.asignacion_id = a.id and s.revocada_en is null) as sesion_activa,
           ev.pegados_externos, ev.caracteres_pegados, ev.salidas, ev.segundos_fuera, ev.salidas_cortas,
           ev.inserciones, ev.salidas_pantalla, ev.ingresos,
           m.estado as mail_estado
    from asignaciones a
    join alumnos al on al.id = a.alumno_id
    join temas t on t.id = a.tema_id
    left join envios_mail m on m.asignacion_id = a.id
    left join lateral (
      select
        count(*) filter (where tipo = 'pegado' and detalle->>'origen' = 'externo')::int as pegados_externos,
        coalesce(sum((detalle->>'caracteres')::int) filter (where tipo = 'pegado' and detalle->>'origen' = 'externo'), 0)::int as caracteres_pegados,
        count(*) filter (where tipo = 'salida' and (detalle->>'duracionMs')::int >= ${SALIDA_CORTA_MS})::int as salidas,
        coalesce(sum((detalle->>'duracionMs')::int) filter (where tipo = 'salida' and (detalle->>'duracionMs')::int >= ${SALIDA_CORTA_MS}), 0)::int / 1000 as segundos_fuera,
        count(*) filter (where tipo = 'salida' and (detalle->>'duracionMs')::int < ${SALIDA_CORTA_MS})::int as salidas_cortas,
        count(*) filter (where tipo = 'insercion_sin_tecleo')::int as inserciones,
        count(*) filter (where tipo = 'pantalla_completa_salida')::int as salidas_pantalla,
        count(*) filter (where tipo in ('ingreso', 'reingreso'))::int as ingresos
      from eventos where asignacion_id = a.id
    ) ev on true
    where a.examen_id = ${id}
    order by al.nombre`;
  const reingresos = await sql`
    select s.id, s.creada_en, al.nombre, al.lu, a.estado
    from solicitudes_reingreso s
    join asignaciones a on a.id = s.asignacion_id
    join alumnos al on al.id = a.alumno_id
    where a.examen_id = ${id} and s.estado = 'pendiente'
    order by s.creada_en`;
  const [ex] = await sql`select estado, ingreso_hasta, codigo_ingreso from examenes where id = ${id}`;
  return json({ examen: ex, servidorAhora: new Date().toISOString(), alumnos, reingresos });
});
