// Aplica las migraciones SQL de supabase/migrations en orden, una sola vez.
// Uso: DATABASE_URL=postgres://... node scripts/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const sql = postgres(url, { max: 1, onnotice: () => {} });

async function esperarBase(intentos = 30) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await sql`select 1`;
      return;
    } catch (e) {
      if (i === intentos) throw e;
      console.log(`Esperando la base de datos (${i}/${intentos})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

try {
  await esperarBase();
  await sql`create table if not exists _migraciones (
    nombre text primary key,
    aplicada_en timestamptz not null default now()
  )`;
  const aplicadas = new Set((await sql`select nombre from _migraciones`).map((r) => r.nombre));
  const archivos = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const contenido = await readFile(path.join(dir, archivo), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(contenido);
      await tx`insert into _migraciones (nombre) values (${archivo})`;
    });
    console.log(`Migración aplicada: ${archivo}`);
  }
  console.log("Base de datos al día.");
} finally {
  await sql.end();
}
