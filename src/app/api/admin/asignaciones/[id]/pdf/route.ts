import { exigirAdmin } from "@/lib/auth";
import type { Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { ApiError, manejar, uuid } from "@/lib/http";

export const GET = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  const [a] = await db()`select a.pdf, al.lu from asignaciones a join alumnos al on al.id = a.alumno_id where a.id = ${id}`;
  if (!a?.pdf) throw new ApiError(404, "No hay PDF (el alumno no entregó).");
  return new Response(new Uint8Array(a.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="examen-${a.lu}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
