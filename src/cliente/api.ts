"use client";

// Cliente HTTP del navegador. Agrega los datos de Safe Exam Browser (JS API)
// en cada llamada: URL de la página + hash de la Config Key para esa URL.

type SebSecurity = { configKey?: string; browserExamKey?: string; updateKeys?: (cb: () => void) => void };
declare global {
  interface Window {
    SafeExamBrowser?: { security?: SebSecurity };
  }
}

let clavesActualizadas: Promise<void> | null = null;

function actualizarClavesSeb(): Promise<void> {
  if (!clavesActualizadas) {
    clavesActualizadas = new Promise((resolve) => {
      const sec = window.SafeExamBrowser?.security;
      if (sec?.updateKeys) {
        const t = setTimeout(resolve, 3000);
        sec.updateKeys(() => {
          clearTimeout(t);
          resolve();
        });
      } else resolve();
    });
  }
  return clavesActualizadas;
}

export function hayJsApiSeb(): boolean {
  return typeof window !== "undefined" && !!window.SafeExamBrowser?.security;
}

async function headersSeb(): Promise<Record<string, string>> {
  if (!hayJsApiSeb()) return {};
  await actualizarClavesSeb();
  const ck = window.SafeExamBrowser?.security?.configKey;
  if (!ck) return {};
  return { "x-seb-url": location.href.split("#")[0], "x-seb-ck": ck };
}

export class ErrorApi extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ruta, {
      method: opciones.metodo ?? (opciones.cuerpo === undefined ? "GET" : "POST"),
      headers: { ...(opciones.cuerpo !== undefined ? { "Content-Type": "application/json" } : {}), ...(await headersSeb()) },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      credentials: "same-origin",
      cache: "no-store",
      keepalive: opciones.keepalive,
    });
  } catch {
    throw new ErrorApi(0, "No hay conexión con el servidor. Reintentando…", "red");
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(res.status, datos.error ?? `Error ${res.status}`, datos.codigo);
  return datos as T;
}
