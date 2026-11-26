import { exigirAdmin } from "@/lib/auth";
import type { Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { consignasDe } from "@/lib/entregas";
import { formatearCodigo } from "@/lib/hashEntrega";
import { ApiError, json, leerJson, manejar, numero, texto, uuid } from "@/lib/http";

export const GET = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const sql = db();
  const [a] = await sql`
    select a.id, a.examen_id, a.tema_id, a.parte, a.sin_seb, a.carrera, a.estado, a.iniciado_en, a.vence_en,
           a.entregado_en, a.entrega_tipo, a.hash_entrega, a.nota_final::float as nota_final, a.observaciones,
           al.lu, al.nombre, al.mail, t.numero as tema, t.titulo as tema_titulo,
           m.estado as mail_estado, m.ultimo_error as mail_error, m.intentos as mail_intentos
    from asignaciones a join alumnos al on al.id = a.alumno_id join temas t on t.id = a.tema_id
    left join envios_mail m on m.asignacion_id = a.id
    where a.id = ${id}`;
  if (!a) throw new ApiError(404, "Asignación inexistente.");
  const consignas = await consignasDe(sql, a.tema_id, a.parte);
  const respuestas = await sql`select consigna_id, html, actualizado_en from respuestas where asignacion_id = ${id}`;
  const eventos = await sql`
    select e.id, e.tipo, e.detalle, e.cliente_ts, e.creado_en, c.orden as consigna_orden
    from eventos e left join consignas c on c.id = e.consigna_id
    where e.asignacion_id = ${id} order by e.creado_en`;
  return json({
    ...a,
    codigo: a.hash_entrega ? formatearCodigo(a.hash_entrega) : null,
    consignas: consignas.map((c) => {
      const r = respuestas.find((x) => x.consigna_id === c.id);
      return { id: c.id, orden: c.orden, titulo: c.titulo, parte: c.parte, puntaje: Number(c.puntaje), html: r?.html ?? "", actualizadoEn: r?.actualizado_en ?? null };
    }),
    eventos,
  });
});

// Edición desde el panel: datos del alumno, tema/parte/SEB (solo si no empezó), nota final.
export const PUT = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const b = await leerJson(req);
  const sql = db();
  const [a] = await sql`select a.id, a.estado, a.examen_id, a.alumno_id from asignaciones a where a.id = ${id}`;
  if (!a) throw new ApiError(404, "Asignación inexistente.");
  await sql.begin(async (tx) => {
    if (b.nombre !== undefined || b.mail !== undefined) {
      const mail = texto(b.mail, "mail", { max: 200 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ApiError(400, "Mail inválido.");
      await tx`update alumnos set nombre = ${texto(b.nombre, "nombre", { max: 200 })}, mail = ${mail} where id = ${a.alumno_id}`;
    }
    if (b.tema !== undefined || b.parte !== undefined || b.sinSeb !== undefined) {
      if (b.tema !== undefined && a.estado !== "pendiente") throw new ApiError(409, "No se puede cambiar el tema: el alumno ya empezó.");
      if (b.tema !== undefined) {
        const [t] = await tx`select id from temas where examen_id = ${a.examen_id} and numero = ${numero(b.tema, "tema", { min: 1 })}`;
        if (!t) throw new ApiError(400, "Ese tema no existe.");
        const parte = texto(b.parte, "parte", { max: 10, requerido: false }).toUpperCase() || null;
        await tx`update asignaciones set tema_id = ${t.id}, parte = ${parte} where id = ${id}`;
      }
      if (b.sinSeb !== undefined) await tx`update asignaciones set sin_seb = ${b.sinSeb === true} where id = ${id}`;
      if (b.sinSeb !== undefined) {
        await tx`insert into eventos (asignacion_id, tipo, detalle) values (${id}, 'docente_sin_seb', ${tx.json({ sinSeb: b.sinSeb === true })})`;
      }
    }
    if (b.notaFinal !== undefined) {
      const nota = b.notaFinal === null || b.notaFinal === "" ? null : numero(b.notaFinal, "nota final", { min: 0, max: 100 });
      await tx`update asignaciones set nota_final = ${nota} where id = ${id}`;
    }
    if (b.observaciones !== undefined) {
      await tx`update asignaciones set observaciones = ${texto(b.observaciones, "observaciones", { max: 5_000, requerido: false })} where id = ${id}`;
    }
  });
  return json({ ok: true });
});

export const DELETE = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const sql = db();
  const [a] = await sql`select estado from asignaciones where id = ${id}`;
  if (!a) throw new ApiError(404, "Asignación inexistente.");
  if (a.estado !== "pendiente") throw new ApiError(409, "No se puede quitar: el alumno ya empezó el examen.");
  await sql`delete from asignaciones where id = ${id}`;
  return json({ ok: true });
});
