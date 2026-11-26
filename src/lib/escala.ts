// Escala de notas UADE: puntaje 0–100 → nota.

export type Banda = { desde: number; nota: string };

export const ESCALA_DEFECTO: Banda[] = [
  { desde: 0, nota: "Desaprobado" },
  { desde: 60, nota: "4" },
  { desde: 65, nota: "5" },
  { desde: 70, nota: "6" },
  { desde: 75, nota: "7" },
  { desde: 80, nota: "8" },
  { desde: 88, nota: "9" },
  { desde: 95, nota: "10" },
];

export function validarEscala(escala: unknown): Banda[] {
  if (!Array.isArray(escala) || escala.length === 0) throw new Error("La escala debe tener al menos una banda.");
  const bandas = escala.map((b) => {
    const desde = Number((b as Banda).desde);
    const nota = String((b as Banda).nota ?? "").trim();
    if (!Number.isFinite(desde) || desde < 0 || desde > 100 || !nota) throw new Error("Banda de escala inválida.");
    return { desde, nota };
  });
  for (let i = 1; i < bandas.length; i++) {
    if (bandas[i].desde <= bandas[i - 1].desde) throw new Error("Las bandas de la escala deben estar en orden creciente.");
  }
  if (bandas[0].desde !== 0) throw new Error("La primera banda de la escala debe empezar en 0.");
  return bandas;
}

export function notaDesdePuntaje(puntaje: number, escala: Banda[] = ESCALA_DEFECTO): string {
  let nota = escala[0].nota;
  for (const b of escala) if (puntaje >= b.desde) nota = b.nota;
  return nota;
}

/** Filas "0 - 59 | Desaprobado" para mostrar la tabla de la escala. */
export function filasEscala(escala: Banda[]): { rango: string; nota: string }[] {
  return escala.map((b, i) => {
    const sig = escala[i + 1];
    const hasta = sig ? sig.desde - 1 : 100;
    return { rango: `${b.desde} - ${hasta}`, nota: b.nota };
  });
}
