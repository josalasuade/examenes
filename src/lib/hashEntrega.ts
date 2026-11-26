import { sha256Hex } from "./cripto";

// Huella de la entrega: identifica de forma única lo que el alumno entregó.
// Se imprime en el PDF como "código de verificación" y se guarda en la base.
// Si alguien presenta un PDF con respuestas alteradas, el código no coincide
// con lo guardado.

export function hashEntrega(datos: {
  asignacionId: string;
  entregadoEn: Date;
  respuestas: { consignaId: string; html: string }[];
}): string {
  const canonico = JSON.stringify({
    a: datos.asignacionId,
    t: datos.entregadoEn.toISOString(),
    r: [...datos.respuestas]
      .sort((x, y) => x.consignaId.localeCompare(y.consignaId))
      .map((r) => [r.consignaId, r.html]),
  });
  return sha256Hex(canonico);
}

/** Formato legible: 64 hex en grupos de 4, en mayúsculas. */
export function formatearCodigo(hash: string): string {
  return hash.toUpperCase().match(/.{1,4}/g)!.join("-");
}

export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/[^0-9a-f]/gi, "").toLowerCase();
}
