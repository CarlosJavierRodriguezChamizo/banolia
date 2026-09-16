# Plantillas de salida por agente

Un archivo por agente con la **forma exacta** que debe devolver. Sirven de referencia rápida
durante la ejecución de la rutina y como material de clase: comparar la plantilla con la
salida real es la forma más rápida de detectar que un agente se está desviando.

Todos los agentes devuelven un campo `justificacion`: una explicación **breve y auditable**
de 2 a 4 frases, citando identificadores de política y códigos de criterio. No es un volcado
del razonamiento interno.

| Archivo | Agente | Se inserta en |
|---|---|---|
| `generador-solicitudes.json` | `generador-solicitudes` | la solicitud completa |
| `clasificador.json` | `clasificador` | `solicitud.clasificacion` |
| `analista-politica.json` | `analista-politica` | `solicitud.analisisPolitica` |
| `enrutador.json` | `enrutador` | `solicitud.decision` |
| `redactor.json` | los tres redactores | `solicitud.borrador` |
| `supervisor-calidad.json` | `supervisor-calidad` | `solicitud.revision` |
| `paso-traza.json` | todos | un elemento de `solicitud.traza` |

El campo `justificacion` que devuelven los agentes **no** se guarda dentro de
`clasificacion`, `analisisPolitica` ni `decision`: va al paso correspondiente de `traza`.
