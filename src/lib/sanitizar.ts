import sanitizeHtml from "sanitize-html";

// Lista blanca del HTML permitido en respuestas, casos y consignas.
// Todo lo demás (scripts, estilos, eventos, iframes, links, imágenes) se descarta.
const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "hr",
    "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col",
  ],
  allowedAttributes: {
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    col: ["span"],
  },
  allowedSchemes: [],
  disallowedTagsMode: "discard",
};

export function sanitizar(html: string): string {
  return sanitizeHtml(html, OPCIONES).trim();
}

/** Texto plano aproximado (para longitudes y para el PDF si hiciera falta). */
export function textoPlano(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|li|tr|h\d|blockquote|pre)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n"), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
