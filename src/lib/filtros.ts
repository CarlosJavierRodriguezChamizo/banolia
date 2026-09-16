/**
 * Filtros del tablero y de las secciones.
 *
 * Se resuelven EN EL SERVIDOR a partir de los parámetros de la URL, no con
 * JavaScript en el navegador. Así los filtros funcionan sin scripts, se pueden
 * compartir por enlace y quedan en el historial del navegador.
 */
import type { Categoria, Prioridad, EstadoSolicitud } from './esquemas.ts';
import type { SolicitudConLote } from './datos.ts';

export interface Filtros {
  seccion: Categoria | null;
  prioridad: Prioridad | null;
  /** Número de días hacia atrás desde hoy. `null` significa «todo el histórico». */
  dias: number | null;
  busqueda: string;
}

const CATEGORIAS = ['pedidos', 'incidencias', 'devoluciones', 'cotizaciones', 'reclamaciones', 'consultas', 'ruido'];
const PRIORIDADES = ['baja', 'media', 'alta', 'critica'];

/** Días que se muestran por defecto en el tablero. */
export const DIAS_POR_DEFECTO = 7;

export function leerFiltros(url: URL, diasPorDefecto: number | null = DIAS_POR_DEFECTO): Filtros {
  const p = url.searchParams;

  const seccion = p.get('seccion');
  const prioridad = p.get('prioridad');
  const diasCrudo = p.get('dias');

  // `dias=0` es la forma de pedir explícitamente todo el histórico.
  let dias: number | null = diasPorDefecto;
  if (diasCrudo !== null) {
    const n = Number.parseInt(diasCrudo, 10);
    dias = Number.isFinite(n) && n > 0 ? n : null;
  }

  return {
    seccion: seccion && CATEGORIAS.includes(seccion) ? (seccion as Categoria) : null,
    prioridad: prioridad && PRIORIDADES.includes(prioridad) ? (prioridad as Prioridad) : null,
    dias,
    busqueda: (p.get('q') ?? '').trim(),
  };
}

/** ¿Hay algún filtro distinto del valor por defecto? */
export function hayFiltrosActivos(f: Filtros): boolean {
  return f.seccion !== null || f.prioridad !== null || f.busqueda !== '' || f.dias !== DIAS_POR_DEFECTO;
}

/**
 * Aplica los filtros. La búsqueda mira el identificador, el asunto, el nombre
 * del cliente y el número de pedido, que es lo que una persona tiene a mano
 * cuando busca un caso concreto.
 */
export function aplicarFiltros<T extends SolicitudConLote>(
  solicitudes: T[],
  f: Filtros,
  estados: Map<string, EstadoSolicitud>,
  ahora = new Date(),
): T[] {
  const desde = f.dias === null ? null : new Date(ahora.getTime() - f.dias * 86_400_000);
  const q = f.busqueda.toLowerCase();

  return solicitudes.filter((s) => {
    if (f.seccion && s.clasificacion.categoria !== f.seccion) return false;
    if (f.prioridad && s.clasificacion.prioridad !== f.prioridad) return false;
    if (desde && new Date(s.recibidaEn) < desde) return false;
    if (q) {
      const heno = [
        s.id, s.asunto, s.cliente.nombre, s.cliente.ciudad, s.pedido?.numero ?? '',
      ].join(' ').toLowerCase();
      if (!heno.includes(q)) return false;
    }
    // `estados` se pasa por si en el futuro se filtra por estado efectivo.
    void estados;
    return true;
  });
}

/** Construye una URL conservando los filtros actuales y cambiando uno. */
export function urlConFiltro(url: URL, clave: string, valor: string | null): string {
  const nueva = new URL(url.toString());
  if (valor === null || valor === '') nueva.searchParams.delete(clave);
  else nueva.searchParams.set(clave, valor);
  return nueva.pathname + (nueva.searchParams.toString() ? `?${nueva.searchParams}` : '');
}
