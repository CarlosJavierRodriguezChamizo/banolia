/**
 * Guarda la respuesta humana a una solicitud.
 *
 * Escribe `data/respuestas-humanas/AAAA-MM/{idSolicitud}.json` mediante un commit
 * a la API de GitHub, porque el sistema de archivos de Vercel es de solo lectura
 * en ejecución.
 *
 * Dos detalles importantes:
 *
 * 1. El `PUT` va SIN `sha` a propósito. Si el archivo ya existe, GitHub responde
 *    422 y sabemos que otra persona respondió antes: es el control de
 *    concurrencia, y no hay que reintentarlo.
 * 2. El mensaje de commit empieza por `hitl:`, que `vercel.json` detecta para NO
 *    desplegar. Con veinte personas respondiendo en clase, cada respuesta
 *    generaría un despliegue y se agotaría el límite diario.
 */
import type { APIRoute } from 'astro';
import { RespuestaHumana, Categoria, AccionHumana } from '../../../lib/esquemas.ts';
import { solicitudPorId } from '../../../lib/datos.ts';
import { crearArchivo, ErrorYaExiste, ErrorGithub } from '../../../lib/github.ts';
import { configGithub } from '../../../lib/config.ts';
import { invalidarCache } from '../../../lib/vivo.ts';

/** Instante actual en Bogotá, en ISO-8601 con desfase -05:00. */
function ahoraEnBogota(): string {
  const f = new Date();
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(f).replace(' ', 'T');
  return `${partes}-05:00`;
}

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const sesion = locals.sesion!;   // el middleware ya garantizó que existe
  const datos = await request.formData();
  const idSolicitud = String(datos.get('idSolicitud') ?? '');
  const volver = `/solicitud/${idSolicitud}`;

  const solicitud = solicitudPorId.get(idSolicitud);
  if (!solicitud) return redirect('/?error=solicitud-desconocida', 303);

  // --- Construcción y validación de la respuesta ---------------------------
  // Se valida ANTES de mirar la configuración: si la persona se equivocó, es más
  // útil decirle en qué que hablarle de variables de entorno que no controla. Y
  // así un despliegue mal configurado no enmascara los errores de validación.
  const accion = AccionHumana.safeParse(String(datos.get('accion') ?? ''));
  if (!accion.success) return redirect(`${volver}?error=accion`, 303);

  const categoriaCruda = String(datos.get('categoriaCorregida') ?? '');
  const categoria = categoriaCruda ? Categoria.safeParse(categoriaCruda) : null;

  const textoEnviado = String(datos.get('respuestaFinal') ?? '').trim();
  const borradorOriginal = solicitud.borrador?.texto ?? '';

  // Al aprobar el borrador tal cual, la respuesta final ES el borrador.
  const respuestaFinal = accion.data === 'aprobar_borrador' ? borradorOriginal : textoEnviado;

  const candidata = {
    idSolicitud,
    usuario: sesion.usuario,
    accion: accion.data,
    categoriaCorregida: categoria?.success ? categoria.data : null,
    respuestaFinal,
    motivo: String(datos.get('motivo') ?? '').trim(),
    // Se calcula comparando de verdad con el borrador, no se pregunta al formulario:
    // es el dato con el que se mide la tasa de aprobación del borrador.
    modificoBorrador: accion.data !== 'aprobar_borrador' && respuestaFinal !== borradorOriginal,
    respondidaEn: ahoraEnBogota(),
  };

  const validada = RespuestaHumana.safeParse(candidata);
  if (!validada.success) {
    const motivo = validada.error.issues[0]?.message ?? 'datos incompletos';
    return redirect(`${volver}?error=validacion&detalle=${encodeURIComponent(motivo)}`, 303);
  }

  // --- Escritura en GitHub ------------------------------------------------
  const cfg = configGithub();
  if (!cfg) return redirect(`${volver}?error=sin-github`, 303);

  const mes = validada.data.respondidaEn.slice(0, 7);          // AAAA-MM
  const ruta = `data/respuestas-humanas/${mes}/${idSolicitud}.json`;
  const contenido = `${JSON.stringify(validada.data, null, 2)}\n`;
  const mensaje = `hitl: ${idSolicitud} por ${sesion.usuario}`;

  try {
    await crearArchivo(cfg, ruta, contenido, mensaje);
    invalidarCache();   // para que se vea de inmediato, sin esperar a la caché
    return redirect(`${volver}?guardado=1`, 303);
  } catch (e) {
    if (e instanceof ErrorYaExiste) {
      return redirect(`${volver}?error=ya-respondida`, 303);
    }
    if (e instanceof ErrorGithub) {
      console.error('[hitl] Error de GitHub:', e.estado, e.message);
      return redirect(`${volver}?error=github&detalle=${encodeURIComponent(String(e.estado))}`, 303);
    }
    console.error('[hitl] Error inesperado:', e);
    return redirect(`${volver}?error=desconocido`, 303);
  }
};
