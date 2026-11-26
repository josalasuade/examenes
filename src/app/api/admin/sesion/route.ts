import { cookieAdmin, cookieAdminBorrada, esAdmin, exigirMismoOrigen, passwordAdminCorrecta } from "@/lib/auth";
import { ApiError, json, leerJson, manejar, texto } from "@/lib/http";

export const GET = manejar(async (req: Request) => json({ autenticado: esAdmin(req) }));

export const POST = manejar(async (req: Request) => {
  exigirMismoOrigen(req);
  const password = texto((await leerJson(req, 2_000)).password, "contraseña", { max: 200 });
  if (!passwordAdminCorrecta(password)) {
    await new Promise((r) => setTimeout(r, 1000)); // frena intentos por fuerza bruta
    throw new ApiError(401, "Contraseña incorrecta.");
  }
  return json({ ok: true }, { headers: { "Set-Cookie": cookieAdmin() } });
});

export const DELETE = manejar(async (req: Request) => {
  exigirMismoOrigen(req);
  return json({ ok: true }, { headers: { "Set-Cookie": cookieAdminBorrada() } });
});
