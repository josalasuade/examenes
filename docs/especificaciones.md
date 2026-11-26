# Especificación — Plataforma de Exámenes Digitales (UADE)

> Versión 0.3 — 2026-11-26. Surge del análisis del sistema GAS actual
> (carpeta `GAS/`: `code.gs`, `Forms.gs`, `index.html`) y de las
> definiciones acordadas con el docente. Los puntos marcados **[ABIERTO]** no
> están decididos todavía.
>
> **Cambios en 0.3**: Etapa 1 implementada (ver sección 16). Toda la
> generación con IA pasa a la Etapa 2. Decisiones de implementación
> registradas en la sección 16.
>
> **Cambios en 0.2**: desarrollo local primero (Docker + Supabase local) y
> producción después; código de ingreso compartido con ventana de validez
> (confirmado); mail enviado desde la cuenta Google institucional del docente;
> la corrección con IA pasa a la Etapa 2.

## 0. Etapas

**Etapa 1 — sin corrección con IA**

- Carga de exámenes, temas, casos, consignas y rúbricas.
- Carga de alumnos y asignación de tema y parte.
- Rendición en SEB (con excepción individual sin SEB), autoguardado,
  reingreso aprobado por el docente, contador en el servidor.
- Monitoreo de pegados y salidas de ventana.
- Entrega definitiva, PDF y **mail al alumno con el PDF adjunto, nada más**.
- Panel del docente: en vivo, nota final manual y exportación CSV.

**Etapa 2 — IA** (el proveedor se define llegado el momento)

- Generación de temas con IA a partir de los HTML de las clases (decidido:
  Etapa 2). En la Etapa 1 el docente importa los temas en Markdown
  (`docs/FORMATO_IMPORTACION.md`) y los edita en el panel.
- Corrección automática con rúbrica, rango de nota y feedback (secciones 9 y
  10).

## 1. Objetivo

Reemplazar el circuito actual (Google Sheets + Google Forms + Apps Script +
corrección manual pegando respuestas en un chat de IA) por una plataforma
única que cubra:

1. **Armado**: a partir de las clases (HTML), la IA genera varios temas, cada
   uno con un caso distinto y consignas de análisis y razonamiento.
2. **Rendición**: el alumno rinde en Safe Exam Browser (SEB), con autoguardado,
   reanudación tras cuelgue y control de tiempo en el servidor.
3. **Corrección**: al entregar, la IA corrige con la rúbrica y el alumno recibe
   por mail el feedback, un rango de nota y el PDF de su examen.
4. **Cierre**: el docente revisa, define la nota final y exporta para cargarla
   en el sistema de UADE.

**Principio pedagógico**: el alumno debe demostrar **comprensión del contexto
y conocimiento**, aplicados al caso, y no responder de memoria. Las consignas
piden analizar el caso y razonar decisiones justificadas. Todos los exámenes
tienen caso.

## 2. Usuarios

- **Docente (único usuario administrador)**: arma exámenes, carga alumnos,
  asigna temas, monitorea la rendición, aprueba reingresos, revisa y fija notas.
- **Alumno**: solo rinde. Datos almacenados: **nombre, legajo (LU), mail,
  carrera**. Ningún otro dato personal.

## 3. Workflow completo

1. **Subir contenidos**: el docente sube los HTML de las clases a evaluar (uno
   por clase). El sistema extrae y guarda el texto.
2. **Generar temas**: la IA arma **4 temas** (cantidad configurable), cada uno
   con un **caso distinto** y sus consignas, más una **rúbrica por consigna**.
   Los temas deben ser **equivalentes** en dificultad, puntaje y conceptos
   evaluados, para que sea justo entre alumnos.
3. **Revisar y publicar**: el docente edita casos, consignas y rúbricas.
   Al publicar, el examen se congela: se corrige exactamente lo que vieron los
   alumnos.
4. **Cargar alumnos**: en el panel de administración (o importando una
   planilla): nombre, LU, mail, y la **asignación de tema** (y parte, si
   aplica) de cada uno. Se define el **código de ingreso** del examen.
5. **Distribuir**: el docente comparte por Microsoft Teams el archivo `.seb`
   (o el link, para alumnos habilitados sin SEB).
6. **Rendir**: el alumno ingresa, carga su carrera, lee el caso y responde.
   Autoguardado continuo. Se registran pegados y salidas de ventana.
7. **Entregar**: al entregar (o al vencer el tiempo) se registran fecha y hora,
   se cierra la edición y se muestra la confirmación con la opción de
   descargar el PDF.
