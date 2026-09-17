#!/usr/bin/env node
/**
 * Valida TODO el contenido de /data contra los esquemas zod de src/lib/esquemas.ts.
 *
 *   npm run validar
 *
 * Node 22 importa TypeScript directamente (type stripping nativo), asi que este
 * script reutiliza exactamente los mismos esquemas que usa la web: no hay copias.
 *
 * Ademas de la forma de cada archivo, comprueba la INTEGRIDAD REFERENCIAL, que es
 * donde fallan los agentes en la practica: citar una regla de politica que no
 * existe, referirse a un SKU inventado o a un cliente que no esta en el maestro.
 *
 * Codigo de salida 0 si todo esta bien, 1 si hay algun error.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  Marca, Catalogo, Clientes, Politica, CriteriosHitl,
  Lote, RespuestaHumana, Aprendizajes, Metricas, EstadoRutina, Lanzamiento,
} from '../src/lib/esquemas.ts';

const RAIZ = path.resolve(import.meta.dirname, '..');
const errores = [];
const avisos = [];
let archivosValidados = 0;

const rel = (p) => path.relative(RAIZ, p);
const existe = (p) => fs.existsSync(p);
const leerJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Lista recursivamente los .json de un directorio (si existe). */
function jsonsDe(dir) {
  if (!existe(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => path.join(e.parentPath ?? e.path, e.name))
    .sort();
}

/** Valida un archivo contra un esquema y devuelve el dato, o null si falla. */
function validar(ruta, esquema, etiqueta) {
  if (!existe(ruta)) {
    errores.push(`${etiqueta}: falta el archivo ${rel(ruta)}`);
    return null;
  }
  let crudo;
  try {
    crudo = leerJson(ruta);
  } catch (e) {
    errores.push(`${rel(ruta)}: JSON mal formado -> ${e.message}`);
    return null;
  }
  const res = esquema.safeParse(crudo);
  archivosValidados++;
  if (!res.success) {
    for (const issue of res.error.issues) {
      const donde = issue.path.length ? issue.path.join('.') : '(raiz)';
      errores.push(`${rel(ruta)} -> ${donde}: ${issue.message}`);
    }
    return null;
  }
  return res.data;
}

console.log('Validando /data contra los esquemas de src/lib/esquemas.ts\n');

/* --- 1. Configuracion -------------------------------------------------- */
const dirCfg = path.join(RAIZ, 'data/config');
const marca = validar(path.join(dirCfg, 'marca.json'), Marca, 'marca');
const catalogo = validar(path.join(dirCfg, 'catalogo.json'), Catalogo, 'catalogo');
const clientes = validar(path.join(dirCfg, 'clientes.json'), Clientes, 'clientes');
const politica = validar(path.join(dirCfg, 'politica.json'), Politica, 'politica');
const criterios = validar(path.join(dirCfg, 'criterios-hitl.json'), CriteriosHitl, 'criterios-hitl');

// Unicidad de identificadores en los maestros.
const unicos = (lista, campo, etiqueta) => {
  if (!lista) return new Set();
  const vistos = new Set();
  for (const el of lista) {
    if (vistos.has(el[campo])) errores.push(`${etiqueta}: ${campo} repetido -> ${el[campo]}`);
    vistos.add(el[campo]);
  }
  return vistos;
};
const skus = unicos(catalogo, 'sku', 'catalogo.json');
const idsCliente = unicos(clientes, 'id', 'clientes.json');
const idsRegla = unicos(politica, 'id', 'politica.json');
const codigosCriterio = unicos(criterios, 'codigo', 'criterios-hitl.json');

// La tabla de tarifas de DEV-08 debe cubrir todas las tipologias del catalogo.
if (politica && catalogo) {
  const dev08 = politica.find((r) => r.id === 'DEV-08');
  const tarifas = Object.keys(dev08?.parametros?.tarifas ?? {});
  for (const tip of new Set(catalogo.map((p) => p.tipologiaDevolucion))) {
    if (!tarifas.includes(tip)) {
      errores.push(`DEV-08: falta la tarifa de recogida para la tipologia "${tip}" usada en el catalogo`);
    }
  }
}

// La garantia declarada en GAR-01 debe coincidir con la ficha de cada producto.
// Sin esta comprobacion la regla y el catalogo se desfasan sin que nadie lo note,
// y los agentes citan meses de garantia que la politica no respalda.
if (politica && catalogo) {
  const gar01 = politica.find((r) => r.id === 'GAR-01');
  const porCategoria = gar01?.parametros?.porCategoria ?? {};
  for (const p of catalogo) {
    const meses = porCategoria[p.categoria];
    if (meses === undefined) {
      errores.push(`GAR-01: no declara garantia para la categoria "${p.categoria}" usada en el catalogo`);
    } else if (meses !== p.garantiaMeses) {
      errores.push(
        `GAR-01: declara ${meses} meses para "${p.categoria}" pero ${p.sku} trae ${p.garantiaMeses}`,
      );
    }
  }
}

/* --- 2. Lotes ----------------------------------------------------------- */
const idsSolicitudGlobal = new Map();
const lotes = [];
for (const ruta of jsonsDe(path.join(RAIZ, 'data/lotes'))) {
  const lote = validar(ruta, Lote, 'lote');
  if (!lote) continue;
  lotes.push({ ruta, lote });

  // La carpeta debe corresponder con la fecha declarada dentro del lote.
  const carpeta = path.basename(path.dirname(ruta));
  if (carpeta !== lote.fecha) {
    errores.push(`${rel(ruta)}: esta en la carpeta ${carpeta} pero declara fecha ${lote.fecha}`);
  }

  for (const s of lote.solicitudes) {
    // Identificadores de solicitud unicos en todo el repositorio.
    if (idsSolicitudGlobal.has(s.id)) {
      errores.push(`${rel(ruta)}: la solicitud ${s.id} ya existe en ${rel(idsSolicitudGlobal.get(s.id))}`);
    }
    idsSolicitudGlobal.set(s.id, ruta);

    // Integridad referencial: cliente, SKUs, reglas y criterios deben existir.
    if (idsCliente.size && !idsCliente.has(s.cliente.id)) {
      errores.push(`${rel(ruta)} ${s.id}: cliente inexistente ${s.cliente.id}`);
    }
    for (const linea of s.pedido?.lineas ?? []) {
      if (skus.size && !skus.has(linea.sku)) {
        errores.push(`${rel(ruta)} ${s.id}: SKU inexistente ${linea.sku}`);
      }
    }
    const reglasCitadas = [...s.analisisPolitica.reglasAplicables, ...s.traza.flatMap((p) => p.reglas)];
    for (const id of new Set(reglasCitadas)) {
      if (idsRegla.size && !idsRegla.has(id)) {
        errores.push(`${rel(ruta)} ${s.id}: cita la regla inexistente ${id}`);
      }
    }
    const criteriosCitados = [...s.decision.criterios, ...s.traza.flatMap((p) => p.criterios)];
    for (const c of new Set(criteriosCitados)) {
      if (codigosCriterio.size && !codigosCriterio.has(c)) {
        errores.push(`${rel(ruta)} ${s.id}: cita el criterio inexistente ${c}`);
      }
    }
    // La traza debe estar numerada de forma correlativa.
    const ordenes = s.traza.map((p) => p.orden);
    if (ordenes.some((o, i) => o !== i + 1)) {
      errores.push(`${rel(ruta)} ${s.id}: la traza no esta numerada de 1..n (${ordenes.join(',')})`);
    }
  }

  // Los totales declarados deben coincidir con las rutas reales.
  const cuenta = (ruta_) => lote.solicitudes.filter((s) => s.decision.ruta === ruta_).length;
  for (const [campo, valor] of [['ia', cuenta('ia')], ['humano', cuenta('humano')], ['descartado', cuenta('descartado')]]) {
    if (lote.totales[campo] !== valor) {
      errores.push(`${rel(ruta)}: totales.${campo} dice ${lote.totales[campo]} pero hay ${valor}`);
    }
  }

  // Aviso (no error) si el porcentaje a humano se sale del rango orientativo.
  const pct = lote.totales.solicitudes ? (lote.totales.humano / lote.totales.solicitudes) * 100 : 0;
  if ((pct < 25 || pct > 35) && !lote.alertas.length) {
    avisos.push(`${rel(ruta)}: ${pct.toFixed(0)} % a humano (fuera del rango 25-35 %) y el lote no registra ninguna alerta que lo explique`);
  }
}

/* --- 3. Respuestas humanas --------------------------------------------- */
for (const ruta of jsonsDe(path.join(RAIZ, 'data/respuestas-humanas'))) {
  const r = validar(ruta, RespuestaHumana, 'respuesta humana');
  if (!r) continue;
  // El nombre del archivo debe ser el id de la solicitud.
  const esperado = `${r.idSolicitud}.json`;
  if (path.basename(ruta) !== esperado) {
    errores.push(`${rel(ruta)}: el archivo deberia llamarse ${esperado}`);
  }
  if (idsSolicitudGlobal.size && !idsSolicitudGlobal.has(r.idSolicitud)) {
    avisos.push(`${rel(ruta)}: responde a ${r.idSolicitud}, que no aparece en ningun lote publicado`);
  }
}

/* --- 4. Aprendizajes, metricas y estado -------------------------------- */
const opcional = (ruta, esquema, etiqueta) => {
  if (existe(ruta)) validar(ruta, esquema, etiqueta);
};
opcional(path.join(RAIZ, 'data/aprendizajes/ejemplos.json'), Aprendizajes, 'aprendizajes');
opcional(path.join(RAIZ, 'data/metricas/diarias.json'), Metricas, 'metricas');
opcional(path.join(RAIZ, 'data/estado/rutina.json'), EstadoRutina, 'estado de rutina');
for (const ruta of jsonsDe(path.join(RAIZ, 'data/estado/lanzamientos'))) {
  validar(ruta, Lanzamiento, 'lanzamiento');
}

/* --- 5. Resultado ------------------------------------------------------- */
console.log(`Archivos validados : ${archivosValidados}`);
console.log(`Lotes              : ${lotes.length}`);
console.log(`Solicitudes         : ${idsSolicitudGlobal.size}`);
if (catalogo) console.log(`Productos          : ${catalogo.length}`);
if (clientes) console.log(`Clientes           : ${clientes.length}`);
if (politica) console.log(`Reglas de politica : ${politica.length}`);

if (avisos.length) {
  console.log(`\nAvisos (${avisos.length}):`);
  for (const a of avisos) console.log(`  · ${a}`);
}

if (errores.length) {
  console.error(`\nERRORES (${errores.length}):`);
  for (const e of errores) console.error(`  ✗ ${e}`);
  console.error('\nValidacion FALLIDA.');
  process.exit(1);
}

console.log('\nValidacion correcta: todos los datos cumplen los esquemas.');
