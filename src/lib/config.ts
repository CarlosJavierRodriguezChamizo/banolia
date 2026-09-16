/**
 * Configuración leída del entorno.
 *
 * Todas las variables son opcionales a propósito: la web debe compilar y mostrar
 * el tablero aunque el alumno todavía no tenga tokens. Cada función devuelve
 * `null` cuando falta lo suyo, y quien la usa decide cómo degradar.
 */
import {
  GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH,
  ROUTINE_FIRE_URL, ROUTINE_FIRE_TOKEN,
} from 'astro:env/server';
import type { ConfigGithub } from './github.ts';

export function configGithub(): ConfigGithub | null {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  return { token: GITHUB_TOKEN, repo: GITHUB_REPO, rama: GITHUB_BRANCH };
}

export function configRutina(): { url: string; token: string } | null {
  if (!ROUTINE_FIRE_URL || !ROUTINE_FIRE_TOKEN) return null;
  return { url: ROUTINE_FIRE_URL, token: ROUTINE_FIRE_TOKEN };
}

export const esProduccion = import.meta.env.PROD;

/** Qué falta por configurar, para avisarlo en la interfaz en lugar de fallar en silencio. */
export function avisosDeConfiguracion(): string[] {
  const faltan: string[] = [];
  if (!GITHUB_TOKEN || !GITHUB_REPO) faltan.push('GITHUB_TOKEN y GITHUB_REPO (guardar respuestas y lectura en vivo)');
  if (!ROUTINE_FIRE_URL || !ROUTINE_FIRE_TOKEN) faltan.push('ROUTINE_FIRE_URL y ROUTINE_FIRE_TOKEN (lanzar lotes)');
  return faltan;
}
