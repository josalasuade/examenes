import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, json, leerJson, manejar, texto } from "@/lib/http";

export const GET = manejar(async (req: Request) => {
  exigirAdmin(req);
  return json(await db()`select id, nombre, activa from carreras order by nombre`);
});

export const POST = manejar(async (req: Request) => {
  exigirAdmin(req);
  const nombre = texto((await leerJson(req)).nombre, "nombre", { max: 200 });
  const [c] = await db()`insert into carreras (nombre) values (${nombre}) on conflict (nombre) do nothing returning id`;
  if (!c) throw new ApiError(409, "Esa carrera ya existe.");
  return json({ id: c.id });
});
