import { exigirAdmin } from "@/lib/auth";
import { examenOError, type Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar, uuid } from "@/lib/http";
import { ErrorImportacion, importarAlumnos } from "@/lib/importar";

export const GET = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const filas = await db()`
    select a.id, al.lu, al.nombre, al.mail, t.numero as tema, a.parte, a.sin_seb, a.carrera, a.estado,
           a.iniciado_en, a.vence_en, a.entregado_en, a.entrega_tipo, a.nota_final::float as nota_final, a.observaciones,
           m.estado as mail_estado, m.ultimo_error as mail_error
    from asignaciones a
    join alumnos al on al.id = a.alumno_id
    join temas t on t.id = a.tema_id
    left join envios_mail m on m.asignacion_id = a.id
    where a.examen_id = ${id}
    order by al.nombre`;
  return json(filas);
});

// Importa / actualiza alumnos desde CSV: lu, nombre, mail, tema, parte, sin_seb.
// Los alumnos que ya empezaron no se modifican (solo nombre y mail).
export const POST = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const e = await examenOError(id);
  if (e.estado === "cerrado") throw new ApiError(409, "El examen está cerrado.");
  const { csv } = await leerJson<{ csv?: unknown }>(req, 2_000_000);
  if (typeof csv !== "string") throw new ApiError(400, "Falta el CSV.");
  let filas;
  try {
    filas = importarAlumnos(csv);
  } catch (err) {
    if (err instanceof ErrorImportacion) throw new ApiError(400, err.message);
    throw err;
  }
  const sql = db();
  const temas = await sql`select id, numero from temas where examen_id = ${id}`;
  const temaPorNumero = new Map(temas.map((t) => [t.numero as number, t.id as string]));
  for (const f of filas) {
    if (!temaPorNumero.has(f.tema)) throw new ApiError(400, `El alumno ${f.lu} tiene el tema ${f.tema}, que no existe en este examen.`);
  }
  let nuevos = 0;
  let actualizados = 0;
  let sinCambiosPorIniciados = 0;
  await sql.begin(async (tx) => {
    for (const f of filas) {
      const [al] = await tx`
        insert into alumnos (lu, nombre, mail) values (${f.lu}, ${f.nombre}, ${f.mail})
        on conflict (lu) do update set nombre = excluded.nombre, mail = excluded.mail
        returning id`;
      const [a] = await tx`select id, estado from asignaciones where examen_id = ${id} and alumno_id = ${al.id}`;
      const temaId = temaPorNumero.get(f.tema)!;
      if (!a) {
        await tx`insert into asignaciones (examen_id, alumno_id, tema_id, parte, sin_seb)
                 values (${id}, ${al.id}, ${temaId}, ${f.parte}, ${f.sinSeb})`;
        nuevos++;
      } else if (a.estado === "pendiente") {
        await tx`update asignaciones set tema_id = ${temaId}, parte = ${f.parte}, sin_seb = ${f.sinSeb} where id = ${a.id}`;
        actualizados++;
      } else {
        sinCambiosPorIniciados++;
      }
    }
  });
  return json({ ok: true, nuevos, actualizados, sinCambiosPorIniciados });
});
