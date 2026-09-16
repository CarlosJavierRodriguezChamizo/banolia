#!/usr/bin/env node
/**
 * Genera el hash bcrypt de una contrasena para pegarlo en src/config/usuarios.ts.
 *
 *   npm run crear-hash -- "mi contrasena"
 *
 * Nunca se guardan contrasenas en claro en el repositorio: solo su hash.
 */
import bcrypt from 'bcryptjs';

const contrasena = process.argv[2];

if (!contrasena) {
  console.error('Uso: npm run crear-hash -- "la contrasena"');
  process.exit(1);
}
if (contrasena.length < 8) {
  console.error('La contrasena debe tener al menos 8 caracteres.');
  process.exit(1);
}

// 10 rondas: equilibrio razonable entre seguridad y tiempo de respuesta en una
// funcion serverless de Vercel (bcrypt es deliberadamente lento).
const hash = bcrypt.hashSync(contrasena, 10);

console.log('\nHash generado (copielo en src/config/usuarios.ts):\n');
console.log(`  '${hash}'\n`);
