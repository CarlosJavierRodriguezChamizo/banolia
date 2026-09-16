/**
 * Sesión basada en una cookie firmada, sin almacenamiento de servidor.
 *
 * ¿Por qué no la Sessions API de Astro? Porque en Vercel exige configurar un
 * driver de almacenamiento (Redis del marketplace), y este proyecto no puede
 * usar base de datos. Una cookie firmada no necesita infraestructura.
 *
 * Formato de la cookie:  base64url(JSON) . base64url(HMAC-SHA256)
 *
 * La carga NO va cifrada, solo firmada: cualquiera puede leer su contenido, pero
 * nadie puede modificarlo sin conocer SESSION_SECRET. Por eso dentro solo va el
 * nombre de usuario, el rol y la caducidad, nunca nada sensible.
 */
import type { AstroCookies } from 'astro';
import type { Rol } from '../config/usuarios.ts';
import { aBase64Url, deBase64Url, textoABase64Url, base64UrlATexto } from './base64.ts';

export const NOMBRE_COOKIE = 'banolia_sesion';

/** Duración de la sesión: una jornada de clase con margen. */
const HORAS_VALIDEZ = 12;

export interface Sesion {
  usuario: string;
  rol: Rol;
  /** Caducidad en segundos desde la época Unix. */
  exp: number;
}

async function clave(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
}

async function firmar(carga: string, secreto: string): Promise<string> {
  const firma = await crypto.subtle.sign('HMAC', await clave(secreto), new TextEncoder().encode(carga));
  return aBase64Url(new Uint8Array(firma));
}

/** Comparación en tiempo constante: no debe filtrar la firma correcta por el tiempo que tarda en fallar. */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

/** Construye el valor de la cookie para un usuario. */
export async function crearCookie(usuario: string, rol: Rol, secreto: string): Promise<string> {
  const sesion: Sesion = {
    usuario, rol,
    exp: Math.floor(Date.now() / 1000) + HORAS_VALIDEZ * 3600,
  };
  const carga = textoABase64Url(JSON.stringify(sesion));
  return `${carga}.${await firmar(carga, secreto)}`;
}

/**
 * Verifica y decodifica la cookie. Devuelve `null` si falta, si la firma no
 * cuadra o si ha caducado.
 */
export async function leerCookie(
  valor: string | undefined,
  secreto: string | undefined,
): Promise<Sesion | null> {
  if (!valor || !secreto) return null;

  const punto = valor.lastIndexOf('.');
  if (punto === -1) return null;

  const carga = valor.slice(0, punto);
  const recibida = valor.slice(punto + 1);

  let esperada: string;
  try {
    esperada = await firmar(carga, secreto);
  } catch {
    return null;
  }
  if (!igualesEnTiempoConstante(recibida, esperada)) return null;

  try {
    const sesion = JSON.parse(base64UrlATexto(carga)) as Sesion;
    if (typeof sesion.exp !== 'number' || sesion.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof sesion.usuario !== 'string') return null;
    if (sesion.rol !== 'admin' && sesion.rol !== 'agente') return null;
    return sesion;
  } catch {
    return null;
  }
}

/** Opciones de la cookie. `secure` se desactiva en desarrollo, que va por HTTP. */
export function opcionesCookie(esProduccion: boolean) {
  return {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: HORAS_VALIDEZ * 3600,
  };
}

/** Lee la sesión de una petición de Astro. */
export function sesionDe(cookies: AstroCookies, secreto: string | undefined): Promise<Sesion | null> {
  return leerCookie(cookies.get(NOMBRE_COOKIE)?.value, secreto);
}

// `deBase64Url` se reexporta para las pruebas manuales del script de verificación.
export { deBase64Url };
