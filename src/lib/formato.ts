/**
 * Utilidades de formato para la interfaz. Todo en español de Colombia.
 */

const ZONA_HORARIA = 'America/Bogota';

/**
 * Convierte una cadena de fecha en un instante interpretable.
 *
 * Cuidado con las fechas SIN hora, como `2026-09-16`: JavaScript las interpreta
 * como medianoche UTC, que en Bogotá son las 19:00 del día ANTERIOR. Sin esto,
 * toda fecha sin hora se mostraba un día antes de lo que decían los datos.
 *
 * Para evitarlo se les fija explícitamente la medianoche de Bogotá.
 */
function aInstante(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00-05:00` : iso);
}

/** Formato de moneda del proyecto: `$ 1.250.000` (sin decimales). */
export function pesos(valor: number): string {
  return `$ ${Math.round(valor).toLocaleString('es-CO')}`;
}

/** `16 de septiembre de 2026` */
export function fechaLarga(iso: string): string {
  return aInstante(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA_HORARIA,
  });
}

/** `16/09/2026` */
export function fechaCorta(iso: string): string {
  return aInstante(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA_HORARIA,
  });
}

/** `16/09/2026, 9:05 a. m.` */
export function fechaHora(iso: string): string {
  return aInstante(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: ZONA_HORARIA,
  });
}

/** `9:05 a. m.` */
export function hora(iso: string): string {
  return aInstante(iso).toLocaleTimeString('es-CO', {
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

/* --- Presentación de los cálculos del analista de política --------------- */

/**
 * Convierte un valor del objeto `calculos` en una o varias líneas legibles.
 *
 * Los agentes devuelven ahí números, booleanos, rangos y listas de líneas de
 * pedido. Volcarlos con `JSON.stringify` produce cadenas larguísimas sin espacios
 * que rompen la maquetación en móvil, y además son ilegibles en clase, que es
 * justo donde se miran.
 *
 * Los importes se detectan por el sufijo `COP` de la clave y se formatean como
 * moneda.
 */
export function formatearCalculo(clave: string, valor: unknown): string[] {
  const esImporte = /COP$/.test(clave);

  const simple = (v: unknown): string => {
    if (v === null) return '—';
    if (typeof v === 'boolean') return v ? 'sí' : 'no';
    if (typeof v === 'number') return esImporte ? pesos(v) : String(v);
    return String(v);
  };

  if (Array.isArray(valor)) {
    // Lista de objetos: una línea por elemento (p. ej. las líneas de una cotización).
    if (valor.length > 0 && typeof valor[0] === 'object' && valor[0] !== null) {
      return valor.map((el) =>
        Object.entries(el as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${formatearCalculo(k, v)[0]}`)
          .join(' · '));
    }
    // Rango o lista de valores simples.
    return [valor.map(simple).join(valor.length === 2 ? ' a ' : ' · ')];
  }

  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatearCalculo(k, v)[0]}`);
  }

  return [simple(valor)];
}

/**
 * Convierte una clave en camelCase en una etiqueta legible.
 * `gastoRecogidaCOP` → `Gasto recogida` · `plazoZonaADiasHabiles` → `Plazo zona A dias habiles`
 */
export function etiquetaCalculo(clave: string): string {
  const palabras = clave
    .replace(/COP$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')       // camelCase
    .replace(/([A-Za-z])(\d)/g, '$1 $2')       // descuento8 -> descuento 8
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ADias -> A Dias
    .trim()
    .split(/\s+/)
    // Se conservan las siglas y las letras sueltas (la zona A, por ejemplo).
    .map((p) => (p.length > 1 && /^[A-Z][a-z]+$/.test(p) ? p.toLowerCase() : p));

  if (palabras.length === 0) return clave;
  palabras[0] = palabras[0].charAt(0).toUpperCase() + palabras[0].slice(1);
  return palabras.join(' ');
}
