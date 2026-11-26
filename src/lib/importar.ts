import { marked } from "marked";
import { sanitizar } from "./sanitizar";

// Importación de temas desde Markdown. Formato documentado en
// docs/FORMATO_IMPORTACION.md. Resumen:
//
//   # Tema 1: Título del tema
//   ## Caso
//   (markdown del caso)
//   ## Consigna: Título de la consigna
//   Parte: A            (opcional)
//   Puntaje: 25
//   (markdown del enunciado)
//   ### Rúbrica
//   - [5] Criterio | Completo: ... | Parcial: ... | Ausente: ...
//   ### No suma
//   - Lo que no suma puntos

export type CriterioImportado = {
  descripcion: string;
  puntaje: number;
  completo: string;
  parcial: string;
  ausente: string;
};

export type ConsignaImportada = {
  titulo: string;
  parte: string | null;
  puntaje: number;
  enunciadoHtml: string;
  criterios: CriterioImportado[];
  noSuma: string;
};

export type TemaImportado = {
  numero: number;
  titulo: string;
  casoHtml: string;
  consignas: ConsignaImportada[];
};

export class ErrorImportacion extends Error {
  constructor(linea: number, mensaje: string) {
    super(`Línea ${linea}: ${mensaje}`);
  }
}

function mdAHtml(md: string): string {
  return sanitizar(marked.parse(md.trim(), { async: false, gfm: true }) as string);
}

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function parseNumero(s: string): number {
  return Number(s.trim().replace(",", "."));
}

export function importarTemas(markdown: string): TemaImportado[] {
  const lineas = markdown.replace(/\r\n?/g, "\n").split("\n");
  const temas: TemaImportado[] = [];

  type Seccion = "nada" | "caso" | "enunciado" | "rubrica" | "nosuma";
  let seccion: Seccion = "nada";
  let tema: TemaImportado | null = null;
  let consigna: (ConsignaImportada & { _md: string[]; _noSuma: string[]; _linea: number }) | null = null;
  let casoMd: string[] = [];
  let enMetadatos = false;

  const cerrarConsigna = () => {
    if (!consigna || !tema) return;
    consigna.enunciadoHtml = mdAHtml(consigna._md.join("\n"));
    consigna.noSuma = consigna._noSuma.join("\n");
    if (!consigna.enunciadoHtml) throw new ErrorImportacion(consigna._linea, `la consigna "${consigna.titulo}" no tiene enunciado.`);
    if (!(consigna.puntaje > 0)) throw new ErrorImportacion(consigna._linea, `la consigna "${consigna.titulo}" no tiene "Puntaje:".`);
    if (consigna.criterios.length) {
      const suma = consigna.criterios.reduce((a, c) => a + c.puntaje, 0);
      if (Math.abs(suma - consigna.puntaje) > 0.001) {
        throw new ErrorImportacion(
          consigna._linea,
          `la rúbrica de "${consigna.titulo}" suma ${suma} pero la consigna vale ${consigna.puntaje}.`,
        );
      }
    }
    const { _md, _noSuma, _linea, ...limpia } = consigna;
    void _md; void _noSuma; void _linea;
    tema.consignas.push(limpia);
    consigna = null;
  };

  const cerrarTema = (linea: number) => {
    cerrarConsigna();
    if (!tema) return;
    tema.casoHtml = mdAHtml(casoMd.join("\n"));
    if (!tema.casoHtml) throw new ErrorImportacion(linea, `el tema ${tema.numero} no tiene caso (todos los exámenes tienen caso).`);
    if (!tema.consignas.length) throw new ErrorImportacion(linea, `el tema ${tema.numero} no tiene consignas.`);
    temas.push(tema);
    tema = null;
    casoMd = [];
  };

  lineas.forEach((linea, i) => {
    const n = i + 1;
    const h1 = /^#\s+(.+)$/.exec(linea);
    const h2 = /^##\s+(.+)$/.exec(linea);
    const h3 = /^###\s+(.+)$/.exec(linea);

    if (h1) {
      cerrarTema(n);
      const m = /^tema\s+(\d+)\s*[:\-–—]?\s*(.*)$/i.exec(h1[1].trim());
      if (!m) throw new ErrorImportacion(n, 'se esperaba "# Tema N: Título".');
      const numero = Number(m[1]);
      if (temas.some((t) => t.numero === numero)) throw new ErrorImportacion(n, `el tema ${numero} está repetido.`);
      tema = { numero, titulo: m[2].trim() || `Tema ${numero}`, casoHtml: "", consignas: [] };
      seccion = "nada";
      return;
    }

    if (h2) {
      if (!tema) throw new ErrorImportacion(n, 'falta "# Tema N: Título" antes de esta sección.');
      const titulo = h2[1].trim();
      const t = sinTildes(titulo);
      if (t === "caso" || t.startsWith("caso:") || t.startsWith("caso ")) {
        cerrarConsigna();
        seccion = "caso";
        return;
      }
      const m = /^consigna\s*[:\-–—]?\s*(.+)$/i.exec(titulo);
      if (!m) throw new ErrorImportacion(n, 'se esperaba "## Caso" o "## Consigna: Título".');
      cerrarConsigna();
      consigna = {
        titulo: m[1].trim(), parte: null, puntaje: 0, enunciadoHtml: "",
        criterios: [], noSuma: "", _md: [], _noSuma: [], _linea: n,
      };
      seccion = "enunciado";
      enMetadatos = true;
      return;
    }

    if (h3) {
      if (!consigna) throw new ErrorImportacion(n, "esta sección debe ir dentro de una consigna.");
      const t = sinTildes(h3[1].trim());
      if (t.startsWith("rubrica")) seccion = "rubrica";
      else if (t.startsWith("no suma")) seccion = "nosuma";
      else throw new ErrorImportacion(n, 'se esperaba "### Rúbrica" o "### No suma".');
      return;
    }

    if (seccion === "caso") {
      casoMd.push(linea);
    } else if (seccion === "enunciado" && consigna) {
      if (enMetadatos) {
        const meta = /^(parte|puntaje)\s*:\s*(.+)$/i.exec(linea.trim());
        if (meta) {
          if (sinTildes(meta[1]) === "parte") consigna.parte = meta[2].trim().toUpperCase().slice(0, 10);
          else {
            const p = parseNumero(meta[2].replace(/puntos?/i, ""));
            if (!Number.isFinite(p) || p <= 0) throw new ErrorImportacion(n, "puntaje inválido.");
            consigna.puntaje = p;
          }
          return;
        }
        if (linea.trim()) enMetadatos = false;
      }
      consigna._md.push(linea);
    } else if (seccion === "rubrica" && consigna) {
      if (!linea.trim()) return;
      const m = /^\s*[-*]\s*\[\s*(\d+(?:[.,]\d+)?)\s*\]\s*(.+)$/.exec(linea);
      if (!m) throw new ErrorImportacion(n, 'criterio de rúbrica inválido; formato: "- [5] Criterio | Completo: ... | Parcial: ... | Ausente: ...".');
      const partes = m[2].split("|").map((p) => p.trim());
      const criterio: CriterioImportado = { descripcion: partes[0], puntaje: parseNumero(m[1]), completo: "", parcial: "", ausente: "" };
      for (const p of partes.slice(1)) {
        const kv = /^(completo|parcial|ausente)\s*:\s*(.*)$/i.exec(p);
        if (!kv) throw new ErrorImportacion(n, `no se entiende "${p}" (se esperaba Completo:, Parcial: o Ausente:).`);
        criterio[sinTildes(kv[1]) as "completo" | "parcial" | "ausente"] = kv[2].trim();
      }
      consigna.criterios.push(criterio);
    } else if (seccion === "nosuma" && consigna) {
      const m = /^\s*[-*]\s*(.+)$/.exec(linea);
      if (m) consigna._noSuma.push(m[1].trim());
      else if (linea.trim()) consigna._noSuma.push(linea.trim());
    } else if (linea.trim() && !tema) {
      throw new ErrorImportacion(n, 'el archivo debe empezar con "# Tema N: Título".');
    }
  });

  cerrarTema(lineas.length);
  if (!temas.length) throw new ErrorImportacion(1, "no se encontró ningún tema.");
  return temas;
}

