import { exigirAlumno } from "@/lib/auth";
import { MARGEN_VENCIMIENTO_MS } from "@/lib/config";
import { db } from "@/lib/db";
import { consignasDe, finalizarEntrega } from "@/lib/entregas";
import { ApiError, json, leerJson, manejar, numero, uuid } from "@/lib/http";
import { sanitizar, textoPlano } from "@/lib/sanitizar";

// Diferencia de caracteres tolerada entre lo tecleado/pegado y lo guardado
// (autocompletado, correcciones, formato).
const TOLERANCIA_INSERCION = 80;

// Autoguardado de una respuesta. También detecta inserciones de texto que no
// vienen ni del teclado ni de un pegado (extensiones, herramientas externas).
export const PUT = manejar(async (req: Request) => {
  const ctx = await exigirAlumno(req);
  if (ctx.asignacion.estado !== "en_curso") throw new ApiError(409, "El examen no está en curso.");
  const vence = ctx.asignacion.vence_en?.getTime() ?? 0;
  if (Date.now() > vence + MARGEN_VENCIMIENTO_MS) {
    await finalizarEntrega(ctx.asignacion.id, "vencimiento");
    throw new ApiError(409, "El tiempo del examen terminó. Tu examen se entregó automáticamente.", "vencido");
  }
  const body = await leerJson(req, 600_000);
  const consignaId = uuid(body.consignaId, "consigna");
  if (typeof body.html !== "string") throw new ApiError(400, "Respuesta inválida.");
  const html = sanitizar(body.html);
  if (html.length > 300_000) throw new ApiError(413, "La respuesta es demasiado larga.");
  const m = (body.metricas ?? {}) as Record<string, unknown>;
  const teclas = numero(m.teclas ?? 0, "teclas", { min: 0, max: 1e7 });
  const pegadoExterno = numero(m.pegadoExterno ?? 0, "pegadoExterno", { min: 0, max: 1e7 });
  const pegadoInterno = numero(m.pegadoInterno ?? 0, "pegadoInterno", { min: 0, max: 1e7 });

  const sql = db();
  const consignas = await consignasDe(sql, ctx.asignacion.tema_id, ctx.asignacion.parte);
  if (!consignas.some((c) => c.id === consignaId)) throw new ApiError(400, "La consigna no corresponde a tu examen.");

  const [previa] = await sql`select html from respuestas where asignacion_id = ${ctx.asignacion.id} and consigna_id = ${consignaId}`;
  const delta = textoPlano(html).length - textoPlano(previa?.html ?? "").length;
  if (delta > teclas + pegadoExterno + pegadoInterno + TOLERANCIA_INSERCION) {
    await sql`insert into eventos (asignacion_id, tipo, consigna_id, detalle)
              values (${ctx.asignacion.id}, 'insercion_sin_tecleo', ${consignaId},
                      ${sql.json({ caracteres: delta, teclas, pegadoExterno, pegadoInterno })})`;
  }
  const [r] = await sql`
    insert into respuestas (asignacion_id, consigna_id, html, actualizado_en)
    values (${ctx.asignacion.id}, ${consignaId}, ${html}, now())
    on conflict (asignacion_id, consigna_id) do update set html = excluded.html, actualizado_en = now()
    returning actualizado_en`;
  return json({ ok: true, guardadoEn: r.actualizado_en });
});
