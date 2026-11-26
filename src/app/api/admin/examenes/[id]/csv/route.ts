import { exigirAdmin } from "@/lib/auth";
import type { Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { notaDesdePuntaje, type Banda } from "@/lib/escala";
import { fechaHora } from "@/lib/fechas";
import { ApiError, manejar, uuid } from "@/lib/http";

function celda(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Exportación para cargar las notas en el sistema de UADE (Excel: separador ";").
export const GET = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const sql = db();
  const [e] = await sql`select materia, instancia, escala from examenes where id = ${id}`;
  if (!e) throw new ApiError(404, "Examen inexistente.");
  const filas = await sql`
    select al.lu, al.nombre, al.mail, a.carrera, t.numero as tema, a.parte, a.estado, a.entregado_en, a.nota_final::float as nota_final
    from asignaciones a join alumnos al on al.id = a.alumno_id join temas t on t.id = a.tema_id
    where a.examen_id = ${id} order by al.nombre`;
  const enc = ["LU", "Nombre", "Mail", "Carrera", "Tema", "Parte", "Estado", "Entregado", "Puntaje", "Nota"];
  const lineas = [enc.join(";")].concat(
    filas.map((f) =>
      [
        f.lu, f.nombre, f.mail, f.carrera, f.tema, f.parte, f.estado,
        f.entregado_en ? fechaHora(f.entregado_en) : "",
        f.nota_final ?? "",
        f.nota_final === null ? "" : notaDesdePuntaje(f.nota_final, e.escala as Banda[]),
      ].map(celda).join(";"),
    ),
  );
  const nombre = `notas-${e.materia}-${e.instancia}`.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").replace(/\s+/g, "_");
  return new Response("﻿" + lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}.csv`,
      "Cache-Control": "no-store",
    },
  });
});
