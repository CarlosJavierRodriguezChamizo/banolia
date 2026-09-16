/**
 * Middleware: resuelve la sesión una sola vez por petición y protege los
 * endpoints de escritura.
 *
 * Las páginas son públicas a propósito (es una demo que se proyecta en clase);
 * lo que se protege es todo lo que ESCRIBE: responder una solicitud y lanzar un
 * lote.
 */
import { defineMiddleware } from 'astro:middleware';
import { SESSION_SECRET } from 'astro:env/server';
import { sesionDe } from './lib/sesion.ts';

const RUTAS_PROTEGIDAS = ['/api/hitl/', '/api/lotes/'];

export const onRequest = defineMiddleware(async (contexto, siguiente) => {
  const sesion = await sesionDe(contexto.cookies, SESSION_SECRET);
  contexto.locals.sesion = sesion;

  const ruta = contexto.url.pathname;
  if (RUTAS_PROTEGIDAS.some((p) => ruta.startsWith(p)) && !sesion) {
    return new Response(
      JSON.stringify({ ok: false, mensaje: 'Debe iniciar sesión para hacer esto.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return siguiente();
});
