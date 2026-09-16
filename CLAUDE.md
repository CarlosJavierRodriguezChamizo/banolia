# Bañolia — contexto del proyecto

Demo docente para la asignatura *Automatización de Procesos* del Máster en Liderazgo y
Transformación Digital del CESA (Bogotá). Simula el servicio de atención al cliente de
**Bañolia**, un e-commerce ficticio colombiano de muebles de baño.

Un **orquestador de agentes**, ejecutado como rutina de Claude Code en la nube, genera
solicitudes ficticias, las clasifica y decide cuáles responde la IA y cuáles deja en una
cola de **human in the loop (HITL)** para que una persona las responda desde la web.

El código lo van a leer y replicar alumnos: **comentarios en español, nombres en español
y estructura fácil de seguir**. Antes de la claridad no va la astucia.

## Reglas que no se negocian

1. **Sin base de datos y sin API de Anthropic.** Toda la persistencia son archivos JSON en
   este repositorio. La inteligencia la aporta Claude Code durante la rutina.
2. **Dependencias mínimas.** Solo `astro`, `@astrojs/vercel`, `tailwindcss`,
   `@tailwindcss/vite`, `zod` y `bcryptjs`. Cualquier otra requiere permiso explícito.
3. **Idioma:** español de Colombia, trato de usted (celular, cotización, transportadora,
   domicilio, remodelador). Moneda **COP** con formato `$ 1.250.000`. Zona horaria
   `America/Bogota`.
4. **`_referencia` nunca sale del servidor.** Es la etiqueta de control con la que se mide
   la precisión del sistema. No se pasa a ningún agente y se elimina con `sinReferencia()`
   antes de construir el HTML. Ocultarla con CSS la dejaría en el código fuente.

## Separación de escritores

Es la regla que evita que la rutina y la web se pisen:

| Escribe | Rutina (Claude Code) | Web (API de GitHub) |
|---|---|---|
| `data/lotes/` | sí | no |
| `data/metricas/`, `data/aprendizajes/` | sí | no |
| `data/estado/rutina.json` | sí | no |
| `data/respuestas-humanas/` | **no** | sí |
| `data/estado/lanzamientos/` | **no** | sí |

Nunca editan el mismo archivo. Ojo: esto evita conflictos de *contenido*, pero **no** los
409 de la API de GitHub, porque cada `PUT /contents` mueve la cabeza de la rama. El
endpoint HITL necesita reintentos con retroceso exponencial.

## Despliegue y commits

- La web se despliega sola en Vercel con cada push a `main`.
- Los commits de la web empiezan por **`hitl:`**. `vercel.json` los detecta con
  `ignoreCommand` y **no despliega**, para no agotar el límite diario de despliegues con
  veinte alumnos respondiendo a la vez.
- Cuidado con la semántica: en `ignoreCommand`, **exit 0 salta el build** y **exit 1
  construye**. Es al revés de lo que parece.
- El marcador va al **principio** del mensaje porque `VERCEL_GIT_COMMIT_MESSAGE` se trunca
  a 2048 bytes.

## Comandos

```bash
npm run dev                      # servidor de desarrollo
npm run build                    # compilación de producción
npm run validar                  # valida todo /data con los esquemas zod
npm run crear-hash -- "clave"    # hash bcrypt para src/config/usuarios.ts
```

`npm run validar` y `npm run build` deben pasar antes de cada commit.

## Dónde está cada cosa

- `src/lib/esquemas.ts` — **fuente de verdad** del modelo de datos. Lo usan la web y
  `scripts/validar.mjs` (Node 22 importa TypeScript directamente).
- `src/lib/datos.ts` — carga los JSON con `import.meta.glob` (se incorporan al bundle;
  el sistema de archivos de Vercel es de solo lectura en ejecución).
- `data/config/politica.json` — reglas con ID (`DEV-01`…). Los agentes **deben citar los
  IDs** en su justificación; `validar.mjs` falla si citan uno que no existe.
- `data/config/criterios-hitl.json` — criterios de escalado `H01`…`H11` y descarte `D01`.
- `.claude/agents/` — los ocho subagentes (fase 2).
- `orquestador/RUTINA.md` — instrucciones que ejecuta la rutina (fase 2).

## Estado por fases

- [x] **Fase 1** — esqueleto, datos ficticios, esquemas, validador, lote semilla, tablero y detalle.
- [x] **Fase 2** — los ocho subagentes, `orquestador/RUTINA.md` y las plantillas de salida.
- [x] **Fase 3** — web completa (filtros, secciones, cola humana, lotes, cómo funciona).
- [ ] **Fase 4** — login, HITL con API de GitHub y botón de lanzar lote.
- [ ] **Fase 5** — métricas, bucle de aprendizaje y documentación.
