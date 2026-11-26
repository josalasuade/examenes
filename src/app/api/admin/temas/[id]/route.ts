import { exigirAdmin } from "@/lib/auth";
import { exigirBorrador, guardarTemaCompleto, type Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar, numero, texto, uuid } from "@/lib/http";
import { sanitizar } from "@/lib/sanitizar";

async function temaYExamen(id: string) {
  const [t] = await db()`select t.id, e.estado from temas t join examenes e on e.id = t.examen_id where t.id = ${id}`;
  if (!t) throw new ApiError(404, "Tema inexistente.");
  exigirBorrador(t);
  return t;
}

export const PUT = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  await temaYExamen(id);
  const b = await leerJson(req, 3_000_000);
  if (!Array.isArray(b.consignas)) throw new ApiError(400, "Faltan las consignas.");
  const consignas = b.consignas.map((c: Record<string, unknown>, i: number) => {
    const puntaje = numero(c.puntaje, `puntaje de la consigna ${i + 1}`, { min: 0, max: 100 });
    const criterios = (Array.isArray(c.criterios) ? c.criterios : []).map((r: Record<string, unknown>, j: number) => ({
      descripcion: texto(r.descripcion, `criterio ${j + 1} de la consigna ${i + 1}`, { max: 2_000 }),
      puntaje: numero(r.puntaje, `puntaje del criterio ${j + 1}`, { min: 0, max: 100 }),
      completo: texto(r.completo, "completo", { max: 2_000, requerido: false }),
      parcial: texto(r.parcial, "parcial", { max: 2_000, requerido: false }),
      ausente: texto(r.ausente, "ausente", { max: 2_000, requerido: false }),
    }));
    if (criterios.length) {
      const suma = criterios.reduce((a: number, r: { puntaje: number }) => a + r.puntaje, 0);
      if (Math.abs(suma - puntaje) > 0.001) throw new ApiError(400, `La rúbrica de la consigna ${i + 1} suma ${suma} pero la consigna vale ${puntaje}.`);
    }
    return {
      titulo: texto(c.titulo, `título de la consigna ${i + 1}`, { max: 500 }),
      parte: texto(c.parte, "parte", { max: 10, requerido: false }).toUpperCase() || null,
      puntaje,
      enunciadoHtml: sanitizar(typeof c.enunciadoHtml === "string" ? c.enunciadoHtml : ""),
      noSuma: texto(c.noSuma, "no suma", { max: 5_000, requerido: false }),
      criterios,
    };
  });
  await db().begin((tx) =>
    guardarTemaCompleto(tx, id, {
      titulo: texto(b.titulo, "título del tema", { max: 300 }),
      casoHtml: sanitizar(typeof b.casoHtml === "string" ? b.casoHtml : ""),
      consignas,
    }),
  );
  return json({ ok: true });
});

export const DELETE = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  await temaYExamen(id);
  const sql = db();
  const [{ n }] = await sql`select count(*)::int as n from asignaciones where tema_id = ${id}`;
  if (n) throw new ApiError(409, "Hay alumnos asignados a este tema. Reasignalos antes de borrarlo.");
  await sql`delete from temas where id = ${id}`;
  return json({ ok: true });
});
