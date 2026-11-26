# CLAUDE.md — examenes

Plataforma de exámenes digitales (UADE). Reemplaza el sistema GAS + Google
Forms de la carpeta `GAS/` (solo referencia; no se modifica).

- Especificación y decisiones: `docs/especificaciones.md` (manda ante dudas).
- Etapa 1 implementada; **Etapa 2 = todo lo de IA** (generación de temas y
  corrección con rúbrica). No mezclar IA en la Etapa 1.

## Reglas

- Repo **público**: nunca commitear `.env`, datos de alumnos, claves de SEB ni
  exámenes reales no tomados. Solo ejemplos ficticios en `docs/ejemplos/`.
- Datos de alumnos permitidos: nombre, LU, mail, carrera. Nada más (no se
  guardan IPs).
- El navegador nunca habla con la base: todo pasa por `src/app/api`. En
  Supabase, RLS activado sin políticas.
- UI: nunca `confirm()`/`alert()` nativos; usar `Modal` / `useConfirmar`.
- Entregar es definitivo. El tiempo se controla en el servidor.
- Toda acción relevante del alumno o del docente queda en la tabla `eventos`.

## Comandos

- `docker compose up --build` — todo local (app :3000, Mailpit :8025).
- `npm run dev` (con `docker compose up -d db mail` y `npm run migrate`).
- `npm test` (vitest) · `npm run typecheck` · `npm run e2e` (Playwright).
- Migraciones nuevas: agregar un `.sql` en `supabase/migrations/` con prefijo
  de fecha; `scripts/migrate.mjs` las aplica en orden una sola vez.

## Next.js

Esta versión de Next (16, con Cache Components) difiere de versiones
anteriores: leer `node_modules/next/dist/docs/` antes de usar APIs nuevas.
Los route handlers usan `manejar()` de `src/lib/http.ts`, que deja pasar los
errores internos de Next (`unstable_rethrow`).
