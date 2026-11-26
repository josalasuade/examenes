import { exigirAdmin } from "@/lib/auth";
import { examenOError, exigirBorrador, type Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { json, manejar, uuid } from "@/lib/http";

// Crea un tema vacío con el siguiente número.
export const POST = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = uuid((await ctx.params).id);
  exigirBorrador(await examenOError(id));
  const [t] = await db()`
    insert into temas (examen_id, numero, titulo)
    select ${id}, coalesce(max(numero), 0) + 1, 'Tema ' || (coalesce(max(numero), 0) + 1) from temas where examen_id = ${id}
    returning id`;
  return json({ id: t.id });
});
