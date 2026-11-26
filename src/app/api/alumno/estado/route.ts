import { exigirAlumno } from "@/lib/auth";
import { db } from "@/lib/db";
import { consignasDe, finalizarEntrega } from "@/lib/entregas";
import { formatearCodigo } from "@/lib/hashEntrega";
import { json, manejar } from "@/lib/http";

export const GET = manejar(async (req: Request) => {
  let ctx = await exigirAlumno(req, { permitirEntregado: true });
  const a = ctx.asignacion;
  if (a.estado === "en_curso" && a.vence_en && a.vence_en.getTime() < Date.now()) {
    await finalizarEntrega(a.id, "vencimiento");
    ctx = await exigirAlumno(req, { permitirEntregado: true });
  }
  const sql = db();
  const base = {
    alumno: { nombre: ctx.alumno.nombre, lu: ctx.alumno.lu },
    examen: {
      materia: ctx.examen.materia, docente: ctx.examen.docente, instancia: ctx.examen.instancia,
      fecha: ctx.examen.fecha, duracionMin: ctx.examen.duracion_min, consignasGenerales: ctx.examen.consignas_generales,
    },
    estado: ctx.asignacion.estado,
    carrera: ctx.asignacion.carrera,
    sinSeb: ctx.asignacion.sin_seb,
    servidorAhora: new Date().toISOString(),
  };

  if (ctx.asignacion.estado === "pendiente") {
    const carreras = await sql`select nombre from carreras where activa order by nombre`;
    return json({ ...base, carreras: carreras.map((c) => c.nombre) });
  }

  if (ctx.asignacion.estado === "entregado") {
    return json({
      ...base,
      entrega: { entregadoEn: ctx.asignacion.entregado_en, codigo: formatearCodigo(ctx.asignacion.hash_entrega ?? "") },
    });
  }

  const [tema] = await sql`select numero, titulo, caso_html from temas where id = ${ctx.asignacion.tema_id}`;
  const consignas = await consignasDe(sql, ctx.asignacion.tema_id, ctx.asignacion.parte);
  const respuestas = await sql`select consigna_id, html, actualizado_en from respuestas where asignacion_id = ${ctx.asignacion.id}`;
  return json({
    ...base,
    venceEn: ctx.asignacion.vence_en,
    iniciadoEn: ctx.asignacion.iniciado_en,
    tema: { numero: tema.numero, titulo: tema.titulo, casoHtml: tema.caso_html },
    consignas: consignas.map((c) => ({
      id: c.id, orden: c.orden, titulo: c.titulo, parte: c.parte, puntaje: Number(c.puntaje), enunciadoHtml: c.enunciado_html,
    })),
    respuestas: Object.fromEntries(respuestas.map((r) => [r.consigna_id, r.html])),
  });
});
