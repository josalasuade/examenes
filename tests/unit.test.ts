import { describe, expect, it } from "vitest";
import { ESCALA_DEFECTO, filasEscala, notaDesdePuntaje, validarEscala } from "../src/lib/escala";
import { formatearCodigo, hashEntrega, normalizarCodigo } from "../src/lib/hashEntrega";
import { importarAlumnos, importarTemas, parsearCsv } from "../src/lib/importar";
import { sanitizar, textoPlano } from "../src/lib/sanitizar";
import { hashSebEsperado, validarSeb } from "../src/lib/seb";
import { firmar, verificarFirma } from "../src/lib/cripto";
import { generarPdf } from "../src/lib/pdf";

describe("escala", () => {
  it("convierte puntaje a nota UADE", () => {
    expect(notaDesdePuntaje(0)).toBe("Desaprobado");
    expect(notaDesdePuntaje(59.5)).toBe("Desaprobado");
    expect(notaDesdePuntaje(60)).toBe("4");
    expect(notaDesdePuntaje(87)).toBe("8");
    expect(notaDesdePuntaje(88)).toBe("9");
    expect(notaDesdePuntaje(100)).toBe("10");
  });
  it("arma las filas de la tabla", () => {
    const f = filasEscala(ESCALA_DEFECTO);
    expect(f[0]).toEqual({ rango: "0 - 59", nota: "Desaprobado" });
    expect(f.at(-1)).toEqual({ rango: "95 - 100", nota: "10" });
  });
  it("rechaza escalas desordenadas", () => {
    expect(() => validarEscala([{ desde: 0, nota: "D" }, { desde: 0, nota: "4" }])).toThrow();
    expect(() => validarEscala([{ desde: 10, nota: "D" }])).toThrow();
  });
});

describe("hash de entrega", () => {
  const base = { asignacionId: "a", entregadoEn: new Date("2026-11-26T12:00:00Z") };
  it("no depende del orden de las respuestas", () => {
    const h1 = hashEntrega({ ...base, respuestas: [{ consignaId: "1", html: "x" }, { consignaId: "2", html: "y" }] });
    const h2 = hashEntrega({ ...base, respuestas: [{ consignaId: "2", html: "y" }, { consignaId: "1", html: "x" }] });
    expect(h1).toBe(h2);
  });
  it("cambia si cambia una respuesta", () => {
    const h1 = hashEntrega({ ...base, respuestas: [{ consignaId: "1", html: "x" }] });
    const h2 = hashEntrega({ ...base, respuestas: [{ consignaId: "1", html: "x " }] });
    expect(h1).not.toBe(h2);
  });
  it("formatea y normaliza el código", () => {
    const h = "ab".repeat(32);
    const f = formatearCodigo(h);
    expect(f.startsWith("ABAB-ABAB")).toBe(true);
    expect(normalizarCodigo(f)).toBe(h);
  });
});

describe("sanitizar", () => {
  it("elimina scripts, eventos y estilos, conserva tablas", () => {
    const s = sanitizar('<p onclick="x()" style="color:red">hola<script>alert(1)</script></p><table><tr><td colspan="2">a</td></tr></table><img src=x onerror=1><a href="javascript:x">l</a>');
    expect(s).not.toMatch(/script|onclick|style|img|href/);
    expect(s).toContain('<td colspan="2">a</td>');
    expect(s).toContain("<p>hola</p>");
  });
  it("texto plano", () => {
    expect(textoPlano("<p>a &amp; b</p><p>c</p>")).toBe("a & b\nc");
  });
});

describe("SEB", () => {
  const app = "https://examenes.ejemplo.com";
  const key = "abc123";
  const url = app + "/";
  it("acepta el hash correcto de la JS API", () => {
    expect(validarSeb({ urlPagina: url + "#x", hashPagina: hashSebEsperado(url, key) }, key, app).ok).toBe(true);
  });
  it("acepta el header nativo", () => {
    const u = app + "/api/alumno/estado";
    expect(validarSeb({ hashHeader: hashSebEsperado(u, key), urlRequest: u }, key, app).ok).toBe(true);
  });
  it("rechaza hash de otra configuración", () => {
    expect(validarSeb({ urlPagina: url, hashPagina: hashSebEsperado(url, "otra") }, key, app).ok).toBe(false);
  });
  it("rechaza URL de otro origen", () => {
    const otra = "https://malo.com/";
    expect(validarSeb({ urlPagina: otra, hashPagina: hashSebEsperado(otra, key) }, key, app).ok).toBe(false);
  });
  it("rechaza sin datos de SEB", () => {
    expect(validarSeb({}, key, app).ok).toBe(false);
  });
});

