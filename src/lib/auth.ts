import { config } from "./config";
import { firmar, iguales, sha256Hex, verificarFirma } from "./cripto";
import { db } from "./db";
import { ApiError } from "./http";
import { validarSeb } from "./seb";

export const COOKIE_ADMIN = "adm";
export const COOKIE_ALUMNO = "exs";
const DURACION_ADMIN_S = 12 * 3600;
const DURACION_ALUMNO_S = 12 * 3600;

export function leerCookie(req: Request, nombre: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const parte of header.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookie(nombre: string, valor: string, maxAgeS: number): string {
  const partes = [`${nombre}=${encodeURIComponent(valor)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeS}`];
  if (config.cookiesSeguras) partes.push("Secure");
  return partes.join("; ");
}

/** Defensa CSRF: en requests que modifican datos, el Origin (si viene) debe ser el de la app. */
export function exigirMismoOrigen(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origen = req.headers.get("origin");
  if (origen && origen !== new URL(config.appUrl).origin) throw new ApiError(403, "Origen no permitido.");
}

// ---------------------------------------------------------------------------
// Docente

export function passwordAdminCorrecta(password: string): boolean {
  return iguales(sha256Hex(password), sha256Hex(config.adminPassword));
}

export function cookieAdmin(): string {
  const token = firmar({ rol: "docente", exp: Math.floor(Date.now() / 1000) + DURACION_ADMIN_S }, config.sessionSecret);
  return cookie(COOKIE_ADMIN, token, DURACION_ADMIN_S);
}

export function cookieAdminBorrada(): string {
  return cookie(COOKIE_ADMIN, "", 0);
}

export function esAdmin(req: Request): boolean {
  const token = leerCookie(req, COOKIE_ADMIN);
  if (!token) return false;
  const p = verificarFirma<{ rol: string; exp: number }>(token, config.sessionSecret);
  return !!p && p.rol === "docente" && p.exp > Date.now() / 1000;
}

export function exigirAdmin(req: Request): void {
  exigirMismoOrigen(req);
  if (!esAdmin(req)) throw new ApiError(401, "Sesión de docente vencida o inexistente.", "no_autenticado");
}

// ---------------------------------------------------------------------------
// Alumno

export function cookieAlumno(token: string): string {
  return cookie(COOKIE_ALUMNO, token, DURACION_ALUMNO_S);
}

export type ContextoAlumno = {
  sesionId: string;
  asignacion: {
    id: string;
    examen_id: string;
    tema_id: string;
    parte: string | null;
    sin_seb: boolean;
    carrera: string | null;
    estado: "pendiente" | "en_curso" | "entregado";
    iniciado_en: Date | null;
    vence_en: Date | null;
    entregado_en: Date | null;
    hash_entrega: string | null;
  };
  examen: {
    id: string;
    materia: string;
    docente: string;
    instancia: string;
    fecha: string;
    duracion_min: number;
    consignas_generales: string;
    estado: string;
    requiere_seb: boolean;
    seb_config_key: string;
  };
  alumno: { id: string; lu: string; nombre: string };
};

export function datosSebDeRequest(req: Request) {
  const u = new URL(req.url);
  return {
    urlPagina: req.headers.get("x-seb-url"),
    hashPagina: req.headers.get("x-seb-ck"),
    hashHeader: req.headers.get("x-safeexambrowser-configkeyhash"),
    urlRequest: config.appUrl + u.pathname + u.search,
  };
}

export function exigirSebSiCorresponde(
  req: Request,
  examen: { requiere_seb: boolean; seb_config_key: string },
  sinSeb: boolean,
): void {
  if (!examen.requiere_seb || sinSeb) return;
  const r = validarSeb(datosSebDeRequest(req), examen.seb_config_key, config.appUrl);
  if (!r.ok) throw new ApiError(403, r.motivo ?? "Safe Exam Browser requerido.", "seb");
}

export async function exigirAlumno(req: Request, { permitirEntregado = false } = {}): Promise<ContextoAlumno> {
  exigirMismoOrigen(req);
  const token = leerCookie(req, COOKIE_ALUMNO);
  if (!token) throw new ApiError(401, "No hay una sesión de examen activa.", "no_autenticado");
  const sql = db();
  const [fila] = await sql`
    select s.id as sesion_id,
           a.id, a.examen_id, a.tema_id, a.parte, a.sin_seb, a.carrera, a.estado,
           a.iniciado_en, a.vence_en, a.entregado_en, a.hash_entrega,
           e.materia, e.docente, e.instancia, to_char(e.fecha, 'YYYY-MM-DD') as fecha, e.duracion_min,
           e.consignas_generales, e.estado as examen_estado, e.requiere_seb, e.seb_config_key,
           al.id as alumno_id, al.lu, al.nombre
    from sesiones s
    join asignaciones a on a.id = s.asignacion_id
    join examenes e on e.id = a.examen_id
    join alumnos al on al.id = a.alumno_id
    where s.token_hash = ${sha256Hex(token)} and s.revocada_en is null`;
  if (!fila) throw new ApiError(401, "Tu sesión ya no es válida. Pedile al docente que apruebe tu reingreso.", "no_autenticado");
  if (fila.estado === "entregado" && !permitirEntregado) throw new ApiError(409, "Ya entregaste este examen.", "entregado");
  if (fila.examen_estado !== "publicado" && fila.estado !== "entregado") {
    throw new ApiError(403, "El examen no está disponible.", "examen_cerrado");
  }
  if (fila.estado !== "entregado") exigirSebSiCorresponde(req, fila as never, fila.sin_seb);
  return {
    sesionId: fila.sesion_id,
    asignacion: {
      id: fila.id, examen_id: fila.examen_id, tema_id: fila.tema_id, parte: fila.parte, sin_seb: fila.sin_seb,
      carrera: fila.carrera, estado: fila.estado, iniciado_en: fila.iniciado_en, vence_en: fila.vence_en,
      entregado_en: fila.entregado_en, hash_entrega: fila.hash_entrega,
    },
    examen: {
      id: fila.examen_id, materia: fila.materia, docente: fila.docente, instancia: fila.instancia, fecha: fila.fecha,
      duracion_min: fila.duracion_min, consignas_generales: fila.consignas_generales, estado: fila.examen_estado,
      requiere_seb: fila.requiere_seb, seb_config_key: fila.seb_config_key,
    },
    alumno: { id: fila.alumno_id, lu: fila.lu, nombre: fila.nombre },
  };
}
