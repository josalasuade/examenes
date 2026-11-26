# Tema 1: BiciRed

## Caso

**BiciRed** opera un sistema de bicicletas compartidas en una ciudad mediana:

- 120 estaciones y 1.800 bicicletas con candado electrónico;
- una aplicación móvil para usuarios y un portal web para operadores;
- un equipo técnico de 9 personas.

Durante el último trimestre ocurrieron estos hechos:

1. Una actualización de la aplicación dejó sin funcionar el desbloqueo en 15 estaciones durante 40 minutos.
2. Los cambios de configuración de las estaciones se hacen a mano y no quedan registrados.
3. No existe un criterio común para decidir cuándo una versión está lista para producción.

| Indicador | Valor actual |
|---|---|
| Despliegues por mes | 2 |
| Incidentes graves por mes | 3 |

## Consigna: Estrategia de mejora
Parte: A
Puntaje: 50

Proponga una estrategia para reducir los incidentes **justificada con datos del caso**. Indique prioridades y tres indicadores verificables.

### Rúbrica
- [20] Identifica los problemas principales del caso | Completo: identifica los tres y los relaciona | Parcial: identifica alguno | Ausente: no usa el caso
- [15] Prioriza y justifica | Completo: prioridad justificada con datos | Parcial: prioriza sin justificar | Ausente: no prioriza
- [15] Define tres indicadores verificables | Completo: tres medibles | Parcial: uno o dos | Ausente: ninguno

### No suma
- Decir "usar Agile" o "usar DevOps" sin justificar con el caso
- Definiciones teóricas aisladas

## Consigna: Gestión del incidente
Parte: A
Puntaje: 50

Analice el incidente del punto 1: cómo lo clasificaría, qué acción inicial tomaría y qué evidencia conservaría.

### Rúbrica
- [20] Clasificación y prioridad
- [15] Acción inicial para limitar el impacto
- [15] Evidencia y aprendizaje posterior

## Consigna: Release controlado
Parte: B
Puntaje: 100

Diseñe una estrategia de release que evite que una actualización afecte a todas las estaciones a la vez.

# Tema 2: ParkNow

## Caso

**ParkNow** administra 40 estacionamientos con barreras automáticas y pago por aplicación. Su sistema de cobro falló dos veces el último mes después de cambios urgentes hechos directamente en producción.

## Consigna: Cambios urgentes
Puntaje: 100

Proponga cómo autorizar y registrar los cambios urgentes sin frenar la operación. Justifique con datos del caso.
