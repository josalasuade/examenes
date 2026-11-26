import { exigirAdmin } from "@/lib/auth";
import { examenOError, exigirBorrador, type Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { validarEscala } from "@/lib/escala";
import { ApiError, json, leerJson, manejar, numero, texto, uuid } from "@/lib/http";

export const GET = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const sql = db();
  const [e] = await sql`
    select id, materia, docente, instancia, departamento, to_char(fecha, 'YYYY-MM-DD') as fecha, duracion_min,
           consignas_generales, condiciones_aprobacion, escala, codigo_ingreso, ingreso_hasta, estado,
           requiere_seb, seb_config_key
    from examenes where id = ${id}`;
  if (!e) throw new ApiError(404, "Examen inexistente.");
  const temas = await sql`select id, numero, titulo, caso_html from temas where examen_id = ${id} order by numero`;
  const consignas = await sql`
    select c.id, c.tema_id, c.orden, c.parte, c.titulo, c.enunciado_html, c.puntaje::float as puntaje, c.no_suma
    from consignas c join temas t on t.id = c.tema_id where t.examen_id = ${id} order by c.orden`;
  const criterios = await sql`
    select r.consigna_id, r.descripcion, r.puntaje::float as puntaje, r.completo, r.parcial, r.ausente
    from rubrica_criterios r join consignas c on c.id = r.consigna_id join temas t on t.id = c.tema_id
    where t.examen_id = ${id} order by r.orden`;
  return json({
    ...e,
    servidorAhora: new Date().toISOString(),
    temas: temas.map((t) => ({
      id: t.id, numero: t.numero, titulo: t.titulo, casoHtml: t.caso_html,
      consignas: consignas.filter((c) => c.tema_id === t.id).map((c) => ({
        id: c.id, titulo: c.titulo, parte: c.parte, puntaje: c.puntaje, enunciadoHtml: c.enunciado_html, noSuma: c.no_suma,
        criterios: criterios.filter((r) => r.consigna_id === c.id).map((r) => ({
          descripcion: r.descripcion, puntaje: r.puntaje, completo: r.completo, parcial: r.parcial, ausente: r.ausente,
        })),
      })),
    })),
  });
});

// Datos generales. Algunos campos (código, SEB) se pueden cambiar aunque esté publicado.
export const PUT = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const e = await examenOError(id);
  const b = await leerJson(req);
  const sql = db();
  const codigo = texto(b.codigoIngreso, "código de ingreso", { max: 50, requerido: false }).toUpperCase();
  const requiereSeb = b.requiereSeb !== false;
  const sebKey = texto(b.sebConfigKey, "Config Key", { max: 200, requerido: false }).toLowerCase();
  if (sebKey && !/^[0-9a-f]{64}$/.test(sebKey)) throw new ApiError(400, "La Config Key de SEB debe ser un hash de 64 caracteres hexadecimales.");

  if (e.estado === "borrador") {
    const fecha = texto(b.fecha, "fecha", { max: 10 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ApiError(400, "Fecha inválida.");
    let escala;
    try {
      escala = validarEscala(b.escala);
    } catch (err) {
      throw new ApiError(400, (err as Error).message);
    }
    await sql`
      update examenes set
        materia = ${texto(b.materia, "materia", { max: 200 })},
        docente = ${texto(b.docente, "docente", { max: 200 })},
        instancia = ${texto(b.instancia, "instancia", { max: 200 })},
        departamento = ${texto(b.departamento, "departamento", { max: 200 })},
        fecha = ${fecha},
        duracion_min = ${numero(b.duracionMin, "duración", { min: 1, max: 600 })},
        consignas_generales = ${texto(b.consignasGenerales, "consignas generales", { max: 10_000, requerido: false })},
        condiciones_aprobacion = ${texto(b.condicionesAprobacion, "condiciones", { max: 2_000, requerido: false })},
        escala = ${sql.json(escala)},
        codigo_ingreso = ${codigo}, requiere_seb = ${requiereSeb}, seb_config_key = ${sebKey}
      where id = ${id}`;
  } else {
    if (e.estado === "cerrado") throw new ApiError(409, "El examen está cerrado.");
    if (!codigo) throw new ApiError(400, "El código de ingreso es obligatorio en un examen publicado.");
    if (requiereSeb && !sebKey) throw new ApiError(400, "Falta la Config Key de SEB.");
    await sql`update examenes set codigo_ingreso = ${codigo}, requiere_seb = ${requiereSeb}, seb_config_key = ${sebKey} where id = ${id}`;
  }
  return json({ ok: true });
});

export const DELETE = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const e = await examenOError(id);
  exigirBorrador(e);
  const sql = db();
  const [{ n }] = await sql`select count(*)::int as n from asignaciones where examen_id = ${id} and estado <> 'pendiente'`;
  if (n > 0) throw new ApiError(409, "No se puede borrar: hay alumnos que ya rindieron.");
  await sql.begin(async (tx) => {
    await tx`delete from asignaciones where examen_id = ${id}`;
    await tx`delete from examenes where id = ${id}`;
  });
  return json({ ok: true });
});
