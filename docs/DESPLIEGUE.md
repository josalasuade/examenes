# Despliegue y configuración

> Los paneles y planes de Vercel, Supabase, Google y SEB cambian seguido. Los
> pasos de abajo son una guía: verificá los nombres exactos de cada opción en
> la documentación vigente de cada servicio antes de aplicarlos.

## 1. Safe Exam Browser (.seb)

En **SEB Config Tool** (Windows/macOS):

1. **Start URL**: la URL pública de la app (la misma que `APP_URL`, con `/` al
   final), p. ej. `https://examenes.vercel.app/`.
2. Activar el envío de **Browser Exam Key / Config Key** (pestaña de examen;
   el nombre exacto varía según la versión).
3. **No borrar** cookies ni datos del navegador al iniciar/salir: la sesión del
   alumno vive en una cookie y así un cuelgue no lo obliga a pedir reingreso.
4. Permitir **descargas** si querés que el alumno baje el PDF desde SEB (igual
   le llega por mail).
5. Guardar el `.seb` y copiar la **Config Key** que muestra la herramienta (64
   caracteres hexadecimales). Pegarla en **Panel → examen → Datos → Config Key**.

Cómo valida la app: SEB calcula `SHA-256(URL de la página + Config Key)` y lo
expone por su API de JavaScript (y en el header
`X-SafeExamBrowser-ConfigKeyHash`). La app recalcula ese hash con la Config Key
cargada y lo compara en cada request del alumno. **Antes del primer examen real,
probá con un `.seb` de prueba**: si la versión de SEB calcula el hash de otra
forma, el ingreso va a fallar con "La configuración de Safe Exam Browser no es
la oficial del examen".

Cada vez que cambies la configuración del `.seb`, cambia la Config Key:
actualizala en el panel.

## 2. Supabase (base de datos)

1. Crear un proyecto (región cercana: São Paulo).
2. Aplicar el esquema desde tu máquina, con la **cadena de conexión directa o
   de sesión** (Project Settings → Database → Connection string):

   ```bash
   DATABASE_URL="postgresql://..." npm run migrate
   ```

3. Para la app en Vercel usar la cadena del **pooler en modo transacción**
   (puerto 6543). La app ya está configurada para ese modo (`prepare: false`).

Notas:

- Todas las tablas tienen **RLS activado sin políticas**: la API REST pública
  de Supabase no puede leerlas. Solo la app, con la cadena de conexión, accede.
  No crear políticas ni usar la clave `anon` en el navegador.
- **Plan gratuito**: Supabase pausa los proyectos inactivos. Antes de cada
  período de exámenes, entrar al panel y reactivar el proyecto, y verificar que
  responda. Revisá la política vigente (cuánto tiempo puede estar pausado).
- **Backups**: el plan gratuito no garantiza backups. Al cerrar cada período,
  exportar los CSV de notas y, si querés, un `pg_dump`:

  ```bash
  pg_dump "postgresql://..." > backup-examenes.sql
  ```

## 3. Vercel (app)

1. Importar el repo de GitHub en Vercel (framework: Next.js).
2. Variables de entorno (Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | cadena del pooler de Supabase (modo transacción) |
   | `APP_URL` | URL pública, p. ej. `https://examenes.vercel.app` |
   | `ADMIN_PASSWORD` | contraseña del panel docente |
   | `SESSION_SECRET` | 32+ caracteres al azar |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | tu cuenta de Google |
   | `SMTP_PASS` | contraseña de aplicación de Google |
   | `MAIL_FROM` | p. ej. `Exámenes <tu-cuenta>` |

3. Deploy. Después, cargar la URL definitiva en `APP_URL` y en el `.seb`.

A verificar en Vercel:

- **Condiciones del plan Hobby** (uso no comercial).
- **Tiempo máximo de las funciones**: al entregar se genera el PDF y se envía
  el mail en el mismo request (~1–3 s). **"Cerrar examen"** entrega a todos los
  que siguen rindiendo de una vez; con muchos alumnos puede superar el límite.
  Es seguro repetirlo: si se corta, volver a apretar "Cerrar examen" continúa
  con los que faltan. Los mails que no salieron se reintentan desde
  **Resultados**.
- `output: "standalone"` en `next.config.ts` es para Docker. Si Vercel diera
  problemas con esa opción, se puede quitar.

## 4. Gmail (envío de mails)

1. La cuenta tiene que tener **verificación en dos pasos**.
2. Crear una **contraseña de aplicación** y usarla en `SMTP_PASS`.
3. Si no aparece la opción, puede estar deshabilitada por el administrador del
   Workspace de UADE: consultarlo. Alternativa: otro proveedor SMTP.
4. Gmail tiene límites diarios de envío; para ~60 mails por examen no debería
   ser un problema, pero verificá el límite vigente.

## 5. Checklist antes de cada examen

- [ ] Proyecto de Supabase activo (no pausado).
- [ ] Examen publicado, alumnos cargados con tema y parte.
- [ ] Config Key del `.seb` cargada y probada con un ingreso de prueba.
- [ ] Mail de prueba recibido (rendir un examen de prueba completo).
- [ ] `.seb` compartido por Teams.
- [ ] En el aula: dictar el código y abrir la ventana de ingreso.