8. **Corregir con IA** (asíncrono, en cola): puntaje por criterio y por
   consigna, total, rango y feedback.
9. **Mail automático** al alumno apenas termina la IA: rango de nota, leyenda de
   revisión docente, feedback (máx. 450 caracteres) y el PDF adjunto.
10. **Revisión docente**: el docente ve la corrección detallada de la IA, fija
    la nota final y exporta un CSV para el sistema de UADE.

## 4. Estructura de un examen

```
Examen  (materia, docente, instancia, fecha, duración, consignas generales,
  │      escala de notas, código de ingreso, requiere SEB)
  └── Tema 1..N  (caso — obligatorio)
        └── Parte (opcional: A / B, p. ej. recuperatorio de 1° y 2° parcial)
              └── Consigna 1..N  (título, enunciado, puntaje)
                    └── Rúbrica  (criterios con puntaje, niveles, lo que NO suma)
```

- **Duración**: la define el docente por examen. Corre por alumno **desde que
  abre el caso**, y se controla en el servidor.
- **Consignas**: siempre de desarrollo. **Nunca** opción múltiple.
- **Consignas generales**: texto editable por examen; por defecto, el texto
  actual del modelo UADE (7 puntos, incluye "no está permitido consultar
  libros, cuadernos o apuntes").
- **Escala de notas** (por defecto): 0–59 Desaprobado · 60–64 → 4 · 65–69 → 5 ·
  70–74 → 6 · 75–79 → 7 · 80–87 → 8 · 88–94 → 9 · 95–100 → 10. Aprobación: 60.

### Rúbrica por consigna

- Criterios, cada uno con su puntaje máximo; la suma da el puntaje de la
  consigna. Los ítems "Debe: …" de la consigna son el punto de partida.
- Por criterio: qué es completo, parcial y ausente.
- Lo que **no** suma puntos (p. ej. "decir 'usar Agile' sin justificar con
  datos del caso", "definiciones aisladas").
- Generada como borrador por la IA y ajustada por el docente.

## 5. Ingreso e identidad

- **Sin control por IP ni red** (descartado).
- **Código de ingreso (confirmado)**: **un código por examen, igual para
  todos**. El alumno se identifica con código + LU.
  - El docente dicta el código en el aula **recién cuando todos abrieron SEB o
    el link**.
  - El código tiene una **ventana de validez** que el docente abre desde el
    panel (por ejemplo, 10 minutos, configurable). Fuera de esa ventana no
    sirve.
  - **Una sola sesión activa por LU**: si alguien ingresa con el LU de un
    compañero, el verdadero no puede entrar, el docente lo ve en el momento y
    lo resuelve desde el panel.
  - El panel muestra en vivo quién ingresó, con hora.
- **Token de dispositivo**: al primer ingreso se emite un token que identifica
  la sesión. SEB se configura para no borrar el almacenamiento.
- **Reingreso** (cuelgue, reinicio, cambio de equipo): **solo con aprobación
  del docente** en el panel. El contador sigue corriendo; no se detiene.

## 6. Safe Exam Browser

- **Obligatorio por defecto**, validado en el servidor contra la **Config Key**
  del `.seb` oficial (hash de URL + clave enviado por SEB en cada request;
  verificar el nombre exacto del header y el algoritmo en la documentación
  oficial de SEB antes de implementar).
- **Excepción individual**: el docente puede habilitar a un alumno a rendir
  **sin SEB** (p. ej. alumnos con Linux, donde no hay SEB oficial). Queda
  registrado. Para esos alumnos se exige **pantalla completa**; salir de ella
  cuenta como salida.
- El `.seb` debe permitir descargas si se quiere ofrecer la descarga del PDF
  desde SEB (verificar); igual el PDF llega por mail.

## 7. Monitoreo (para todos los alumnos)

Se registra con fecha y hora y se muestra en el panel del docente:

- **Pegados**: tamaño, consigna, y si el texto vino **de afuera** o es texto
  copiado **dentro del propio examen** (reorganizar la respuesta no es
  sospechoso).
- **Salidas de ventana o pestaña**: Alt+Tab, cambio de escritorio, minimizar,
  salir de pantalla completa. Con hora de salida, de vuelta y duración. Se
  separan las salidas menores a 1–2 segundos (falsos positivos por
  notificaciones del sistema).
- **Inserciones de texto sin tecleo ni pegado** y **ritmo de escritura**
  anómalo.
- Accesos, reingresos y aprobaciones.

Son **indicios con hora**, no pruebas concluyentes; el docente concluye junto
con el control presencial. No se detecta: segundo monitor ni celular (los
controla el docente en el aula).

## 8. Rendición

- Pantalla dividida: **caso** a la izquierda; **consignas y editor** a la
  derecha. Encabezado con nombre, LU y contador.
- **Editor HTML** con formato y **tablas** (matrices de decisión, BIA, etc.).
  El HTML se limpia en el servidor antes de guardarse.
- **Autoguardado** cada pocos segundos. El servidor rechaza cambios después
  del vencimiento o de la entrega.
- **Entregar es definitivo**: después de entregar no se edita más. Al vencer
  el tiempo se entrega automáticamente lo último guardado.
- **Pantalla de confirmación**: "Entrega recibida el DD/MM/AAAA a las HH:MM"
  + botón para descargar el PDF.

## 9. Corrección con IA — ETAPA 2

- **Proveedor [ABIERTO]**: configurable. Llamada directa desde el backend (sin
  n8n, que suma un servicio para hospedar).
- **Asíncrona, en cola**: los 60 alumnos entregan casi juntos al final.
  Reintentos ante fallas.
- **Entrada**: caso + consignas de la parte del alumno + rúbricas + contenido
  de las clases relevante + respuestas convertidas a texto (tablas
  preservadas). **Nunca** nombre, LU, mail ni carrera.
- **Salida para el docente**: puntaje por criterio y por consigna con
  justificación, total sugerido.
- **Salida para el alumno**: rango de **±5 puntos** alrededor del total,
  recortado a 0–100 (p. ej. "entre 55 y 65"), más un **feedback constructivo
  de máximo 450 caracteres en total**, orientado al aprendizaje.
- Se guarda el modelo y la versión del prompt usados en cada corrección.
- El docente ajustará el prompt con el tiempo; la nota final puede quedar
  fuera del rango informado.

## 10. Mail al alumno

- **Etapa 1**: al entregar se envía automáticamente un mail con el **PDF
  adjunto**, nada más.
- **Etapa 2**: el mail sale apenas termina la corrección de la IA (sin
  revisión previa del docente; decisión aceptada) y agrega rango de nota,
  leyenda "el docente revisará tu examen para definir la nota final" y
  feedback.
- **Remitente**: la cuenta Google institucional del docente (Google
  Workspace de UADE). La dirección se configura por variable de entorno, no en
  el código. Opciones técnicas, a verificar:
  - SMTP de Gmail con **contraseña de aplicación** (requiere verificación en
    dos pasos, y que el administrador del Workspace de UADE no haya
    deshabilitado las contraseñas de aplicación);
  - **API de Gmail** con OAuth.
  Verificar también el límite diario de envío del Workspace (60 mails por
  examen deberían estar muy por debajo).
- Cola con reintentos: si un envío falla, se reintenta y el panel lo
  muestra.

## 11. PDF del examen

Generado en el servidor al entregar. Diseño basado en el modelo de parcial de
UADE:

- **Página 1 — encabezado**: logo UADE (`logo-uade.png`, se busca mejor
  resolución), "Departamento de Tecnología Informática – DETIN", materia,
  docente, tema, instancia, fecha.
- **Recuadro del alumno**: nombre y apellido, LU, carrera, **hora de inicio,
  hora de entrega, código de verificación** (reemplaza "Cantidad de hojas
  entregadas", que se elimina).
- Consignas generales, condiciones de aprobación, duración, escala de notas.
- **Página 2**: el caso.
- **Página 3 en adelante**: "Respuestas", consigna por consigna.
- **Código de verificación**: hash de las respuestas entregadas, guardado en el
  servidor. Un PDF alterado no coincide.

## 12. Panel del docente

- Contenidos: subir HTML de clases.
- Exámenes: generar temas con IA, editar casos, consignas y rúbricas,
  publicar, configurar código, duración y SEB.
- Alumnos: carga e importación, asignación de tema y parte, habilitación sin
  SEB, lista de carreras para el desplegable.
- En vivo: quién ingresó, tiempo restante, entregas, alertas de pegado y
  salidas, **aprobación de reingresos**, abrir y cerrar el examen.
- Corrección: detalle de la IA por consigna, nota final, exportación CSV
  (LU, nombre, puntaje, nota 1–10).

## 13. Arquitectura y hosting

### Desarrollo (primero)

- Todo corre **local**: la app en **Docker** y **Supabase local** (el CLI de
  Supabase levanta el stack completo en Docker; verificar la versión vigente).
- Migraciones de base y configuración versionadas en el repo; avances
  subidos al repo en forma continua.
- Los secretos locales van en `.env`, que **no** se commitea; el repo incluye
  un `.env.example` solo con los nombres.

### Producción (cuando esté lista)

- **Vercel** (frontend + API) + **Supabase** online (Postgres + login del
  docente). Se aplican las mismas migraciones del repo.
- El navegador del alumno **nunca** habla directo con la base: todo pasa por la
  API, que valida SEB, sesión y tiempo.
- Uso estacional (dos semanas de exámenes cada ~3 meses): aceptable que el
  servicio "duerma". Verificar en la documentación vigente:
  - la política de pausa de Supabase en el plan gratuito, y si existe un
    límite de tiempo pausado para poder reactivar;
  - la ausencia de backups en el plan gratuito: exportar resultados al cerrar
    cada período;
  - las condiciones de uso del plan Hobby de Vercel (uso no comercial);
  - el tiempo máximo de ejecución de las funciones (motiva la cola de
    corrección).
- **Costo**: el hosting es gratuito; la **API de IA no lo es** (costo bajo por
  examen, a estimar con el proveedor elegido).

## 14. Pendientes [ABIERTO]

1. Proveedor de IA (Etapa 2).
2. Probar la validación de SEB con un `.seb` real (sección 16).
3. Envío de mail: SMTP con contraseña de aplicación o API de Gmail; verificar
   qué permite el Workspace de UADE (sección 10).
4. Logo en mayor resolución (opcional).

## 15. Seguridad y datos

- Repo **privado**. Nunca commitear planillas con datos de alumnos ni claves.
- Las claves de SEB del sistema anterior estuvieron publicadas en un repo
  público: **cambiarlas**.
- Secretos (API de IA, Supabase, mails) solo en variables de entorno de
  Vercel, nunca en el código.

## 16. Implementación de la Etapa 1 (estado y decisiones)

Implementada y probada en local (Docker): pruebas unitarias y una prueba de
punta a punta que recorre el flujo completo (ver README). **Falta probar con
SEB real, Supabase y Gmail reales** (ver `docs/DESPLIEGUE.md`).

Decisiones tomadas al implementar:

- **Login del docente**: una contraseña (`ADMIN_PASSWORD`) y una cookie
  firmada, en lugar de Supabase Auth. Hay un solo docente y así no depende de
  un servicio más. Si en el futuro hay más docentes, se migra a Supabase Auth.
- **Stack**: Next.js 16 (interfaz + API) + Postgres. Local: Postgres en
  Docker (equivalente al de Supabase; las migraciones en `supabase/migrations`
  sirven para ambos) y Mailpit para ver los mails.
- **Importación**: temas en Markdown, alumnos en CSV. Edición posterior en el
  panel (casos, consignas, rúbricas).
- **Código de ingreso**: el panel abre la ventana de ingreso por N minutos (10
  por defecto). El primer ingreso exige la ventana abierta; un segundo ingreso
  con el mismo LU genera una **solicitud de reingreso** que el docente aprueba
  o rechaza. Aprobar cierra la sesión anterior.
- **"Reiniciar"** (panel en vivo): si alguien ingresó con el LU de otro, el
  docente reinicia ese examen (borra respuestas y tiempo) y el verdadero alumno
  vuelve a entrar con la ventana de ingreso.
- **Contenido congelado**: al publicar, temas y consignas no se pueden
  editar. Se puede volver a borrador solo si ningún alumno empezó.
- **Salidas de ventana**: las menores a 2 segundos se muestran aparte como
  "cortas" (notificaciones del sistema).
- **Inserción sin tecleo**: se registra cuando una respuesta crece más de 80
  caracteres por encima de lo tecleado y pegado entre dos autoguardados.
- **Pegados**: se guarda una muestra de hasta 500 caracteres del texto pegado,
  para que el docente pueda verlo.
- **No se guardan IPs** (no se usan para control y no son datos necesarios).
- **Hora de entrega por vencimiento**: si el examen se entrega solo por
  tiempo, se registra la hora de vencimiento, no la hora en que se detectó.
- **Nota final**: el docente carga el puntaje 0–100; la nota 1–10 se calcula
  con la escala del examen. El CSV para UADE trae ambos.
- **Base en Supabase**: RLS activado en todas las tablas sin políticas (la API
  REST pública no puede leer nada).