describe("firma de cookies", () => {
  it("verifica y detecta alteraciones", () => {
    const t = firmar({ rol: "docente", exp: 1 }, "s".repeat(32));
    expect(verificarFirma(t, "s".repeat(32))).toEqual({ rol: "docente", exp: 1 });
    expect(verificarFirma(t, "x".repeat(32))).toBeNull();
    expect(verificarFirma(t.replace(/^./, "A"), "s".repeat(32))).toBeNull();
  });
});

const MD = `# Tema 1: GateFlow

## Caso

GateFlow desarrolla una **plataforma**.

| A | B |
|---|---|
| 1 | 2 |

## Consigna: Proceso y estrategia
Parte: A
Puntaje: 10

Proponga una estrategia.

### Rúbrica
- [6] Identifica problemas | Completo: todos | Parcial: algunos | Ausente: ninguno
- [4] Prioriza

### No suma
- Decir "usar Agile" sin justificar

## Consigna: Release
Parte: B
Puntaje: 10

Diseñe la estrategia de release.

# Tema 2: Otro caso
## Caso
Texto del caso 2.
## Consigna: Única
Puntaje: 100
Explique.
`;

describe("importar temas", () => {
  it("parsea temas, consignas, partes, rúbrica y no suma", () => {
    const t = importarTemas(MD);
    expect(t).toHaveLength(2);
    expect(t[0].titulo).toBe("GateFlow");
    expect(t[0].casoHtml).toContain("<table>");
    expect(t[0].consignas).toHaveLength(2);
    const c = t[0].consignas[0];
    expect(c).toMatchObject({ titulo: "Proceso y estrategia", parte: "A", puntaje: 10 });
    expect(c.enunciadoHtml).toBe("<p>Proponga una estrategia.</p>");
    expect(c.criterios).toEqual([
      { descripcion: "Identifica problemas", puntaje: 6, completo: "todos", parcial: "algunos", ausente: "ninguno" },
      { descripcion: "Prioriza", puntaje: 4, completo: "", parcial: "", ausente: "" },
    ]);
    expect(c.noSuma).toBe('Decir "usar Agile" sin justificar');
    expect(t[1].consignas[0].parte).toBeNull();
  });
  it("valida que la rúbrica sume el puntaje", () => {
    expect(() => importarTemas(MD.replace("[4] Prioriza", "[3] Prioriza"))).toThrow(/suma 9/);
  });
  it("exige caso", () => {
    expect(() => importarTemas("# Tema 1: X\n## Consigna: Y\nPuntaje: 5\nZ")).toThrow(/no tiene caso/);
  });
  it("exige puntaje", () => {
    expect(() => importarTemas("# Tema 1: X\n## Caso\nC\n## Consigna: Y\nZ")).toThrow(/Puntaje/);
  });
});

describe("importar alumnos", () => {
  it("acepta punto y coma, comillas y LU con .0", () => {
    const filas = importarAlumnos('LU;Nombre;Mail;Tema;Parte;Sin SEB\n88267.0;"Salas, Joaquín";a@b.com;1;a;sí\n2;Pérez;c@d.com;2;;\n');
    expect(filas).toEqual([
      { lu: "88267", nombre: "Salas, Joaquín", mail: "a@b.com", tema: 1, parte: "A", sinSeb: true },
      { lu: "2", nombre: "Pérez", mail: "c@d.com", tema: 2, parte: null, sinSeb: false },
    ]);
  });
  it("detecta errores", () => {
    expect(() => importarAlumnos("lu,nombre,mail,tema\n1,A,malo,1")).toThrow(/mail/);
    expect(() => importarAlumnos("lu,nombre,mail,tema\n1,A,a@b.c,1\n1,B,b@b.c,1")).toThrow(/repetido/);
    expect(() => importarAlumnos("lu,nombre,mail\n1,A,a@b.c")).toThrow(/tema/);
  });
  it("parsea CSV con comillas escapadas", () => {
    expect(parsearCsv('a,b\n"x ""y""",z')).toEqual([["a", "b"], ['x "y"', "z"]]);
  });
});

describe("PDF", () => {
  it("genera un PDF válido", async () => {
    const pdf = await generarPdf({
      examen: {
        departamento: "Departamento de Tecnología Informática - DETIN", materia: "Ingeniería de Software",
        docente: "Docente", instancia: "1° Parcial", fecha: "2026-09-16", duracionMin: 120,
        consignasGenerales: "1. Lea.\n2. Piense.", condicionesAprobacion: "Nota 4.", escala: ESCALA_DEFECTO,
      },
      tema: { numero: 2, titulo: "GateFlow", casoHtml: "<p>Caso</p>" },
      alumno: { nombre: "Ñandú, Ana", lu: "123", carrera: "Ing. Informática" },
      iniciadoEn: new Date(), entregadoEn: new Date(), hash: "ab".repeat(32),
      consignas: [{ orden: 1, titulo: "C1", parte: "A", puntaje: 25, enunciadoHtml: "<p>E</p>", respuestaHtml: "<table><tr><td>x</td></tr></table>" }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