// ---------------------------------------------------------------------------
// Importación de alumnos desde CSV (separador coma o punto y coma).
// Columnas: lu, nombre, mail, tema, parte (opcional), sin_seb (opcional: si/no)

export type FilaAlumno = { lu: string; nombre: string; mail: string; tema: number; parte: string | null; sinSeb: boolean };

export function parsearCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const primera = t.split("\n")[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim()));
}

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function importarAlumnos(csv: string): FilaAlumno[] {
  const filas = parsearCsv(csv);
  if (filas.length < 2) throw new ErrorImportacion(1, "el CSV debe tener encabezado y al menos un alumno.");
  const enc = filas[0].map((h) => sinTildes(h.trim()).replace(/\s+/g, "_"));
  const col = (nombre: string) => enc.indexOf(nombre);
  for (const req of ["lu", "nombre", "mail", "tema"]) {
    if (col(req) === -1) throw new ErrorImportacion(1, `falta la columna "${req}". Columnas: lu, nombre, mail, tema, parte, sin_seb.`);
  }
  const vistos = new Set<string>();
  return filas.slice(1).map((f, i) => {
    const n = i + 2;
    const v = (nombre: string) => (col(nombre) === -1 ? "" : (f[col(nombre)] ?? "").trim());
    const lu = v("lu").replace(/\.0+$/, "");
    if (!lu) throw new ErrorImportacion(n, "falta el LU.");
    if (vistos.has(lu)) throw new ErrorImportacion(n, `el LU ${lu} está repetido.`);
    vistos.add(lu);
    const nombre = v("nombre");
    if (!nombre) throw new ErrorImportacion(n, "falta el nombre.");
    const mail = v("mail");
    if (!MAIL.test(mail)) throw new ErrorImportacion(n, `mail inválido: "${mail}".`);
    const tema = Number(v("tema"));
    if (!Number.isInteger(tema) || tema < 1) throw new ErrorImportacion(n, "tema inválido (debe ser el número de tema).");
    const parte = v("parte").toUpperCase() || null;
    const sinSeb = ["si", "sí", "s", "1", "true", "x"].includes(sinTildes(v("sin_seb")));
    return { lu, nombre, mail, tema, parte, sinSeb };
  });
}
