# Formato de importación

## Temas y consignas (Markdown)

Un archivo `.md` puede traer uno o varios temas. Se importa en
**Panel → examen → Temas → Importar**. Si un tema con el mismo número ya
existe, se reemplaza. Solo se puede importar con el examen en **borrador**.

```markdown
# Tema 1: Título del caso

## Caso

Texto del caso en Markdown: **negritas**, listas, tablas, etc.

| Indicador | Valor |
|---|---|
| Sedes | 74 |

## Consigna: Proceso y estrategia de evolución
Parte: A
Puntaje: 25

Enunciado de la consigna (Markdown).

### Rúbrica
- [5] Identifica los problemas del caso | Completo: los relaciona con datos | Parcial: menciona algunos | Ausente: no usa el caso
- [10] Prioriza y justifica
- [10] Define tres indicadores verificables

### No suma
- Decir "usar Agile" sin justificar con el caso
- Definiciones aisladas

## Consigna: Otra consigna
Parte: B
Puntaje: 25

Enunciado…

# Tema 2: Otro caso
…
```

Reglas:

| Elemento | Obligatorio | Detalle |
|---|---|---|
| `# Tema N: Título` | Sí | `N` es el número de tema que se usa en el CSV de alumnos. |
| `## Caso` | Sí | Todos los exámenes tienen caso. |
| `## Consigna: Título` | Sí (al menos una) | El orden en el archivo es el orden en el examen. |
| `Parte: X` | No | Va justo debajo del título de la consigna. Sin parte, la consigna la ven todos los alumnos del tema. Con parte, solo los alumnos asignados a esa parte. |
| `Puntaje: N` | Sí | Va justo debajo del título (o de `Parte:`). |
| `### Rúbrica` | No | Una línea por criterio: `- [puntos] descripción`, y opcionalmente `| Completo: … | Parcial: … | Ausente: …`. Si hay rúbrica, los puntos tienen que sumar el puntaje de la consigna. |
| `### No suma` | No | Una línea por ítem: lo que no otorga puntos. |

Al publicar, el sistema avisa si el puntaje total de un tema (o de cada parte)
no suma 100.

La rúbrica y "No suma" no los ven los alumnos: son para la corrección (en la
Etapa 2, la corrección con IA los va a usar).

## Alumnos (CSV)

Separador `;` o `,` (Excel en español guarda con `;`). Primera fila con los
encabezados:

```csv
lu;nombre;mail;tema;parte;sin_seb
1234567;Apellido, Nombre;alumno@uade.edu.ar;1;A;no
7654321;Otro, Alumno;otro@uade.edu.ar;2;;si
```

| Columna | Obligatoria | Detalle |
|---|---|---|
| `lu` | Sí | Legajo. Si ya existe, se actualizan nombre y mail. |
| `nombre` | Sí | Como aparece en el PDF. |
| `mail` | Sí | Adonde se envía el PDF. |
| `tema` | Sí | Número de tema (ver Markdown). |
| `parte` | No | `A`, `B`, … o vacío. |
| `sin_seb` | No | `si` habilita a rendir sin Safe Exam Browser (pantalla completa obligatoria y salidas registradas). |

Los alumnos que ya empezaron el examen no se modifican al reimportar.
