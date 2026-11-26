import { exigirAdmin } from "@/lib/auth";
import { examenOError, exigirBorrador, guardarTemaCompleto, type Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar, uuid } from "@/lib/http";
import { ErrorImportacion, importarTemas } from "@/lib/importar";

// Importa temas desde Markdown. Reemplaza los temas con el mismo número.
export const POST = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  exigirBorrador(await examenOError(id));
  const { markdown } = await leerJson<{ markdown?: unknown }>(req, 3_000_000);
  if (typeof markdown !== "string" || !markdown.trim()) throw new ApiError(400, "El archivo está vacío.");
  let temas;
  try {
    temas = importarTemas(markdown);
  } catch (e) {
    if (e instanceof ErrorImportacion) throw new ApiError(400, e.message);
    throw e;
  }
  const sql = db();
  await sql.begin(async (tx) => {
    for (const t of temas) {
      const [existente] = await tx`select id from temas where examen_id = ${id} and numero = ${t.numero}`;
      let temaId = existente?.id as string | undefined;
      if (!temaId) {
        const [nuevo] = await tx`insert into temas (examen_id, numero) values (${id}, ${t.numero}) returning id`;
        temaId = nuevo.id as string;
      }
      await guardarTemaCompleto(tx, temaId, {
        titulo: t.titulo,
        casoHtml: t.casoHtml,
        consignas: t.consignas.map((c) => ({
          titulo: c.titulo, parte: c.parte, puntaje: c.puntaje, enunciadoHtml: c.enunciadoHtml, noSuma: c.noSuma, criterios: c.criterios,
        })),
      });
    }
  });
  return json({ ok: true, temas: temas.map((t) => ({ numero: t.numero, titulo: t.titulo, consignas: t.consignas.length })) });
});
