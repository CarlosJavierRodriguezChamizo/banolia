/**
 * Lectura en vivo de las respuestas humanas desde GitHub.
 *
 * El problema que resuelve: los commits de la web llevan el prefijo `hitl:` y
 * Vercel NO despliega con ellos, para no agotar el límite diario de despliegues
 * con veinte personas respondiendo a la vez. Sin esto, una respuesta no se vería
 * hasta el siguiente despliegue.
 *
 * La solución: la web lista el árbol del repositorio, descarta los identificadores
 * que ya venían en el build y descarga SOLO los archivos nuevos.
 *
 * Coste por instancia: una petición al árbol cada 30 segundos, más una por cada
 * respuesta nueva. Si GitHub falla o no hay token, se devuelve lo del build y la
 * web sigue funcionando: la lectura en vivo es una mejora, no un requisito.
 */
import { RespuestaHumana } from './esquemas.ts';
import type { RespuestaHumana as TRespuestaHumana } from './esquemas.ts';
import { respuestasDelBuild } from './datos.ts';
import { listarArbol, leerBlob, type ConfigGithub } from './github.ts';

const PREFIJO = 'data/respuestas-humanas/';
const CACHE_MS = 30_000;

interface Cache {
  expiraEn: number;
  respuestas: TRespuestaHumana[];
  /** Blobs ya descargados, indexados por sha: no cambian nunca. */
  porSha: Map<string, TRespuestaHumana>;
  aviso: string | null;
}

// Caché en memoria por instancia. Las funciones serverless se reutilizan entre
// peticiones, así que sobrevive lo suficiente para que valga la pena.
const cache: Cache = { expiraEn: 0, respuestas: [], porSha: new Map(), aviso: null };

/** Identificadores de solicitud que ya venían resueltos en el build. */
const idsDelBuild = new Set(respuestasDelBuild.map((r) => r.idSolicitud));

export interface ResultadoVivo {
  respuestas: TRespuestaHumana[];
  /** Cuántas se leyeron en vivo, además de las del build. */
  nuevas: number;
  /** Mensaje si la lectura en vivo no pudo completarse. */
  aviso: string | null;
}

export async function respuestasHumanas(cfg: ConfigGithub | null): Promise<ResultadoVivo> {
  // Sin configuración de GitHub la web funciona igual, solo que sin lectura en vivo.
  if (!cfg) {
    return { respuestas: respuestasDelBuild, nuevas: 0, aviso: null };
  }

  const ahora = Date.now();
  if (ahora < cache.expiraEn) {
    return { respuestas: cache.respuestas, nuevas: cache.respuestas.length - respuestasDelBuild.length, aviso: cache.aviso };
  }

  try {
    const { entradas, truncado } = await listarArbol(cfg, PREFIJO);

    // El nombre del archivo es el identificador de la solicitud, así que se puede
    // decidir qué descargar SIN descargar nada.
    const candidatas = entradas.filter((e) => {
      const nombre = e.path.split('/').pop() ?? '';
      if (!nombre.endsWith('.json')) return false;
      return !idsDelBuild.has(nombre.replace(/\.json$/, ''));
    });

    const nuevas: TRespuestaHumana[] = [];
    for (const entrada of candidatas) {
      const yaCacheada = cache.porSha.get(entrada.sha);
      if (yaCacheada) { nuevas.push(yaCacheada); continue; }

      const texto = await leerBlob(cfg, entrada.sha);
      const res = RespuestaHumana.safeParse(JSON.parse(texto));
      if (!res.success) {
        console.error(`[vivo] Respuesta inválida y omitida: ${entrada.path}`);
        continue;
      }
      cache.porSha.set(entrada.sha, res.data);
      nuevas.push(res.data);
    }

    cache.respuestas = [...respuestasDelBuild, ...nuevas];
    cache.aviso = truncado
      ? 'GitHub truncó el listado del repositorio: puede faltar alguna respuesta reciente.'
      : null;
    cache.expiraEn = ahora + CACHE_MS;

    return { respuestas: cache.respuestas, nuevas: nuevas.length, aviso: cache.aviso };
  } catch (e) {
    // Nunca se rompe la página por un fallo de lectura en vivo.
    console.error('[vivo] No se pudo leer en vivo desde GitHub:', e);
    return {
      respuestas: cache.respuestas.length ? cache.respuestas : respuestasDelBuild,
      nuevas: 0,
      aviso: 'No se pudo consultar GitHub; se muestran las respuestas incluidas en el último despliegue.',
    };
  }
}

/** Invalida la caché, para que una respuesta recién guardada se vea de inmediato. */
export function invalidarCache(): void {
  cache.expiraEn = 0;
}
