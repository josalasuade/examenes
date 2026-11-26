// Utilidades para los route handlers de la API.
import { unstable_rethrow } from "next/navigation";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

/** Envuelve un handler: convierte ApiError en respuestas JSON y oculta errores internos. */
export function manejar<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      // Errores internos de Next (p. ej. al decidir si una ruta es dinámica) no se tocan.
      unstable_rethrow(e);
      if (e instanceof ApiError) {
        return json({ error: e.message, codigo: e.codigo }, { status: e.status });
      }
      console.error(e);
      return json({ error: "Error interno del servidor." }, { status: 500 });
    }
  };
}

export async function leerJson<T = Record<string, unknown>>(req: Request, maxBytes = 2_000_000): Promise<T> {
  const texto = await req.text();
  if (texto.length > maxBytes) throw new ApiError(413, "El contenido es demasiado grande.");
  try {
    return JSON.parse(texto || "{}") as T;
  } catch {
    throw new ApiError(400, "JSON inválido.");
  }
}

export function texto(v: unknown, campo: string, { max = 10_000, requerido = true } = {}): string {
  if (v === undefined || v === null) {
    if (requerido) throw new ApiError(400, `Falta el campo ${campo}.`);
    return "";
  }
  if (typeof v !== "string") throw new ApiError(400, `El campo ${campo} debe ser texto.`);
  const s = v.trim();
  if (requerido && !s) throw new ApiError(400, `El campo ${campo} es obligatorio.`);
  if (s.length > max) throw new ApiError(400, `El campo ${campo} es demasiado largo.`);
  return s;
}

export function numero(v: unknown, campo: string, { min = -Infinity, max = Infinity } = {}): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new ApiError(400, `El campo ${campo} debe ser un número.`);
  if (n < min || n > max) throw new ApiError(400, `El campo ${campo} está fuera de rango.`);
  return n;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(v: unknown, campo = "id"): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new ApiError(400, `${campo} inválido.`);
  return v;
}
