/**
 * Usuarios que pueden responder solicitudes desde la web.
 *
 * NUNCA se guarda una contrasena en claro: solo su hash bcrypt. Para generar uno:
 *
 *   npm run crear-hash -- "la contrasena"
 *
 * ---------------------------------------------------------------------------
 * AVISO IMPORTANTE
 *
 * Los hashes de abajo corresponden a contrasenas de DEMOSTRACION, publicadas en
 * el README para que la clase pueda entrar el primer dia sin configurar nada.
 * Estan pensadas para una demo docente con datos ficticios y una web que no
 * expone ningun dato real.
 *
 * Antes de usar esto para cualquier otra cosa, regenere todos los hashes.
 * ---------------------------------------------------------------------------
 */

export type Rol = 'admin' | 'agente';

export interface Usuario {
  usuario: string;
  rol: Rol;
  /** Hash bcrypt de la contrasena. */
  hash: string;
}

export const usuarios: Usuario[] = [
  {
    usuario: 'profesor',
    rol: 'admin',
    // Contrasena de demostracion: profesor-banolia-2026
    hash: '$2b$10$kqdg21qM0pvAIcbaIAfT2OM4jouHlooz1iIxBh3SU3rZMnEhcSUtG',
  },
  {
    usuario: 'equipo1',
    rol: 'agente',
    // Contrasena de demostracion: equipo1-banolia-2026
    hash: '$2b$10$3Zz4Io.yyuBCn.3UZYyFd.t4CWuEF9SuT4n3jTs46IsHjVu7X2L76',
  },
  {
    usuario: 'equipo2',
    rol: 'agente',
    // Contrasena de demostracion: equipo2-banolia-2026
    hash: '$2b$10$D76hR4ZvT/wTXNSj7OJn/udz5U2nYgNEZaG70ZNw2jErx1Zwkd56e',
  },
  {
    usuario: 'equipo3',
    rol: 'agente',
    // Contrasena de demostracion: equipo3-banolia-2026
    hash: '$2b$10$DnXhFPVLgo.7vXHiLmvdrud..i0zWUCw88HTm7uxbSFNdrgWxhoIi',
  },
  {
    usuario: 'equipo4',
    rol: 'agente',
    // Contrasena de demostracion: equipo4-banolia-2026
    hash: '$2b$10$rKJEgEFgL/FKcsHlYgoTd.uXqd0oio6nbj/.9GakOE8ECaNXo/lTS',
  },
  {
    usuario: 'equipo5',
    rol: 'agente',
    // Contrasena de demostracion: equipo5-banolia-2026
    hash: '$2b$10$DI5Al/FJJLGj8EWJRpjCku/OqLKtRuyZpCPQ6B/7A6Ebt897xr9Ty',
  },
];

export function buscarUsuario(nombre: string): Usuario | undefined {
  return usuarios.find((u) => u.usuario === nombre);
}
