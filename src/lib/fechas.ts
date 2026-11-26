// Formateo de fechas en hora de Argentina (o la zona configurada).
const ZONA = process.env.ZONA_HORARIA ?? "America/Argentina/Buenos_Aires";

export function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(d));
}

/** Fecha de calendario (columna date de Postgres): no se convierte de zona. */
export function fechaCalendario(d: Date | string): string {
  const iso = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [a, m, dia] = iso.split("-");
  return `${dia}/${m}/${a}`;
}
