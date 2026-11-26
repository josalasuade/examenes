import PdfPrinter from "pdfmake";
import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import htmlToPdfmake from "html-to-pdfmake";
import { JSDOM } from "jsdom";
import { filasEscala, type Banda } from "./escala";
import { fechaCalendario, fechaHora } from "./fechas";
import { formatearCodigo } from "./hashEntrega";
import { LOGO_UADE_DATA_URL } from "./logo";

// PDF de la entrega del alumno, según el modelo de parcial UADE:
//   pág. 1: encabezado, datos del alumno, consignas generales, escala
//   pág. 2: caso
//   pág. 3+: respuestas por consigna

export type DatosPdf = {
  examen: {
    departamento: string;
    materia: string;
    docente: string;
    instancia: string;
    fecha: Date | string;
    duracionMin: number;
    consignasGenerales: string;
    condicionesAprobacion: string;
    escala: Banda[];
  };
  tema: { numero: number; titulo: string; casoHtml: string };
  alumno: { nombre: string; lu: string; carrera: string };
  iniciadoEn: Date | string | null;
  entregadoEn: Date | string;
  hash: string;
  consignas: { orden: number; titulo: string; parte: string | null; puntaje: number; enunciadoHtml: string; respuestaHtml: string }[];
};

let impresora: PdfPrinter | null = null;
function obtenerImpresora(): PdfPrinter {
  if (!impresora) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vfs = require("pdfmake/build/vfs_fonts.js") as Record<string, string>;
    const b = (n: string) => Buffer.from(vfs[n], "base64");
    impresora = new PdfPrinter({
      Roboto: {
        normal: b("Roboto-Regular.ttf"),
        bold: b("Roboto-Medium.ttf"),
        italics: b("Roboto-Italic.ttf"),
        bolditalics: b("Roboto-MediumItalic.ttf"),
      },
    });
  }
  return impresora;
}

/** Tablas de respuestas: columnas de igual ancho (así una columna vacía no queda aplastada). */
function anchosParejos(nodo: unknown): void {
  if (Array.isArray(nodo)) {
    nodo.forEach(anchosParejos);
    return;
  }
  if (!nodo || typeof nodo !== "object") return;
  const n = nodo as { table?: { body?: unknown[][]; widths?: unknown }; [k: string]: unknown };
  if (n.table?.body?.length) {
    const columnas = Math.max(...n.table.body.map((fila) => fila.reduce<number>((a, c) => a + Number((c as { colSpan?: number })?.colSpan ?? 1), 0)));
    n.table.widths = Array(columnas).fill("*");
  }
  for (const v of Object.values(n)) if (v && typeof v === "object") anchosParejos(v);
}

let ventana: Window | null = null;
function html(h: string): Content {
  if (!ventana) ventana = new JSDOM("").window as unknown as Window;
  const contenido = htmlToPdfmake(h || "<p></p>", {
    window: ventana,
    defaultStyles: {
      p: { margin: [0, 2, 0, 6] },
      table: { margin: [0, 4, 0, 8] },
      th: { bold: true, fillColor: "#eeeeee" },
      h1: { fontSize: 15, bold: true, margin: [0, 6, 0, 4] },
      h2: { fontSize: 13, bold: true, margin: [0, 6, 0, 4] },
      h3: { fontSize: 12, bold: true, margin: [0, 4, 0, 4] },
      h4: { fontSize: 11, bold: true, margin: [0, 4, 0, 4] },
    },
  });
  anchosParejos(contenido);
  return contenido as Content;
}

function etiqueta(titulo: string, valor: string): Content {
  return { text: [{ text: titulo, decoration: "underline" }, `: ${valor}`], fontSize: 10 };
}

