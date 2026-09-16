/**
 * Utilidades de formato para la interfaz. Todo en español de Colombia.
 */

const ZONA_HORARIA = 'America/Bogota';

/** Formato de moneda del proyecto: `$ 1.250.000` (sin decimales). */
export function pesos(valor: number): string {
  return `$ ${Math.round(valor).toLocaleString('es-CO')}`;
}

/** `16 de septiembre de 2026` */
export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA_HORARIA,
  });
}

/** `16/09/2026` */
export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA_HORARIA,
  });
}

/** `16/09/2026, 9:05 a. m.` */
export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: ZONA_HORARIA,
  });
}

/** `9:05 a. m.` */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: 'numeric', minute: '2-digit', timeZone: ZONA_HORARIA,
  });
}

/** Fecha de hoy en Bogotá, como AAAA-MM-DD. */
export function hoyEnBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA });
}

/* --- Etiquetas legibles ------------------------------------------------- */

export const ETIQUETA_CATEGORIA: Record<string, string> = {
  pedidos: 'Pedidos',
  incidencias: 'Incidencias',
  devoluciones: 'Devoluciones',
  cotizaciones: 'Cotizaciones',
  reclamaciones: 'Reclamaciones',
  consultas: 'Consultas',
  ruido: 'Ruido',
};

export const ETIQUETA_PRIORIDAD: Record<string, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica',
};

export const ETIQUETA_ESTADO: Record<string, string> = {
  resuelto_ia: 'Resuelto por IA',
  pendiente_humano: 'Pendiente humano',
  respondido_humano: 'Respondido por humano',
  descartado: 'Descartado',
};

export const ETIQUETA_CANAL: Record<string, string> = {
  formulario: 'Formulario web', correo: 'Correo', whatsapp: 'WhatsApp', chat: 'Chat',
};

export const ETIQUETA_AGENTE: Record<string, string> = {
  'generador-solicitudes': 'Generador de solicitudes',
  'clasificador': 'Clasificador',
  'analista-politica': 'Analista de política',
  'enrutador': 'Enrutador',
  'redactor-posventa': 'Redactor de posventa',
  'redactor-comercial': 'Redactor comercial',
  'redactor-pedidos': 'Redactor de pedidos',
  'supervisor-calidad': 'Supervisor de calidad',
};

/** Texto del sentimiento, de -2 a +2. */
export function etiquetaSentimiento(valor: number): string {
  return ['Muy negativo', 'Negativo', 'Neutro', 'Positivo', 'Muy positivo'][valor + 2] ?? 'Neutro';
}

/** Slug de sección usado en /seccion/[slug]. */
export const SECCIONES = [
  'pedidos', 'incidencias', 'devoluciones', 'cotizaciones', 'reclamaciones', 'consultas',
] as const;

/**
 * Horas restantes de SLA desde que se recibió la solicitud.
 * Negativo significa que el SLA ya se incumplió.
 */
export function horasRestantesSla(recibidaEn: string, slaHoras: number, ahora = new Date()): number {
  const vence = new Date(recibidaEn).getTime() + slaHoras * 3600_000;
  return (vence - ahora.getTime()) / 3600_000;
}

/** Semáforo de SLA para la cola humana. */
export function semaforoSla(horas: number): 'vencido' | 'critico' | 'atencion' | 'ok' {
  if (horas < 0) return 'vencido';
  if (horas < 2) return 'critico';
  if (horas < 6) return 'atencion';
  return 'ok';
}
