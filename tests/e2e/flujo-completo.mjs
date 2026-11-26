// Prueba de punta a punta del flujo completo (docente + alumnos).
//
// Requisitos: la app corriendo (APP_URL), una base vacía y Mailpit en :8025.
// Uso:  APP_URL=http://localhost:3000 ADMIN_PASSWORD=... node tests/e2e/flujo-completo.mjs
// Necesita Playwright (npm i -D playwright && npx playwright install chromium).
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const PASS = process.env.ADMIN_PASSWORD ?? "clave-de-prueba";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const CAPTURAS = process.env.CAPTURAS ?? "";
const SEB_KEY = "a".repeat(64);
const SEB_HASH = createHash("sha256").update(`${APP}/` + SEB_KEY).digest("hex");
const ejemplo = (f) => readFileSync(new URL(`../../docs/ejemplos/${f}`, import.meta.url), "utf8");

let fallas = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    fallas++;
    console.log(`  ✗ ${msg}`);
  }
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
/** Espera hasta 5 s a que el elemento sea visible. */
const visible = (loc, timeout = 5000) => loc.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);
async function captura(page, nombre) {
  if (!CAPTURAS) return;
  mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: false });
}

const browser = await chromium.launch();
const ctxSeb = async () => {
  const c = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  await c.addInitScript((h) => {
    window.SafeExamBrowser = { security: { configKey: h, browserExamKey: "x" } };
  }, SEB_HASH);
  return c;
};

// ---------------------------------------------------------------- docente
console.log("Docente: login, examen, temas, alumnos, publicación");
const docCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const doc = await docCtx.newPage();
await doc.goto(`${APP}/admin`);
await doc.fill('input[type="password"]', "incorrecta");
await doc.click("text=Ingresar");
ok(await visible(doc.locator("text=Contraseña incorrecta")), "rechaza contraseña incorrecta");
await doc.fill('input[type="password"]', PASS);
await doc.click("text=Ingresar");
await doc.waitForSelector("text=+ Nuevo examen");

const api = async (ruta, metodo = "GET", cuerpo) => {
  const r = await doc.request.fetch(`${APP}${ruta}`, { method: metodo, data: cuerpo, headers: { Origin: APP } });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status(), body: j };
};

await api("/api/admin/carreras", "POST", { nombre: "Ingeniería en Informática" });
await api("/api/admin/carreras", "POST", { nombre: "Licenciatura en Sistemas" });

