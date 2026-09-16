/**
 * Lee las fichas de los subagentes desde `.claude/agents/*.md`.
 *
 * La página «Cómo funciona» muestra estas fichas, de modo que la documentación
 * que se explica en clase es EXACTAMENTE la que ejecuta el orquestador: no hay
 * una copia que pueda quedarse desfasada.
 *
 * Los archivos se incorporan al bundle con `import.meta.glob` en modo `?raw`.
 */

/** Orden en que intervienen durante la rutina, para pintarlos como un flujo. */
const ORDEN: Record<string, number> = {
  'generador-solicitudes': 1,
  'clasificador': 2,
  'analista-politica': 3,
  'enrutador': 4,
  'redactor-posventa': 5,
  'redactor-comercial': 6,
  'redactor-pedidos': 7,
  'supervisor-calidad': 8,
};

/** Etapa del flujo a la que pertenece cada agente. */
const ETAPA: Record<string, string> = {
  'generador-solicitudes': 'Entrada',
  'clasificador': 'Análisis',
  'analista-politica': 'Análisis',
  'enrutador': 'Decisión',
  'redactor-posventa': 'Redacción',
  'redactor-comercial': 'Redacción',
  'redactor-pedidos': 'Redacción',
  'supervisor-calidad': 'Control',
};

export interface Agente {
  nombre: string;
  descripcion: string;
  herramientas: string[];
  orden: number;
  etapa: string;
  /** Titulares de las secciones del cuerpo, para dar una idea de su contenido. */
  secciones: string[];
}

const crudos = import.meta.glob<string>('/.claude/agents/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/**
 * Extrae el frontmatter YAML sencillo de la cabecera del archivo.
 * No usamos un analizador de YAML completo: estos archivos solo tienen
 * `name`, `description` y `tools`, siempre en una línea.
 */
function leerFrontmatter(texto: string): Record<string, string> {
  const coincidencia = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!coincidencia) return {};
  const campos: Record<string, string> = {};
  for (const linea of coincidencia[1].split(/\r?\n/)) {
    const sep = linea.indexOf(':');
    if (sep === -1) continue;
    campos[linea.slice(0, sep).trim()] = linea.slice(sep + 1).trim();
  }
  return campos;
}

export const agentes: Agente[] = Object.entries(crudos)
  .map(([ruta, texto]) => {
    const fm = leerFrontmatter(texto);
    const nombre = fm.name ?? ruta.split('/').pop()!.replace(/\.md$/, '');
    const secciones = [...texto.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
    return {
      nombre,
      descripcion: fm.description ?? '',
      herramientas: (fm.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      orden: ORDEN[nombre] ?? 99,
      etapa: ETAPA[nombre] ?? 'Otros',
      secciones,
    };
  })
  .sort((a, b) => a.orden - b.orden);