export function definicionPdf(d: DatosPdf): TDocumentDefinitions {
  const ex = d.examen;
  const escala = filasEscala(ex.escala);
  const filaPuntaje: TableCell[] = [{ text: "Puntaje", bold: true }, ...escala.map((f) => ({ text: f.rango, alignment: "center" as const }))];
  const filaNota: TableCell[] = [{ text: "Nota", bold: true }, ...escala.map((f) => ({ text: f.nota, alignment: "center" as const }))];

  const respuestas: Content[] = d.consignas.flatMap((c, i) => [
    {
      text: `Consigna ${i + 1}${c.parte ? ` (${c.parte})` : ""} — ${c.titulo} — ${c.puntaje} puntos`,
      bold: true,
      fontSize: 12,
      margin: [0, i === 0 ? 0 : 14, 0, 4],
    },
    { stack: [html(c.enunciadoHtml)], fontSize: 9, color: "#555555", margin: [0, 0, 0, 4] },
    { text: "Respuesta:", bold: true, fontSize: 10, margin: [0, 2, 0, 2] },
    c.respuestaHtml.trim()
      ? { stack: [html(c.respuestaHtml)], fontSize: 10 }
      : { text: "(sin respuesta)", italics: true, color: "#888888", fontSize: 10 },
  ]);

  return {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    info: { title: `${ex.materia} - ${ex.instancia} - ${d.alumno.lu}` },
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.15 },
    footer: (pagina, total) => ({
      columns: [
        { text: `Código de verificación: ${formatearCodigo(d.hash).slice(0, 19)}…`, fontSize: 7, color: "#777777" },
        { text: `Página ${pagina} de ${total}`, alignment: "right", fontSize: 7, color: "#777777" },
      ],
      margin: [40, 20, 40, 0],
    }),
    content: [
      {
        columns: [
          { image: LOGO_UADE_DATA_URL, width: 80 },
          { text: ex.departamento, fontSize: 16, margin: [20, 14, 0, 0] },
        ],
      },
      {
        columns: [
          { stack: [etiqueta("MATERIA", ex.materia.toUpperCase()), etiqueta("Docente", ex.docente.toUpperCase())], width: "*" },
          { text: `Tema: ${d.tema.numero}`, fontSize: 13, alignment: "center", width: 90, margin: [0, 6, 0, 0] },
          { stack: [etiqueta("Instancia", ex.instancia), etiqueta("Fecha", fechaCalendario(ex.fecha))], width: 150 },
        ],
        margin: [0, 14, 0, 14],
        columnGap: 10,
      },
      {
        table: {
          widths: ["*", 170],
          body: [
            [
              { text: [{ text: "NOMBRE Y APELLIDO: ", fontSize: 8 }, { text: d.alumno.nombre, bold: true }] },
              { text: [{ text: "LU: ", fontSize: 8 }, { text: d.alumno.lu, bold: true }] },
            ],
            [
              { text: [{ text: "Carrera: ", fontSize: 8 }, { text: d.alumno.carrera, bold: true }] },
              { text: [{ text: "Inicio: ", fontSize: 8 }, fechaHora(d.iniciadoEn)] },
            ],
            [
              { text: [{ text: "Código de verificación: ", fontSize: 8 }, { text: formatearCodigo(d.hash), fontSize: 7.5 }] },
              { text: [{ text: "Entrega: ", fontSize: 8 }, fechaHora(d.entregadoEn)] },
            ],
          ],
        },
        margin: [0, 0, 0, 0],
      },
      {
        table: {
          widths: ["*"],
          body: [[
            {
              stack: [
                { text: "Consignas para desarrollo del examen", bold: true, margin: [0, 0, 0, 2] },
                { text: ex.consignasGenerales, fontSize: 8.5 },
                ...(ex.condicionesAprobacion
                  ? [{ text: [{ text: "Condiciones de aprobación: ", bold: true }, ex.condicionesAprobacion], fontSize: 8.5, margin: [0, 6, 0, 0] } as Content]
                  : []),
                { text: [{ text: "Duración del examen: ", bold: true }, `${ex.duracionMin} minutos.`], fontSize: 8.5 },
                { text: "Escala de Notas:", bold: true, fontSize: 8.5, margin: [0, 2, 0, 2] },
                {
                  table: { widths: ["auto", ...escala.map(() => "*")], body: [filaPuntaje, filaNota] },
                  fontSize: 8.5,
                },
              ],
            },
          ]],
        },
        margin: [0, -1, 0, 0],
      },
      { text: `Caso: ${d.tema.titulo}`, bold: true, fontSize: 13, pageBreak: "before", margin: [0, 0, 0, 8] },
      html(d.tema.casoHtml),
      { text: "Respuestas:", bold: true, fontSize: 13, pageBreak: "before", margin: [0, 0, 0, 10] },
      ...respuestas,
    ],
  };
}

export function generarPdf(d: DatosPdf): Promise<Buffer> {
  const doc = obtenerImpresora().createPdfKitDocument(definicionPdf(d));
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on("data", (c: Buffer) => partes.push(c));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    doc.end();
  });
}
