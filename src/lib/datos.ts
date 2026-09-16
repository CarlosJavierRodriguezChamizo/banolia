/**
 * Acceso a los datos del repositorio.
 *
 * Los JSON se incorporan al bundle en tiempo de compilación con `import.meta.glob`,
 * no se leen del disco en tiempo de ejecución: el sistema de archivos de Vercel es
 * de solo lectura y las funciones serverless no incluyen archivos que no estén
 * referenciados explícitamente.
 *
 * A partir de la fase 4, las respuestas humanas nuevas se leen ADEMÁS en vivo desde
 * GitHub (src/lib/vivo.ts) y se fusionan con las que ya venían en el build.
 *
 * Todo se valida con zod al cargar: si un lote está corrupto, preferimos verlo aquí
 * antes que pintar una página rota.
 */
import {
  Marca, Catalogo, Clientes, Politica, CriteriosHitl, Lote, RespuestaHumana,
} from './esquemas.ts';
import type {
  Marca as TMarca, Producto, Cliente, ReglaPolitica, CriterioHitl,
  Lote as TLote, Solicitud, RespuestaHumana as TRespuestaHumana, EstadoSolicitud,
} from './esquemas.ts';

import marcaJson from '../../data/config/marca.json';
import catalogoJson from '../../data/config/catalogo.json';
import clientesJson from '../../data/config/clientes.json';
import politicaJson from '../../data/config/politica.json';
import criteriosJson from '../../data/config/criterios-hitl.json';

/* --- Configuración ------------------------------------------------------ */

export const marca: TMarca = Marca.parse(marcaJson);
export const catalogo: Producto[] = Catalogo.parse(catalogoJson);
export const clientes: Cliente[] = Clientes.parse(clientesJson);
export const politica: ReglaPolitica[] = Politica.parse(politicaJson);
export const criteriosHitl: CriterioHitl[] = CriteriosHitl.parse(criteriosJson);

export const productoPorSku = new Map(catalogo.map((p) => [p.sku, p]));
export const clientePorId = new Map(clientes.map((c) => [c.id, c]));
export const reglaPorId = new Map(politica.map((r) => [r.id, r]));
export const criterioPorCodigo = new Map(criteriosHitl.map((c) => [c.codigo, c]));

/* --- Lotes -------------------------------------------------------------- */

const modulosLote = import.meta.glob<unknown>('/data/lotes/**/*.json', {
  eager: true,
  import: 'default',
});

/** Todos los lotes publicados, del más reciente al más antiguo. */
export const lotes: TLote[] = Object.entries(modulosLote)
  .map(([ruta, contenido]) => {
    const res = Lote.safeParse(contenido);
    if (!res.success) {
      // No tumbamos la web por un lote corrupto: lo omitimos y lo avisamos.
      console.error(`[datos] Lote inválido y omitido: ${ruta}`, res.error.issues.slice(0, 3));
      return null;
    }
    return res.data;
  })
  .filter((l): l is TLote => l !== null)
  .sort((a, b) => b.iniciadoEn.localeCompare(a.iniciadoEn));

/** Una solicitud junto con el lote del que proviene. */
export type SolicitudConLote = Solicitud & { loteId: string; loteFecha: string };

export const solicitudes: SolicitudConLote[] = lotes
  .flatMap((l) => l.solicitudes.map((s) => ({ ...s, loteId: l.id, loteFecha: l.fecha })))
  .sort((a, b) => b.recibidaEn.localeCompare(a.recibidaEn));

export const solicitudPorId = new Map(solicitudes.map((s) => [s.id, s]));

/* --- Respuestas humanas incluidas en el build --------------------------- */

const modulosRespuesta = import.meta.glob<unknown>('/data/respuestas-humanas/**/*.json', {
  eager: true,
  import: 'default',
});

export const respuestasDelBuild: TRespuestaHumana[] = Object.entries(modulosRespuesta)
  .map(([ruta, contenido]) => {
    const res = RespuestaHumana.safeParse(contenido);
    if (!res.success) {
      console.error(`[datos] Respuesta humana inválida y omitida: ${ruta}`);
      return null;
    }
    return res.data;
  })
  .filter((r): r is TRespuestaHumana => r !== null);

/* --- Estado efectivo ---------------------------------------------------- */

/**
 * El estado que se muestra en la web no es solo el que grabó la rutina: si existe
 * una respuesta humana para la solicitud, esta pasa a `respondido_humano`.
 */
export function estadoEfectivo(
  solicitud: Solicitud,
  respuestas: Map<string, TRespuestaHumana>,
): EstadoSolicitud {
  const r = respuestas.get(solicitud.id);
  if (!r) return solicitud.estado;
  return r.accion === 'descartar' ? 'descartado' : 'respondido_humano';
}

/** Índice de respuestas humanas por id de solicitud. */
export function indexarRespuestas(lista: TRespuestaHumana[]): Map<string, TRespuestaHumana> {
  return new Map(lista.map((r) => [r.idSolicitud, r]));
}

/* --- Protección de la etiqueta de control ------------------------------- */

/**
 * Quita `_referencia` de una solicitud.
 *
 * `_referencia` es la respuesta correcta con la que medimos la precisión del
 * sistema. Se elimina EN EL SERVIDOR antes de construir el HTML: ocultarla con
 * CSS la dejaría visible en el código fuente de la página.
 */
export function sinReferencia<T extends Solicitud>(solicitud: T): Omit<T, '_referencia'> {
  const { _referencia, ...resto } = solicitud;
  return resto;
}

/** ¿Acertó el clasificador respecto de la etiqueta de control? */
export function acierto(solicitud: Solicitud): { categoria: boolean; ruta: boolean } {
  return {
    categoria: solicitud.clasificacion.categoria === solicitud._referencia.categoria,
    ruta: solicitud.decision.ruta === solicitud._referencia.rutaEsperada,
  };
}
