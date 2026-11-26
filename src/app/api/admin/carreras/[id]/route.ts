import { exigirAdmin } from "@/lib/auth";
import type { Params } from "@/lib/admin";
import { db } from "@/lib/db";
import { json, leerJson, manejar, numero, texto } from "@/lib/http";

export const PUT = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = numero((await ctx.params).id, "id", { min: 1 });
  const b = await leerJson(req);
  await db()`update carreras set nombre = ${texto(b.nombre, "nombre", { max: 200 })}, activa = ${b.activa !== false} where id = ${id}`;
  return json({ ok: true });
});

export const DELETE = manejar(async (req: Request, ctx: Params) => {
  exigirAdmin(req);
  const id = numero((await ctx.params).id, "id", { min: 1 });
  await db()`delete from carreras where id = ${id}`;
  return json({ ok: true });
});
