# Especificación — Plataforma de Exámenes Digitales (UADE)

> Versión 0.1 — 2026-11-26. Surge del análisis del sistema GAS actual
> (repo `josalasuade/examenes`: `code.gs`, `Forms.gs`, `index.html`) y de las
> definiciones acordadas con el docente. Los puntos marcados **[ABIERTO]** no
> están decididos todavía.

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

**Principio pedagógico**: el alumno no demuestra memoria de conceptos sino su
capacidad de **analizar el contexto del caso y razonar** decisiones
justificadas. Todos los exámenes tienen caso.

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
- **[ABIERTO] Código de ingreso**: el docente propone **un código único por
  examen, igual para todos**. El alumno se identifica con código + LU.
  Riesgo: un alumno podría ingresar con el LU de un compañero. Mitigaciones
  propuestas:
  - el código solo funciona mientras el docente tiene el examen **abierto**;
  - **una sola sesión activa por LU**: si el LU ya tiene sesión, el segundo
    ingreso queda bloqueado y se avisa al docente;
  - el panel muestra en vivo quién ingresó, con hora.
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

## 9. Corrección con IA

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

- Envío **automático** apenas termina la corrección de la IA (sin revisión
  previa del docente; decisión aceptada).
- Contenido: rango de nota, leyenda "el docente revisará tu examen para
  definir la nota final", feedback y **PDF adjunto**.
- Requiere un servicio de envío de mails con plan gratuito (60 mails por
  examen alcanza). **[ABIERTO]** dominio remitente (ideal dominio propio para
  no caer en spam).

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

- **Vercel** (frontend + API) + **Supabase** (Postgres + login del docente).
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

1. Confirmar el esquema de ingreso: código compartido + LU (sección 5).
2. Proveedor de IA.
3. Dominio remitente y servicio de mails.
4. Logo en mayor resolución (opcional).

## 15. Seguridad y datos

- Repo **privado**. Nunca commitear planillas con datos de alumnos ni claves.
- Las claves de SEB del sistema anterior estuvieron publicadas en un repo
  público: **cambiarlas**.
- Secretos (API de IA, Supabase, mails) solo en variables de entorno de
  Vercel, nunca en el código.
