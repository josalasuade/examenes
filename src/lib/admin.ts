import type postgres from "postgres";
import { db } from "./db";
import { ApiError } from "./http";

export type Params<K extends string = "id"> = { params: Promise<Record<K, string>> };

export async function examenOError(id: string) {
  const [e] = await db()`select * from examenes where id = ${id}`;
  if (!e) throw new ApiError(404, "Examen inexistente.");
  return e;
}

export function exigirBorrador(e: { estado?: unknown }) {
  if (e.estado !== "borrador") {
    throw new ApiError(409, "El examen ya está publicado: su contenido está congelado. Volvelo a borrador para editarlo (solo si nadie empezó).");
  }
}

/** Guarda un tema completo (consignas + rúbrica), reemplazando lo anterior. */
export async function guardarTemaCompleto(
  tx: postgres.TransactionSql,
  temaId: string,
  tema: {
    titulo: string;
    casoHtml: string;
    consignas: {
      titulo: string; parte: string | null; puntaje: number; enunciadoHtml: string; noSuma: string;
      criterios: { descripcion: string; puntaje: number; completo: string; parcial: string; ausente: string }[];
    }[];
  },
) {
  await tx`update temas set titulo = ${tema.titulo}, caso_html = ${tema.casoHtml} where id = ${temaId}`;
  await tx`delete from consignas where tema_id = ${temaId}`;
  let orden = 0;
  for (const c of tema.consignas) {
    orden++;
    const [nueva] = await tx`
      insert into consignas (tema_id, orden, parte, titulo, enunciado_html, puntaje, no_suma)
      values (${temaId}, ${orden}, ${c.parte}, ${c.titulo}, ${c.enunciadoHtml}, ${c.puntaje}, ${c.noSuma})
      returning id`;
    let o = 0;
    for (const cr of c.criterios) {
      o++;
      await tx`
        insert into rubrica_criterios (consigna_id, orden, descripcion, puntaje, completo, parcial, ausente)
        values (${nueva.id}, ${o}, ${cr.descripcion}, ${cr.puntaje}, ${cr.completo}, ${cr.parcial}, ${cr.ausente})`;
    }
  }
}
