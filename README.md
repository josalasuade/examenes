# Plataforma de Exámenes Digitales — Etapa 1

Reemplaza el circuito Google Sheets + Forms + Apps Script (carpeta `GAS/`,
histórica). Especificación completa: [`docs/especificaciones.md`](docs/especificaciones.md).

**Etapa 1 (este código):** carga de exámenes por Markdown, alumnos por CSV,
rendición con Safe Exam Browser, autoguardado, reingreso aprobado por el
docente, monitoreo (pegados y salidas de ventana), entrega definitiva, PDF con
código de verificación, mail con el PDF y panel docente.
**Etapa 2 (pendiente):** todo lo de IA (generación de temas y corrección).

## Stack

- **Next.js 16** (React + API en el mismo proyecto), TypeScript.
- **Postgres** (local en Docker; en producción, Supabase).
- **PDF** en el servidor (pdfmake), **mail** por SMTP (nodemailer).
- Producción prevista: **Vercel + Supabase** (ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)).

## Levantar todo local con Docker (recomendado)

Requisitos: Docker Desktop.

1. Copiar `.env.example` a `.env` y completar `ADMIN_PASSWORD` y `SESSION_SECRET`.
   Para generar el secreto:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Levantar:

   ```bash
   docker compose up --build
   ```

3. Abrir:
   - Alumnos: http://localhost:3000
   - Docente: http://localhost:3000/admin
   - Mails enviados (Mailpit): http://localhost:8025

Las migraciones de la base se aplican solas al arrancar.

## Desarrollo con recarga automática

Requisitos: Docker Desktop y Node.js 22 o superior.

```bash
npm install
```

```bash
docker compose up -d db mail
```

```bash
npm run migrate
```

```bash
npm run dev
```

## Primer uso (panel docente)

1. **Carreras** (`/admin/carreras`): cargar la lista que ven los alumnos.
2. **+ Nuevo examen** → pestaña **Temas** → importar el Markdown del examen
   (formato en [`docs/FORMATO_IMPORTACION.md`](docs/FORMATO_IMPORTACION.md);
   ejemplo en [`docs/ejemplos/examen-ejemplo.md`](docs/ejemplos/examen-ejemplo.md)).
3. **Alumnos** → importar CSV (`lu;nombre;mail;tema;parte;sin_seb`; ejemplo en
   [`docs/ejemplos/alumnos-ejemplo.csv`](docs/ejemplos/alumnos-ejemplo.csv)).
4. **Datos** → código de ingreso + Config Key del `.seb` → **Publicar**.
5. El día del examen, en **En vivo**: dictar el código, **Abrir** la ventana de
   ingreso, aprobar reingresos y seguir los indicadores.
6. **Resultados** → cargar el puntaje final (0–100) y **Exportar CSV**.

Para probar sin SEB: en **Datos**, destildar "Requiere Safe Exam Browser", o
exceptuar al alumno en **Alumnos → Editar**.

## Pruebas

```bash
npm test
```

```bash
npm run typecheck
```

Prueba de punta a punta (con la app levantada y la base vacía; requiere
Playwright: `npm i -D playwright` y `npx playwright install chromium`):

```bash
npm run e2e
```

## Estructura

```
src/app/            páginas (alumno en /, docente en /admin) y API (src/app/api)
src/cliente/        componentes de interfaz (alumno, panel docente, editor)
src/lib/            lógica de servidor: base, auth, SEB, PDF, mail, entregas
supabase/migrations esquema de la base (SQL)
scripts/migrate.mjs aplica las migraciones
tests/              pruebas unitarias (vitest) y de punta a punta
docs/               especificación, formato de importación, despliegue, ejemplos
GAS/                sistema anterior (solo referencia)
```

## Reglas del repo

- El repo es **público**: nunca subir `.env`, planillas con datos de alumnos,
  claves de SEB ni exámenes reales que no se hayan tomado. `.gitignore` ya
  excluye `.env`, `*.xlsx` y las carpetas `datos/` y `privado/`.
- Los secretos van solo en `.env` (local) o en las variables de entorno de
  Vercel (producción).
