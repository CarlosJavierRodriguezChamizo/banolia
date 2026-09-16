// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Configuracion de Astro para la demo docente "Banolia".
//
// output: 'server'  -> todas las paginas se renderizan en el servidor por defecto.
//                      Las paginas que solo leen datos del repositorio pueden optar
//                      por prerenderizarse con `export const prerender = true`.
//                      Ojo: el tablero y el detalle NO pueden prerenderizarse porque
//                      fusionan las respuestas humanas leidas en vivo desde GitHub.
export default defineConfig({
  output: 'server',
  adapter: vercel(),

  vite: {
    // Tailwind 4 se instala como plugin de Vite (ya no existe una integracion de Astro).
    plugins: [tailwindcss()],
  },

  // Variables de entorno tipadas y validadas por Astro (usa zod internamente).
  // Todas son `optional` a proposito: el proyecto debe compilar y mostrar el tablero
  // aunque el alumno todavia no haya configurado GitHub ni la rutina.
  env: {
    schema: {
      SESSION_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_REPO: envField.string({ context: 'server', access: 'public', optional: true }),
      GITHUB_BRANCH: envField.string({ context: 'server', access: 'public', default: 'main' }),
      ROUTINE_FIRE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      ROUTINE_FIRE_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
    // Dejamos la validacion de secretos en runtime (valor por defecto) para no
    // romper el build de quien todavia no tiene los tokens.
    validateSecrets: false,
  },
});