await doc.click("text=+ Nuevo examen");
await doc.locator(".modal label:has-text('Docente') input").fill("Docente de Prueba");
await doc.locator(".modal button:has-text('Crear')").click();
await doc.waitForURL(/\/admin\/examenes\//);
const examenId = doc.url().split("/").pop();
ok(!!examenId, "examen creado");

await doc.click("role=tab[name='Temas']");
await doc.fill("textarea.mono", ejemplo("examen-ejemplo.md"));
await doc.click("button:has-text('Importar')");
ok(await visible(doc.locator("text=Importado: Tema 1 (3 consignas), Tema 2 (1 consignas)")), "importa temas desde Markdown");
const rubricaMala = await api(`/api/admin/examenes/${examenId}/importar`, "POST", { markdown: ejemplo("examen-ejemplo.md").replace("[20] Clasificación", "[10] Clasificación") });
ok(rubricaMala.status === 400 && /suma/.test(rubricaMala.body.error), "rechaza rúbrica que no suma el puntaje");
await captura(doc, "01-temas");

await doc.click("role=tab[name='Alumnos']");
await doc.fill("textarea.mono", ejemplo("alumnos-ejemplo.csv"));
await doc.click("button:has-text('Importar')");
ok(await visible(doc.locator("text=Importado: 4 nuevos")), "importa alumnos desde CSV");

await doc.click("role=tab[name='Datos']");
await doc.locator("label:has-text('Código de ingreso') input").fill("PRUEBA-26");
await doc.locator("label:has-text('Config Key') input").fill(SEB_KEY);
await doc.click("button:has-text('Guardar')");
await doc.waitForSelector("text=Guardado.");
await doc.click("button:has-text('Publicar')");
await doc.locator(".modal button:has-text('Publicar')").click();
await doc.waitForSelector(".etiqueta:has-text('Publicado')");
ok(true, "examen publicado");

// ---------------------------------------------------------------- alumnos
console.log("Alumnos: ingreso, SEB, ventana de ingreso");
const a1ctx = await ctxSeb();
const a1 = await a1ctx.newPage();
await a1.goto(APP);
await a1.locator("label:has-text('Código') input").fill("prueba-26");
await a1.locator("label:has-text('LU') input").fill("1000001");
await a1.click("button:has-text('Ingresar')");
ok(await visible(a1.locator("text=El ingreso no está habilitado")), "sin ventana de ingreso abierta, no entra");

const sinSebCtx = await browser.newContext();
const sinSeb = await sinSebCtx.newPage();
await sinSeb.goto(APP);
await sinSeb.locator("label:has-text('Código') input").fill("PRUEBA-26");
await sinSeb.locator("label:has-text('LU') input").fill("1000003");
await sinSeb.click("button:has-text('Ingresar')");
ok(await visible(sinSeb.locator("text=Safe Exam Browser")), "sin SEB (y sin excepción) no entra");

const sebFalsoCtx = await browser.newContext();
await sebFalsoCtx.addInitScript(() => { window.SafeExamBrowser = { security: { configKey: "b".repeat(64) } }; });
const sebFalso = await sebFalsoCtx.newPage();
await sebFalso.goto(APP);
await sebFalso.locator("label:has-text('Código') input").fill("PRUEBA-26");
await sebFalso.locator("label:has-text('LU') input").fill("1000003");
await sebFalso.click("button:has-text('Ingresar')");
ok(await visible(sebFalso.locator("text=no es la oficial")), "SEB con otra configuración no entra");

await doc.click("role=tab[name='En vivo']");
await doc.click("button:has-text('Abrir por 10 min')");
await doc.waitForSelector("text=Abierta");
await captura(doc, "02-en-vivo-abierto");

await a1.click("button:has-text('Ingresar')");
await a1.waitForSelector("text=Comenzar examen");
ok(true, "alumno con SEB oficial ingresa");
await a1.selectOption("select", "Ingeniería en Informática");
await a1.click("button:has-text('Comenzar examen')");
await a1.locator(".modal button:has-text('Comenzar')").click();
await a1.waitForSelector("text=Caso: BiciRed");
const consignasA = await a1.locator("article.consigna").count();
ok(consignasA === 2, `alumno de parte A ve solo las consignas A (ve ${consignasA})`);

const ed1 = a1.locator(".editor-contenido").nth(0);
await ed1.click();
await a1.keyboard.type("Los problemas principales son el despliegue manual y la falta de registro. ");
await a1.click("button[title='Insertar tabla 3×3']");
await a1.keyboard.type("Indicador");
// Pegado externo simulado
await ed1.evaluate((el) => {
  const dt = new DataTransfer();
  dt.setData("text/plain", "Texto que viene de afuera del examen, por ejemplo de una IA.");
  el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
// Salida de la ventana de 2,5 s
await a1.evaluate(() => window.dispatchEvent(new Event("blur")));
await esperar(2500);
await a1.evaluate(() => window.dispatchEvent(new Event("focus")));
const ed2 = a1.locator(".editor-contenido").nth(1);
await ed2.click();
await a1.keyboard.type("Clasificaría el incidente como grave porque afectó 15 estaciones.");
await a1.waitForSelector("text=/Guardado \\d/", { timeout: 15000 });
ok(true, "autoguardado");
await esperar(6000);
await captura(a1, "03-examen-alumno");

console.log("Reingreso con aprobación docente");
await a1ctx.close();
const a1bCtx = await ctxSeb();
const a1b = await a1bCtx.newPage();
await a1b.goto(APP);
await a1b.locator("label:has-text('Código') input").fill("PRUEBA-26");
await a1b.locator("label:has-text('LU') input").fill("1000001");
await a1b.click("button:has-text('Ingresar')");
await a1b.waitForSelector("text=Reingreso pendiente");
ok(true, "segundo ingreso queda pendiente de aprobación");
await doc.waitForSelector("text=Solicitudes de reingreso", { timeout: 10000 });
await captura(doc, "04-reingreso");
await doc.click(".alerta button:has-text('Aprobar')");
await a1b.waitForSelector("text=Caso: BiciRed", { timeout: 15000 });
const textoRecuperado = await a1b.locator(".editor-contenido").nth(1).innerText();
ok(textoRecuperado.includes("15 estaciones"), "al reingresar recupera las respuestas guardadas");
ok(await a1b.locator(".editor-contenido table").count() === 1, "la tabla se conservó");

console.log("Entrega, PDF y mail");
await a1b.click("header button:has-text('Entregar')");
await a1b.locator(".modal button:has-text('Entregar definitivamente')").click();
try {
  await a1b.waitForSelector("text=Entrega recibida", { timeout: 20000 });
} catch (e) {
  await a1b.screenshot({ path: "falla-entrega.png" });
  console.log("  modal:", await a1b.locator(".modal").innerText().catch(() => "(sin modal)"));
  throw e;
}
const codigo = (await a1b.locator("code.codigo").innerText()).trim();
ok(/^[0-9A-F]{4}(-[0-9A-F]{4}){15}$/.test(codigo), "muestra código de verificación");
const pdf = await a1b.request.get(`${APP}/api/alumno/pdf`);
const pdfBytes = await pdf.body();
ok(pdf.status() === 200 && pdfBytes.subarray(0, 5).toString() === "%PDF-", "el alumno descarga el PDF");
await captura(a1b, "05-entregado");
const editar = await a1b.request.fetch(`${APP}/api/alumno/respuesta`, { method: "PUT", data: { consignaId: "00000000-0000-0000-0000-000000000000", html: "x" }, headers: { Origin: APP, "x-seb-url": `${APP}/`, "x-seb-ck": SEB_HASH } });
ok(editar.status() === 409, "después de entregar no se puede editar");

await esperar(1500);
const mails = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
const m1 = mails.messages.find((m) => m.To[0].Address === "uno@ejemplo.test");
ok(!!m1 && m1.Attachments === 1, "mail con PDF adjunto enviado al alumno");

console.log("Alumno habilitado sin SEB (pantalla completa) y cierre del examen");
const a2ctx = await browser.newContext();
const a2 = await a2ctx.newPage();
await a2.goto(APP);
await a2.locator("label:has-text('Código') input").fill("PRUEBA-26");
await a2.locator("label:has-text('LU') input").fill("1000002");
await a2.click("button:has-text('Ingresar')");
await a2.waitForSelector("text=Comenzar examen");
ok(true, "alumno exceptuado entra sin SEB");
await a2.selectOption("select", "Licenciatura en Sistemas");
await a2.click("button:has-text('Comenzar examen')");
await a2.locator(".modal button:has-text('Comenzar')").click();
await a2.waitForSelector("text=Caso: BiciRed");
ok(await a2.locator("article.consigna").count() === 1, "alumno de parte B ve solo la consigna B");
await a2.locator(".editor-contenido").first().click();
await a2.keyboard.type("Usaría un despliegue canario por estaciones.");
await a2.waitForSelector("text=/Guardado \\d/", { timeout: 15000 });

console.log("Vencimiento automático");
const a3ctx = await ctxSeb();
const a3 = await a3ctx.newPage();
await a3.goto(APP);
await a3.locator("label:has-text('Código') input").fill("PRUEBA-26");
await a3.locator("label:has-text('LU') input").fill("1000003");
await a3.click("button:has-text('Ingresar')");
await a3.waitForSelector("text=Comenzar examen");
await a3.selectOption("select", "Ingeniería en Informática");
await a3.click("button:has-text('Comenzar examen')");
await a3.locator(".modal button:has-text('Comenzar')").click();
await a3.waitForSelector("text=Caso: ParkNow");
await a3.locator(".editor-contenido").first().click();
await a3.keyboard.type("Respuesta parcial antes del vencimiento.");
await a3.waitForSelector("text=/Guardado \\d/", { timeout: 15000 });

if (process.env.DATABASE_URL) {
  // Simula que se cumplió el tiempo de la alumna 3 (sin esperar 2 horas).
  const { default: postgres } = await import("postgres");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  await sql`update asignaciones set vence_en = now() - interval '1 minute'
            where alumno_id = (select id from alumnos where lu = '1000003')`;
  await sql.end();
  await a3.reload();
  ok(await visible(a3.locator("text=Entrega recibida"), 20000), "al vencer el tiempo el examen se entrega solo");
  const r = await api(`/api/admin/examenes/${examenId}/alumnos`);
  const tres = r.body.find((x) => x.lu === "1000003");
  ok(tres.estado === "entregado" && tres.entrega_tipo === "vencimiento", "queda registrado como entrega por tiempo");
} else {
  console.log("  (sin DATABASE_URL: se omite la prueba de vencimiento)");
}

// Panel en vivo: indicadores
await doc.reload();
await doc.waitForSelector("text=Ventana de ingreso");
await esperar(1000);
const filaUno = doc.locator("tr", { hasText: "Alumna Prueba Uno" });
ok(await visible(filaUno.locator(".etiqueta.roja")), "el panel marca pegados externos / salidas del alumno");
await captura(doc, "06-en-vivo");

// Detalle con eventos
await filaUno.locator("button:has-text('Detalle')").click();
await doc.waitForSelector("text=Registro de eventos");
ok(await visible(doc.locator("text=origen EXTERNO")), "detalle muestra el pegado externo");
ok(await visible(doc.locator("text=/\\d+ s fuera/")), "detalle muestra la salida de la ventana");
await captura(doc, "07-detalle");
await doc.locator(".modal button:has-text('Cerrar')").click();

console.log("Resultados, CSV y verificación");
const cerrar = await api(`/api/admin/examenes/${examenId}/accion`, "POST", { accion: "cerrar" });
const esperadosPorCierre = process.env.DATABASE_URL ? 1 : 2;
ok(cerrar.status === 200 && cerrar.body.entregadosPorCierre === esperadosPorCierre, "cerrar el examen entrega los que estaban rindiendo");
const alumnos = (await api(`/api/admin/examenes/${examenId}/alumnos`)).body;
const uno = alumnos.find((x) => x.lu === "1000001");
await api(`/api/admin/asignaciones/${uno.id}`, "PUT", { notaFinal: 90 });
const csv = (await api(`/api/admin/examenes/${examenId}/csv`)).body;
ok(typeof csv === "string" && /1000001;Alumna Prueba Uno;.*;90;9/.test(csv), "CSV exporta puntaje 90 → nota 9");
const ver = await api(`/api/admin/verificar?codigo=${encodeURIComponent(codigo)}`);
ok(ver.body.valido === true && ver.body.lu === "1000001", "verifica el código del PDF");
const verMal = await api(`/api/admin/verificar?codigo=${encodeURIComponent(codigo.replace(/^./, codigo[0] === "A" ? "B" : "A"))}`);
ok(verMal.body.valido === false, "rechaza un código alterado");
const mails2 = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
ok(mails2.messages.length === 3, `se envió un mail por entrega (3): ${mails2.messages.length}`);

await doc.click("role=tab[name='Resultados']");
await doc.waitForSelector("text=Exportar CSV");
await captura(doc, "08-resultados");

console.log("Seguridad básica");
const anon = await (await browser.newContext()).request.get(`${APP}/api/admin/examenes`);
ok(anon.status() === 401, "la API docente exige sesión");
const csrf = await doc.request.fetch(`${APP}/api/admin/examenes`, { method: "POST", data: {}, headers: { Origin: "https://malo.example" } });
ok(csrf.status() === 403, "rechaza requests de otro origen (CSRF)");

await browser.close();
console.log(fallas ? `\n${fallas} verificación(es) fallaron.` : "\nTodo OK.");
process.exit(fallas ? 1 : 0);
