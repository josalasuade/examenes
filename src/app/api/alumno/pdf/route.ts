import { exigirAlumno } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, manejar } from "@/lib/http";

export const GET = manejar(async (req: Request) => {
  const ctx = await exigirAlumno(req, { permitirEntregado: true });
  if (ctx.asignacion.estado !== "entregado") throw new ApiError(409, "El PDF está disponible después de entregar.");
  const [a] = await db()`select pdf from asignaciones where id = ${ctx.asignacion.id}`;
  return new Response(new Uint8Array(a.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="examen-${ctx.alumno.lu}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
