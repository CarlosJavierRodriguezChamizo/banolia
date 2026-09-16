/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Sesión del usuario, resuelta por el middleware. `null` si no ha entrado. */
    sesion: import('./lib/sesion.ts').Sesion | null;
  }
}
