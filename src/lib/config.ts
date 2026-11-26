// Configuración leída de variables de entorno. Los VALORES nunca van al repo:
// ver .env.example para los nombres.

function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

export const config = {
  get databaseUrl() {
    return requerida("DATABASE_URL");
  },
  /** URL pública de la app, p. ej. https://examenes.vercel.app (sin barra final). */
  get appUrl() {
    return requerida("APP_URL").replace(/\/+$/, "");
  },
  get adminPassword() {
    return requerida("ADMIN_PASSWORD");
  },
  /** Secreto para firmar la cookie del docente. Mínimo 32 caracteres. */
  get sessionSecret() {
    const s = requerida("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
    return s;
  },
  get produccion() {
    return process.env.NODE_ENV === "production";
  },
  /** Cookies con atributo Secure (HTTPS). Por defecto: solo si APP_URL es https. */
  get cookiesSeguras() {
    return (process.env.APP_URL ?? "").startsWith("https://");
  },
  smtp: {
    get host() {
      return process.env.SMTP_HOST ?? "";
    },
    get port() {
      return Number(process.env.SMTP_PORT ?? "587");
    },
    get user() {
      return process.env.SMTP_USER ?? "";
    },
    get pass() {
      return process.env.SMTP_PASS ?? "";
    },
    get from() {
      return process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "";
    },
  },
};

/** Margen para autoguardados que llegan justo después del vencimiento (red lenta). */
export const MARGEN_VENCIMIENTO_MS = 15_000;
