/**
 * Inicio de sesión. Recibe el formulario de /login.
 */
import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { SESSION_SECRET } from 'astro:env/server';
import { buscarUsuario } from '../../../config/usuarios.ts';
import { crearCookie, opcionesCookie, NOMBRE_COOKIE } from '../../../lib/sesion.ts';
import { esProduccion } from '../../../lib/config.ts';

/** Retardo ante credenciales incorrectas: encarece probar contraseñas a ciegas. */
const RETARDO_MS = 600;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!SESSION_SECRET) {
    return redirect('/login?error=configuracion', 303);
  }

  const datos = await request.formData();
  const nombre = String(datos.get('usuario') ?? '').trim();
  const contrasena = String(datos.get('contrasena') ?? '');
  const destino = String(datos.get('destino') ?? '/');

  const usuario = buscarUsuario(nombre);

  // Se compara SIEMPRE contra un hash, exista el usuario o no, para que el
  // tiempo de respuesta no revele si el nombre existe.
  const hashDeReferencia = usuario?.hash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
  const correcta = bcrypt.compareSync(contrasena, hashDeReferencia);

  if (!usuario || !correcta) {
    await dormir(RETARDO_MS);
    // Mensaje genérico: no se distingue «usuario inexistente» de «clave incorrecta».
    return redirect('/login?error=credenciales', 303);
  }

  cookies.set(
    NOMBRE_COOKIE,
    await crearCookie(usuario.usuario, usuario.rol, SESSION_SECRET),
    opcionesCookie(esProduccion),
  );

  // Solo se admiten destinos internos, para no convertir el login en un redirector abierto.
  const seguro = destino.startsWith('/') && !destino.startsWith('//') ? destino : '/';
  return redirect(seguro, 303);
};
