/**
 * Cliente mínimo de la API de GitHub.
 *
 * El sistema de archivos de Vercel es de solo lectura en ejecución, así que la
 * web no puede escribir en disco: toda escritura es un commit a través de la API.
 *
 * OJO con los 409. Cada `PUT /contents` mueve la cabeza de la rama, de modo que
 * dos respuestas simultáneas chocan AUNQUE toquen archivos distintos. Con veinte
 * personas respondiendo a la vez en clase, esto pasa. Por eso hay reintentos con
 * retroceso exponencial y *jitter*, y por eso se distingue con cuidado el 409 de
 * carrera (se reintenta) del 422 de archivo ya existente (no se reintenta).
 */

import { textoABase64, base64ATexto } from './base64.ts';

const API = 'https://api.github.com';

export interface ConfigGithub {
  token: string;
  repo: string;   // usuario/repositorio
  rama: string;
}

export class ErrorGithub extends Error {
  // Campos declarados de forma explícita, no como parámetros del constructor:
  // Node solo BORRA tipos al importar TypeScript, no transforma código, y las
  // «parameter properties» requieren transformación. Escribirlo así mantiene la
  // propiedad de que cualquier script de Node pueda importar nuestros módulos.
  estado: number;
  cuerpo?: unknown;

  constructor(message: string, estado: number, cuerpo?: unknown) {
    super(message);
    this.name = 'ErrorGithub';
    this.estado = estado;
    this.cuerpo = cuerpo;
  }
}

/** El archivo ya existe en el repositorio: otra persona se adelantó. */
export class ErrorYaExiste extends ErrorGithub {
  constructor(ruta: string) {
    super(`El archivo ${ruta} ya existe`, 422);
    this.name = 'ErrorYaExiste';
  }
}

function cabeceras(cfg: ConfigGithub): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Espera antes de reintentar: retroceso exponencial con jitter.
 *
 * El jitter es imprescindible: sin él, veinte peticiones que chocan a la vez
 * reintentarían todas en el mismo instante y volverían a chocar.
 *
 * El tope de 1.500 ms no es cosmético. Todo el presupuesto de reintentos tiene que
 * caber DENTRO del tiempo máximo de una función serverless (10 segundos por
 * defecto en Vercel). Si se pasa, el usuario ve un 504 del servidor en lugar del
 * mensaje de error que preparamos, que es mucho peor.
 *
 * Con estos valores el peor caso son unos 5,8 segundos: 200 + 400 + 800 + 1.500 ms
 * de espera, cada uno con hasta el doble por el jitter, más las cuatro peticiones.
 */
function esperaReintento(intento: number): number {
  const base = Math.min(200 * 2 ** intento, 1500);   // 200, 400, 800, 1500 ms
  return base + Math.random() * base;                 // hasta el doble, repartido al azar
}

const MAX_INTENTOS = 4;

/**
 * Crea un archivo nuevo. Se envía SIN `sha` a propósito: si el archivo ya
 * existe, GitHub responde 422 y sabemos que otra persona respondió antes.
 */
export async function crearArchivo(
  cfg: ConfigGithub,
  ruta: string,
  contenido: string,
  mensaje: string,
): Promise<{ commit: string }> {
  const cuerpo = JSON.stringify({
    message: mensaje,
    content: textoABase64(contenido),
    branch: cfg.rama,
  });

  let ultimoError: unknown = null;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    let res: Response;
    try {
      res = await fetch(`${API}/repos/${cfg.repo}/contents/${ruta}`, {
        method: 'PUT', headers: cabeceras(cfg), body: cuerpo,
      });
    } catch (e) {
      // Fallo de red: también merece reintento.
      ultimoError = e;
      await dormir(esperaReintento(intento));
      continue;
    }

    if (res.ok) {
      const datos = await res.json() as { commit?: { sha?: string } };
      return { commit: datos.commit?.sha ?? '' };
    }

    // 422 con el archivo ya presente: NO se reintenta, es un resultado legítimo.
    if (res.status === 422) throw new ErrorYaExiste(ruta);

    // 409 es la carrera por la cabeza de la rama; 5xx es un fallo transitorio.
    if (res.status === 409 || res.status >= 500) {
      ultimoError = await res.text();
      await dormir(esperaReintento(intento));
      continue;
    }

    throw new ErrorGithub(`GitHub respondió ${res.status}`, res.status, await res.text());
  }

  throw new ErrorGithub(
    `No se pudo escribir ${ruta} tras ${MAX_INTENTOS} intentos`, 409, ultimoError);
}

export interface EntradaArbol {
  path: string;
  type: string;
  sha: string;
}

/**
 * Lista el árbol completo de la rama en una sola petición (`recursive=1`).
 *
 * `truncated` avisa de que GitHub cortó la respuesta: con los volúmenes de esta
 * demo no debería ocurrir, pero conviene saberlo en lugar de asumir que la lista
 * está completa.
 */
export async function listarArbol(
  cfg: ConfigGithub,
  prefijo: string,
): Promise<{ entradas: EntradaArbol[]; truncado: boolean }> {
  const res = await fetch(
    `${API}/repos/${cfg.repo}/git/trees/${encodeURIComponent(cfg.rama)}?recursive=1`,
    { headers: cabeceras(cfg) });

  if (!res.ok) throw new ErrorGithub(`No se pudo leer el árbol: ${res.status}`, res.status);

  const datos = await res.json() as { tree?: EntradaArbol[]; truncated?: boolean };
  return {
    entradas: (datos.tree ?? []).filter((e) => e.type === 'blob' && e.path.startsWith(prefijo)),
    truncado: Boolean(datos.truncated),
  };
}

/** Descarga un blob por su sha y lo devuelve como texto. */
export async function leerBlob(cfg: ConfigGithub, sha: string): Promise<string> {
  const res = await fetch(`${API}/repos/${cfg.repo}/git/blobs/${sha}`, { headers: cabeceras(cfg) });
  if (!res.ok) throw new ErrorGithub(`No se pudo leer el blob: ${res.status}`, res.status);
  const datos = await res.json() as { content: string; encoding: string };
  return datos.encoding === 'base64' ? base64ATexto(datos.content) : datos.content;
}
