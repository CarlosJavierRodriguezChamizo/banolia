/**
 * Cálculo de las métricas del sistema.
 *
 * Se calculan a partir de los lotes publicados y de las respuestas humanas, NO se
 * leen de `data/metricas/diarias.json`. Ese archivo lo escribe la rutina y sigue
 * siendo útil como histórico, pero calcular aquí garantiza dos cosas:
 *
 *  - que las métricas nunca se desfasen respecto de los datos que se muestran, y
 *  - que incorporen las respuestas humanas leídas en vivo, que la rutina todavía
 *    no ha visto cuando escribe su archivo.
 */
import type { Solicitud, RespuestaHumana, EstadoSolicitud, Categoria } from './esquemas.ts';
import type { SolicitudConLote } from './datos.ts';
import { estadoEfectivo } from './datos.ts';

export interface VolumenDia {
  fecha: string;
  ia: number;
  humano: number;
  descartado: number;
  total: number;
}

export interface Conteo {
  clave: string;
  etiqueta: string;
  n: number;
}

export interface Metricas {
  total: number;
  porEstado: Record<EstadoSolicitud, number>;
  /** Proporción resuelta sin intervención humana, de 0 a 1. */
  automatizacion: number;
  porDia: VolumenDia[];
  porSeccion: Conteo[];
  criterios: Conteo[];
  precision: {
    categoria: number | null;
    ruta: number | null;
    aciertosCategoria: number;
    aciertosRuta: number;
    evaluadas: number;
  };
  borrador: {
    /** Proporción de respuestas humanas que aprobaron el borrador tal cual. */
    tasaAprobacion: number | null;
    aprobados: number;
    editados: number;
    reescritos: number;
    otros: number;
    total: number;
  };
  sla: {
    /** Proporción de casos escalados que se respondieron dentro del SLA. */
    cumplido: number | null;
    dentro: number;
    fuera: number;
    pendientesVencidos: number;
    pendientes: number;
  };
}

const ETIQUETA_SECCION: Record<string, string> = {
  pedidos: 'Pedidos', incidencias: 'Incidencias', devoluciones: 'Devoluciones',
  cotizaciones: 'Cotizaciones', reclamaciones: 'Reclamaciones', consultas: 'Consultas',
  ruido: 'Ruido',
};

export function calcularMetricas(
  solicitudes: SolicitudConLote[],
  respuestas: Map<string, RespuestaHumana>,
  criteriosNombre: Map<string, string>,
  ahora = new Date(),
): Metricas {
  const total = solicitudes.length;

  const porEstado: Record<EstadoSolicitud, number> = {
    resuelto_ia: 0, pendiente_humano: 0, respondido_humano: 0, descartado: 0,
  };
  for (const s of solicitudes) porEstado[estadoEfectivo(s, respuestas)]++;

  // Automatización: sobre las solicitudes que sí requerían respuesta, es decir
  // excluyendo las descartadas, que por definición no se responden.
  const conRespuesta = total - porEstado.descartado;
  const automatizacion = conRespuesta > 0 ? porEstado.resuelto_ia / conRespuesta : 0;

  // --- Volumen por día ----------------------------------------------------
  const dias = new Map<string, VolumenDia>();
  for (const s of solicitudes) {
    const fecha = s.recibidaEn.slice(0, 10);
    const d = dias.get(fecha) ?? { fecha, ia: 0, humano: 0, descartado: 0, total: 0 };
    if (s.decision.ruta === 'ia') d.ia++;
    else if (s.decision.ruta === 'humano') d.humano++;
    else d.descartado++;
    d.total++;
    dias.set(fecha, d);
  }
  const porDia = [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // --- Volumen por sección ------------------------------------------------
  const secciones = new Map<string, number>();
  for (const s of solicitudes) {
    const c = s.clasificacion.categoria;
    secciones.set(c, (secciones.get(c) ?? 0) + 1);
  }
  const porSeccion = [...secciones.entries()]
    .map(([clave, n]) => ({ clave, etiqueta: ETIQUETA_SECCION[clave] ?? clave, n }))
    .sort((a, b) => b.n - a.n);

  // --- Criterios de escalado más frecuentes -------------------------------
  const conteoCriterios = new Map<string, number>();
  for (const s of solicitudes) {
    for (const c of s.decision.criterios) {
      conteoCriterios.set(c, (conteoCriterios.get(c) ?? 0) + 1);
    }
  }
  const criterios = [...conteoCriterios.entries()]
    .map(([clave, n]) => ({ clave, etiqueta: criteriosNombre.get(clave) ?? clave, n }))
    .sort((a, b) => b.n - a.n || a.clave.localeCompare(b.clave));

  // --- Precisión frente a la etiqueta de control --------------------------
  let aciertosCategoria = 0;
  let aciertosRuta = 0;
  for (const s of solicitudes) {
    if (s.clasificacion.categoria === s._referencia.categoria) aciertosCategoria++;
    if (s.decision.ruta === s._referencia.rutaEsperada) aciertosRuta++;
  }
  const precision = {
    categoria: total > 0 ? aciertosCategoria / total : null,
    ruta: total > 0 ? aciertosRuta / total : null,
    aciertosCategoria, aciertosRuta, evaluadas: total,
  };

  // --- Qué hacen las personas con el borrador -----------------------------
  // Es la métrica que dice si la IA está redactando bien: si casi todo se aprueba
  // tal cual, el borrador sirve; si casi todo se reescribe, no.
  const lista = [...respuestas.values()];
  const cuenta = (a: string) => lista.filter((r) => r.accion === a).length;
  const aprobados = cuenta('aprobar_borrador');
  const editados = cuenta('editar_borrador');
  const reescritos = cuenta('reescribir');
  const borrador = {
    tasaAprobacion: lista.length > 0 ? aprobados / lista.length : null,
    aprobados, editados, reescritos,
    otros: lista.length - aprobados - editados - reescritos,
    total: lista.length,
  };

  // --- Cumplimiento del SLA ------------------------------------------------
  let dentro = 0, fuera = 0, pendientesVencidos = 0, pendientes = 0;
  for (const s of solicitudes) {
    if (s.decision.ruta !== 'humano') continue;
    const limite = new Date(s.recibidaEn).getTime() + s.decision.slaHoras * 3600_000;
    const r = respuestas.get(s.id);
    if (r) {
      if (new Date(r.respondidaEn).getTime() <= limite) dentro++;
      else fuera++;
    } else {
      pendientes++;
      if (ahora.getTime() > limite) pendientesVencidos++;
    }
  }
  const respondidas = dentro + fuera;
  const sla = {
    cumplido: respondidas > 0 ? dentro / respondidas : null,
    dentro, fuera, pendientesVencidos, pendientes,
  };

  return { total, porEstado, automatizacion, porDia, porSeccion, criterios, precision, borrador, sla };
}

/** Porcentaje con un decimal solo cuando hace falta: 65 % en vez de 65,0 %. */
export function pct(valor: number | null): string {
  if (valor === null) return '—';
  const n = valor * 100;
  return `${Number.isInteger(n) ? n : n.toFixed(1)} %`;
}

export type { Solicitud, Categoria };
