# Bañolia — orquestador de agentes de atención al cliente

Demo docente de la asignatura *Automatización de Procesos* del Máster en Liderazgo y
Transformación Digital del **CESA** (Bogotá).

Una web pública que simula el servicio de atención al cliente de **Bañolia**, un
e-commerce ficticio colombiano de muebles de baño. Un orquestador de agentes, ejecutado
como rutina de Claude Code, genera solicitudes ficticias, las clasifica y decide cuáles
responde la IA y cuáles pasan a una cola de **human in the loop** para que las conteste
una persona desde la web.

> **Demo docente con datos 100 % ficticios.** Bañolia no es una empresa real.

## Puesta en marcha

```bash
npm install
cp .env.example .env     # rellene los valores; ninguno es obligatorio para ver el tablero
npm run dev              # http://localhost:4321
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run validar` | Valida todo `/data` contra los esquemas zod |
| `npm run crear-hash -- "clave"` | Genera el hash bcrypt de una contraseña |

## Cómo está organizado

```
data/config/     marca, política, criterios de escalado, catálogo y clientes
data/lotes/      lo que publica la rutina, un archivo por lote
src/lib/         esquemas (zod), carga de datos y formato
src/pages/       vistas de la web
scripts/         validación y utilidades
```

El modelo de datos vive en `src/lib/esquemas.ts` y lo comparten la web y el validador.

## Estado

Fase 1 completada: esqueleto, datos ficticios, esquemas, validador, un lote semilla de 10
solicitudes y las vistas de tablero y detalle.

Las guías de montaje para el profesor y de «constrúyelo tú» para los alumnos, junto con el
prompt de la rutina, se añaden en la fase 5.

Ver `CLAUDE.md` para el contexto técnico y `DECISIONES.md` para el registro de decisiones.
