import type postgres from "postgres";
import { MARGEN_VENCIMIENTO_MS } from "./config";
import { db } from "./db";
import { type Banda } from "./escala";
import { fechaHora } from "./fechas";
import { formatearCodigo, hashEntrega } from "./hashEntrega";
import { enviarMail } from "./mail";
import { generarPdf } from "./pdf";

export type TipoEntrega = "alumno" | "vencimiento" | "docente";

type Tx = postgres.TransactionSql | postgres.Sql;

/** Consignas que le corresponden a una asignación (filtradas por parte, si tiene). */
export async function consignasDe(sql: Tx, temaId: string, parte: string | null) {
  return sql<{ id: string; orden: number; titulo: string; parte: string | null; puntaje: string; enunciado_html: string }[]>`
    select id, orden, titulo, parte, puntaje, enunciado_html
    from consignas
    where tema_id = ${temaId}
      and (${parte}::text is null or parte is null or parte = ${parte})
    order by orden`;
}

/**
 * Cierra la entrega de una asignación: congela respuestas, calcula el código de
 * verificación, genera el PDF y deja el mail en cola. Idempotente.
 * Después del commit intenta enviar el mail (si falla, queda pendiente).
 */
export async function finalizarEntrega(asignacionId: string, tipo: TipoEntrega): Promise<boolean> {
  const sql = db();
  const finalizada = await sql.begin(async (tx) => {
    const [a] = await tx`
      select a.*, al.nombre, al.lu, t.numero as tema_numero, t.titulo as tema_titulo, t.caso_html,
             e.departamento, e.materia, e.docente, e.instancia, to_char(e.fecha, 'YYYY-MM-DD') as fecha_examen,
             e.duracion_min, e.consignas_generales, e.condiciones_aprobacion, e.escala
      from asignaciones a
      join alumnos al on al.id = a.alumno_id
      join temas t on t.id = a.tema_id
      join examenes e on e.id = a.examen_id
      where a.id = ${asignacionId}
      for update of a`;
    if (!a || a.estado === "entregado") return false;

    const consignas = await consignasDe(tx, a.tema_id, a.parte);
    const resp = await tx<{ consigna_id: string; html: string }[]>`
      select consigna_id, html from respuestas where asignacion_id = ${asignacionId}`;
    const porConsigna = new Map(resp.map((r) => [r.consigna_id, r.html]));

    // Si vence, la hora de entrega es la del vencimiento (no la de cuando se detectó).
    const ahora = new Date();
    const entregadoEn = tipo === "vencimiento" && a.vence_en && a.vence_en < ahora ? new Date(a.vence_en) : ahora;
    const respuestas = consignas.map((c) => ({ consignaId: c.id, html: porConsigna.get(c.id) ?? "" }));
    const hash = hashEntrega({ asignacionId, entregadoEn, respuestas });

    const pdf = await generarPdf({
      examen: {
        departamento: a.departamento, materia: a.materia, docente: a.docente, instancia: a.instancia,
        fecha: a.fecha_examen, duracionMin: a.duracion_min, consignasGenerales: a.consignas_generales,
        condicionesAprobacion: a.condiciones_aprobacion, escala: a.escala as Banda[],
      },
      tema: { numero: a.tema_numero, titulo: a.tema_titulo, casoHtml: a.caso_html },
      alumno: { nombre: a.nombre, lu: a.lu, carrera: a.carrera ?? "—" },
      iniciadoEn: a.iniciado_en,
      entregadoEn,
      hash,
      consignas: consignas.map((c) => ({
        orden: c.orden, titulo: c.titulo, parte: c.parte, puntaje: Number(c.puntaje),
        enunciadoHtml: c.enunciado_html, respuestaHtml: porConsigna.get(c.id) ?? "",
      })),
    });

    await tx`
      update asignaciones
      set estado = 'entregado', entregado_en = ${entregadoEn}, entrega_tipo = ${tipo},
          hash_entrega = ${hash}, pdf = ${pdf}
      where id = ${asignacionId}`;
    await tx`
      insert into eventos (asignacion_id, tipo, detalle)
      values (${asignacionId}, 'entrega', ${tx.json({ tipo, hash })})`;
    await tx`
      insert into envios_mail (asignacion_id) values (${asignacionId})
      on conflict (asignacion_id) do nothing`;
    return true;
  });

  if (finalizada) await enviarMailEntrega(asignacionId).catch(() => {});
  return finalizada;
}

/** Entrega automáticamente las asignaciones vencidas de un examen (o de todos). */
export async function finalizarVencidas(examenId?: string): Promise<number> {
  const sql = db();
  const limite = new Date(Date.now() - MARGEN_VENCIMIENTO_MS);
  const vencidas = await sql<{ id: string }[]>`
    select id from asignaciones
    where estado = 'en_curso' and vence_en < ${limite}
      and (${examenId ?? null}::uuid is null or examen_id = ${examenId ?? null})`;
  let n = 0;
  for (const v of vencidas) if (await finalizarEntrega(v.id, "vencimiento")) n++;
  return n;
}

export async function enviarMailEntrega(asignacionId: string): Promise<void> {
  const sql = db();
  const [a] = await sql`
    select a.pdf, a.entregado_en, a.hash_entrega, al.nombre, al.mail, al.lu, e.materia, e.instancia
    from asignaciones a
    join alumnos al on al.id = a.alumno_id
    join examenes e on e.id = a.examen_id
    where a.id = ${asignacionId} and a.estado = 'entregado'`;
  if (!a) return;
  try {
    await enviarMail({
      para: a.mail,
      asunto: `Entrega recibida — ${a.materia} — ${a.instancia}`,
      texto: [
        `Hola ${a.nombre}:`,
        "",
        `Recibimos tu entrega del examen ${a.materia} (${a.instancia}) el ${fechaHora(a.entregado_en)}.`,
        "Te adjuntamos el PDF con tus respuestas como comprobante.",
        "",
        `Código de verificación: ${formatearCodigo(a.hash_entrega)}`,
        "",
        "El docente revisará tu examen para definir la nota final.",
        "",
        "Este es un mensaje automático; no lo respondas.",
      ].join("\n"),
      adjunto: { nombre: `examen-${a.lu}.pdf`, contenido: Buffer.from(a.pdf) },
    });
    await sql`
      update envios_mail set estado = 'enviado', intentos = intentos + 1, enviado_en = now(), ultimo_error = ''
      where asignacion_id = ${asignacionId}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`
      update envios_mail set estado = 'error', intentos = intentos + 1, ultimo_error = ${msg.slice(0, 500)}
      where asignacion_id = ${asignacionId}`;
    throw e;
  }
}

/** Reintenta los mails no enviados de un examen. Devuelve cuántos se enviaron. */
export async function reintentarMails(examenId: string): Promise<{ enviados: number; fallidos: number }> {
  const sql = db();
  const pendientes = await sql<{ asignacion_id: string }[]>`
    select m.asignacion_id from envios_mail m
    join asignaciones a on a.id = m.asignacion_id
    where a.examen_id = ${examenId} and m.estado <> 'enviado'`;
  let enviados = 0;
  let fallidos = 0;
  for (const p of pendientes) {
    try {
      await enviarMailEntrega(p.asignacion_id);
      enviados++;
    } catch {
      fallidos++;
    }
  }
  return { enviados, fallidos };
}
