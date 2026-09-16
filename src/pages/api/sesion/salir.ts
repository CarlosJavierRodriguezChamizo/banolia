/** Cierre de sesión: borra la cookie. */
import type { APIRoute } from 'astro';
import { NOMBRE_COOKIE } from '../../../lib/sesion.ts';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(NOMBRE_COOKIE, { path: '/' });
  return redirect('/?sesion=cerrada', 303);
};
