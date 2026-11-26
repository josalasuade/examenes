import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { normalizarCodigo } from "@/lib/hashEntrega";
import { ApiError, json, manejar } from "@/lib/http";

// Verifica un código de verificación impreso en un PDF.
export const GET = manejar(async (req: Request) => {
  exigirAdmin(req);
  const codigo = normalizarCodigo(new URL(req.url).searchParams.get("codigo") ?? "");
  if (codigo.length !== 64) throw new ApiError(400, "El código debe tener 64 caracteres hexadecimales (los guiones se ignoran).");
  const [a] = await db()`
    select a.id, a.examen_id, al.nombre, al.lu, e.materia, e.instancia, a.entregado_en
    from asignaciones a join alumnos al on al.id = a.alumno_id join examenes e on e.id = a.examen_id
    where a.hash_entrega = ${codigo}`;
  if (!a) return json({ valido: false });
  return json({ valido: true, ...a, entregado: fechaHora(a.entregado_en) });
});
