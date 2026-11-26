import { exigirAlumno } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar } from "@/lib/http";

// Eventos de monitoreo enviados por el navegador del alumno.
const TIPOS = new Set(["pegado", "salida", "pantalla_completa_salida"]);
const UUID = /^[0-9a-f-]{36}$/i;

export const POST = manejar(async (req: Request) => {
  const ctx = await exigirAlumno(req);
  if (ctx.asignacion.estado !== "en_curso") return json({ ok: true, ignorados: true });
  const body = await leerJson<{ eventos?: unknown }>(req, 100_000);
  if (!Array.isArray(body.eventos) || body.eventos.length > 100) throw new ApiError(400, "Lote de eventos inválido.");
  const filas = body.eventos.flatMap((e) => {
    const ev = e as { tipo?: unknown; consignaId?: unknown; detalle?: unknown; ts?: unknown };
    if (typeof ev.tipo !== "string" || !TIPOS.has(ev.tipo)) return [];
    const detalle = JSON.stringify(ev.detalle ?? {});
    if (detalle.length > 3000) return [];
    const ts = typeof ev.ts === "string" && !Number.isNaN(Date.parse(ev.ts)) ? new Date(ev.ts) : null;
    return [{
      asignacion_id: ctx.asignacion.id,
      tipo: ev.tipo,
      consigna_id: typeof ev.consignaId === "string" && UUID.test(ev.consignaId) ? ev.consignaId : null,
      detalle: JSON.parse(detalle),
      cliente_ts: ts,
    }];
  });
  if (filas.length) {
    const sql = db();
    await sql`insert into eventos ${sql(filas, "asignacion_id", "tipo", "consigna_id", "detalle", "cliente_ts")}`;
  }
  return json({ ok: true, registrados: filas.length });
});
