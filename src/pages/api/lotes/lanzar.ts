/**
 * Dispara la rutina del orquestador bajo demanda.
 *
 * Llama al endpoint `/fire` del disparador API de la rutina de Claude Code y
 * registra el lanzamiento en `data/estado/lanzamientos/` con un commit `hitl:`,
 * que no despliega.
 *
 * Los límites (uno cada 10 minutos y 3 al día) evitan que una clase entera
 * dispare rutinas a la vez y agote el cupo diario de ejecuciones de la cuenta.
 */
import type { APIRoute } from 'astro';
import { Lanzamiento } from '../../../lib/esquemas.ts';
import { crearArchivo, listarArbol, type ConfigGithub } from '../../../lib/github.ts';
import { configGithub, configRutina } from '../../../lib/config.ts';

/** Cabecera beta bajo la que se publica el endpoint /fire de las rutinas. */
const CABECERA_BETA = 'experimental-cc-routine-2026-04-01';

const MINUTOS_ENTRE_LANZAMIENTOS = 10;
const MAXIMO_POR_DIA = 3;
const TAMANOS_PERMITIDOS = [5, 10, 25];
const PREFIJO = 'data/estado/lanzamientos/';

function ahoraEnBogota(): string {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', 'T');
  return `${partes}-05:00`;
}

/**
 * Comprueba los límites leyendo SOLO los nombres de archivo del árbol.
 *
 * Los archivos se llaman `AAAA-MM-DDTHH-mm-ss.json`, así que la fecha está en el
 * nombre: no hace falta descargar ni un solo blob para saber cuántos lanzamientos
 * hubo hoy ni cuándo fue el último.
 */
async function comprobarLimites(cfg: ConfigGithub, ahora: string):
  Promise<{ permitido: true } | { permitido: false; motivo: string }> {
  const hoy = ahora.slice(0, 10);
  let nombres: string[] = [];

  try {
    const { entradas } = await listarArbol(cfg, PREFIJO);
    nombres = entradas
      .map((e) => e.path.slice(PREFIJO.length).replace(/\.json$/, ''))
      .filter((n) => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(n))
      .sort();
  } catch (e) {
    // Si no se puede comprobar el límite, no se bloquea el lanzamiento: se avisa
    // en el registro. Es preferible a dejar la demo inutilizable en clase.
    console.error('[lanzar] No se pudieron leer los lanzamientos previos:', e);
    return { permitido: true };
  }

  const deHoy = nombres.filter((n) => n.startsWith(hoy));
  if (deHoy.length >= MAXIMO_POR_DIA) {
    return { permitido: false, motivo: `Ya se lanzaron ${MAXIMO_POR_DIA} lotes manuales hoy. El límite se reinicia mañana.` };
  }

  const ultimo = nombres.at(-1);
  if (ultimo) {
    // El nombre lleva la hora local de Bogotá, igual que `ahora`: se comparan directamente.
    const aMs = (n: string) => Date.parse(`${n.slice(0, 10)}T${n.slice(11).replace(/-/g, ':')}-05:00`);
    const minutos = (Date.parse(ahora) - aMs(ultimo)) / 60000;
    if (Number.isFinite(minutos) && minutos < MINUTOS_ENTRE_LANZAMIENTOS) {
      const faltan = Math.ceil(MINUTOS_ENTRE_LANZAMIENTOS - minutos);
      return { permitido: false, motivo: `Hubo un lanzamiento hace menos de ${MINUTOS_ENTRE_LANZAMIENTOS} minutos. Espere ${faltan} minuto(s) más.` };
    }
  }

  return { permitido: true };
}

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const sesion = locals.sesion!;
  const datos = await request.formData();
  const tamanoCrudo = Number.parseInt(String(datos.get('tamano') ?? '10'), 10);
  const tamano = TAMANOS_PERMITIDOS.includes(tamanoCrudo) ? tamanoCrudo : 10;

  const rutina = configRutina();
  if (!rutina) return redirect('/lotes?error=sin-rutina', 303);

  const cfg = configGithub();
  const ahora = ahoraEnBogota();

  // --- Límites ------------------------------------------------------------
  if (cfg) {
    const limite = await comprobarLimites(cfg, ahora);
    if (!limite.permitido) {
      return redirect(`/lotes?error=limite&detalle=${encodeURIComponent(limite.motivo)}`, 303);
    }
  }

  // --- Disparo de la rutina ----------------------------------------------
  let resultado: 'aceptado' | 'rechazado' | 'error' = 'error';
  let detalle = '';
  let sesionUrl: string | null = null;

  try {
    const res = await fetch(rutina.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rutina.token}`,
        'anthropic-beta': CABECERA_BETA,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      // El payload es texto libre; la rutina extrae de él solo modo y tamano.
      body: JSON.stringify({
        text: `modo=manual tamano=${tamano} solicitadoPor=${sesion.usuario}`,
      }),
    });

    if (res.ok) {
      const cuerpo = await res.json() as { claude_code_session_url?: string };
      sesionUrl = cuerpo.claude_code_session_url ?? null;
      resultado = 'aceptado';
      detalle = 'La rutina aceptó el disparo.';
    } else if (res.status === 401) {
      resultado = 'rechazado';
      detalle = 'El token del disparador no es válido o caducó (401).';
    } else if (res.status === 429) {
      resultado = 'rechazado';
      detalle = 'Se alcanzó el límite de ejecuciones de la cuenta (429). Intente más tarde.';
    } else {
      resultado = 'rechazado';
      detalle = `La rutina respondió ${res.status}.`;
    }
  } catch (e) {
    resultado = 'error';
    detalle = 'No se pudo contactar con el disparador de la rutina.';
    console.error('[lanzar] Fallo de red:', e);
  }

  // --- Registro del lanzamiento ------------------------------------------
  // Se registra siempre, salga bien o mal: es lo que hace auditable el uso.
  if (cfg) {
    const registro = Lanzamiento.safeParse({
      solicitadoEn: ahora, solicitadoPor: sesion.usuario, tamano,
      sesionUrl, resultado, detalle,
    });
    if (registro.success) {
      const nombre = ahora.slice(0, 19).replace(/:/g, '-');
      try {
        await crearArchivo(
          cfg, `${PREFIJO}${nombre}.json`,
          `${JSON.stringify(registro.data, null, 2)}\n`,
          `hitl: lanzamiento de lote (${tamano}) por ${sesion.usuario}`,
        );
      } catch (e) {
        console.error('[lanzar] No se pudo registrar el lanzamiento:', e);
      }
    }
  }

  if (resultado === 'aceptado') {
    const url = sesionUrl && sesion.rol === 'admin' ? `&sesion=${encodeURIComponent(sesionUrl)}` : '';
    return redirect(`/lotes?lanzado=${tamano}${url}`, 303);
  }
  return redirect(`/lotes?error=rutina&detalle=${encodeURIComponent(detalle)}`, 303);
};
