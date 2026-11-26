import { exigirAdmin } from "@/lib/auth";
import { examenOError, type Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { finalizarEntrega, reintentarMails } from "@/lib/entregas";
import { ApiError, json, leerJson, manejar, numero, uuid } from "@/lib/http";

export const POST = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const e = await examenOError(id);
  const b = await leerJson(req);
  const sql = db();

  switch (b.accion) {
    case "publicar": {
      if (e.estado !== "borrador") throw new ApiError(409, "El examen no está en borrador.");
      const errores: string[] = [];
      const avisos: string[] = [];
      if (!e.codigo_ingreso) errores.push("Falta el código de ingreso.");
      if (e.requiere_seb && !e.seb_config_key) errores.push("Falta la Config Key de SEB (o desactivá 'Requiere SEB').");
      if (e.codigo_ingreso) {
        const [otro] = await sql`select id from examenes where estado = 'publicado' and upper(codigo_ingreso) = ${e.codigo_ingreso} and id <> ${id}`;
        if (otro) errores.push("Otro examen publicado usa el mismo código de ingreso.");
      }
      const temas = await sql`
        select t.numero, t.caso_html,
               (select count(*)::int from consignas c where c.tema_id = t.id) as consignas
        from temas t where t.examen_id = ${id} order by t.numero`;
      if (!temas.length) errores.push("El examen no tiene temas.");
      for (const t of temas) {
        if (!t.caso_html.trim()) errores.push(`El tema ${t.numero} no tiene caso.`);
        if (!t.consignas) errores.push(`El tema ${t.numero} no tiene consignas.`);
      }
      const totales = await sql`
        select t.numero, coalesce(c.parte, '') as parte, sum(c.puntaje)::float as total
        from consignas c join temas t on t.id = c.tema_id where t.examen_id = ${id}
        group by t.numero, c.parte order by t.numero, parte`;
      const porTema = new Map<number, { parte: string; total: number }[]>();
      for (const f of totales) porTema.set(f.numero, [...(porTema.get(f.numero) ?? []), { parte: f.parte, total: f.total }]);
      for (const [numero, partes] of porTema) {
        const comun = partes.find((p) => p.parte === "")?.total ?? 0;
        const conParte = partes.filter((p) => p.parte !== "");
        const sumas = conParte.length ? conParte.map((p) => ({ n: `parte ${p.parte}`, t: p.total + comun })) : [{ n: "", t: comun }];
        for (const s of sumas) if (Math.abs(s.t - 100) > 0.001) avisos.push(`Tema ${numero}${s.n ? ` ${s.n}` : ""}: el puntaje total es ${s.t}, no 100.`);
      }
      const [{ sin }] = await sql`select count(*)::int as sin from asignaciones where examen_id = ${id}`;
      if (!sin) avisos.push("Todavía no hay alumnos cargados.");
      if (errores.length) throw new ApiError(400, errores.join(" "));
      await sql`update examenes set estado = 'publicado' where id = ${id}`;
      return json({ ok: true, avisos });
    }
    case "volver_borrador": {
      if (e.estado !== "publicado") throw new ApiError(409, "Solo se puede volver a borrador un examen publicado.");
      const [{ n }] = await sql`select count(*)::int as n from asignaciones where examen_id = ${id} and estado <> 'pendiente'`;
      if (n) throw new ApiError(409, "No se puede: hay alumnos que ya empezaron.");
      await sql`update examenes set estado = 'borrador', ingreso_hasta = null where id = ${id}`;
      return json({ ok: true });
    }
    case "abrir_ingreso": {
      if (e.estado !== "publicado") throw new ApiError(409, "Publicá el examen antes de abrir el ingreso.");
      const minutos = numero(b.minutos, "minutos", { min: 1, max: 240 });
      await sql`update examenes set ingreso_hasta = now() + make_interval(mins => ${minutos}) where id = ${id}`;
      return json({ ok: true });
    }
    case "cerrar_ingreso": {
      await sql`update examenes set ingreso_hasta = null where id = ${id}`;
      return json({ ok: true });
    }
    case "cerrar": {
      if (e.estado !== "publicado") throw new ApiError(409, "El examen no está publicado.");
      const enCurso = await sql`select id from asignaciones where examen_id = ${id} and estado = 'en_curso'`;
      for (const a of enCurso) await finalizarEntrega(a.id, "docente");
      await sql`update examenes set estado = 'cerrado', ingreso_hasta = null where id = ${id}`;
      return json({ ok: true, entregadosPorCierre: enCurso.length });
    }
    case "reintentar_mails":
      return json({ ok: true, ...(await reintentarMails(id)) });
    default:
      throw new ApiError(400, "Acción desconocida.");
  }
});
