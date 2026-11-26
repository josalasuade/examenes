import { iguales, sha256Hex } from "./cripto";

// Validación de Safe Exam Browser (SEB) por Config Key.
//
// SEB calcula, para cada URL, SHA-256( URL absoluta sin fragmento + Config Key )
// y lo expone de dos maneras:
//   1. Header HTTP "X-SafeExamBrowser-ConfigKeyHash" en los requests que hace.
//   2. API JavaScript: window.SafeExamBrowser.security.configKey (para la URL de
//      la página actual).
// La app usa la vía 2 (el cliente manda la URL de la página y el hash en los
// headers x-seb-url / x-seb-ck de cada llamada a la API) y acepta también la
// vía 1 si viene el header nativo.
//
// IMPORTANTE: confirmar este algoritmo en la documentación oficial de SEB
// (sección "Config Key" / "Browser Exam Key") para la versión de SEB que se use.
// El Config Key del archivo .seb se ve en SEB Config Tool y el docente lo carga
// en el panel, por examen.

export function hashSebEsperado(url: string, configKey: string): string {
  return sha256Hex(url + configKey.trim());
}

export function sinFragmento(url: string): string {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

export type DatosSeb = {
  /** URL de la página según el cliente (JS API). */
  urlPagina?: string | null;
  /** Hash de la JS API (configKey). */
  hashPagina?: string | null;
  /** Header nativo X-SafeExamBrowser-ConfigKeyHash. */
  hashHeader?: string | null;
  /** URL del request tal como la pidió el navegador (para el header nativo). */
  urlRequest?: string | null;
};

export function validarSeb(datos: DatosSeb, configKey: string, appUrl: string): { ok: boolean; motivo?: string } {
  if (!configKey.trim()) return { ok: false, motivo: "El examen no tiene Config Key de SEB configurada." };
  const origen = new URL(appUrl).origin;

  if (datos.hashHeader && datos.urlRequest) {
    const url = sinFragmento(datos.urlRequest);
    if (url.startsWith(origen + "/") && iguales(datos.hashHeader.toLowerCase(), hashSebEsperado(url, configKey))) {
      return { ok: true };
    }
  }

  if (datos.hashPagina && datos.urlPagina) {
    const url = sinFragmento(datos.urlPagina);
    let mismoOrigen = false;
    try {
      mismoOrigen = new URL(url).origin === origen;
    } catch {
      mismoOrigen = false;
    }
    if (!mismoOrigen) return { ok: false, motivo: "La página no corresponde a esta plataforma." };
    if (iguales(datos.hashPagina.toLowerCase(), hashSebEsperado(url, configKey))) return { ok: true };
    return { ok: false, motivo: "La configuración de Safe Exam Browser no es la oficial del examen." };
  }

  return { ok: false, motivo: "Este examen debe rendirse con Safe Exam Browser." };
}
