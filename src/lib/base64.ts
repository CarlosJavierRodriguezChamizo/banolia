/**
 * Codificación base64 y base64url sin dependencias ni APIs de Node.
 *
 * Se usan las funciones estándar del entorno web (`btoa`, `atob`, `TextEncoder`)
 * en lugar de `Buffer`, para no tener que añadir `@types/node` al proyecto y para
 * que el código funcione igual en cualquier entorno de ejecución.
 */

/** Bytes → base64. Se recorre byte a byte: el operador de propagación desborda la pila con entradas grandes. */
export function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]!);
  return btoa(binario);
}

/** base64 → bytes. Tolera los saltos de línea que introduce la API de GitHub. */
export function deBase64(texto: string): Uint8Array {
  const binario = atob(texto.replace(/\s/g, ''));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export const textoABase64 = (t: string) => aBase64(new TextEncoder().encode(t));
export const base64ATexto = (b: string) => new TextDecoder().decode(deBase64(b));

/** base64url: el alfabeto seguro para URL y cookies, sin relleno. */
export const aBase64Url = (bytes: Uint8Array) =>
  aBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const deBase64Url = (texto: string) =>
  deBase64(texto.replace(/-/g, '+').replace(/_/g, '/'));

export const textoABase64Url = (t: string) => aBase64Url(new TextEncoder().encode(t));
export const base64UrlATexto = (b: string) => new TextDecoder().decode(deBase64Url(b));
