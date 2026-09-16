/**
 * Esquemas de validacion (zod) de TODO el modelo de datos de la demo.
 *
 * Estos esquemas son la unica fuente de verdad del formato de los JSON de /data.
 * Los reutilizan:
 *   - la web (src/lib/datos.ts) al leer los archivos,
 *   - el script `npm run validar` (scripts/validar.mjs),
 *   - los subagentes del orquestador, que deben producir exactamente esta forma.
 *
 * Si cambia algo aqui, `npm run validar` fallara hasta que los datos se adapten.
 */
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Vocabulario comun                                                           */
/* -------------------------------------------------------------------------- */

/** Fecha en formato AAAA-MM-DD. */
export const Fecha = z.iso.date();

/** Instante ISO-8601. En este proyecto siempre con desfase de Bogota (-05:00). */
export const Instante = z.iso.datetime({ offset: true });

export const Canal = z.enum(['formulario', 'correo', 'whatsapp', 'chat']);

export const Categoria = z.enum([
  'pedidos',
  'incidencias',
  'devoluciones',
  'cotizaciones',
  'reclamaciones',
  'consultas',
  'ruido',
]);

export const Prioridad = z.enum(['baja', 'media', 'alta', 'critica']);

/** Ruta que decide el enrutador para cada solicitud. */
export const Ruta = z.enum(['ia', 'humano', 'descartado']);

export const EstadoSolicitud = z.enum([
  'resuelto_ia',
  'pendiente_humano',
  'respondido_humano',
  'descartado',
]);

/** Zona de envio: A = principales ciudades, B = resto del pais y San Andres. */
export const Zona = z.enum(['A', 'B']);

export const TipoCliente = z.enum(['particular', 'profesional']);

/** Identificador de regla de politica, p. ej. DEV-01, ENV-02, PQR-01. */
export const IdRegla = z.string().regex(/^[A-Z]{3}-\d{2}$/, 'Formato esperado: XXX-00 (p. ej. DEV-01)');

/** Codigo de criterio de escalado a humano, p. ej. H01. Tambien D01 para descarte. */
export const CodigoCriterio = z
  .string()
  .regex(/^[HD]\d{2}$/, 'Formato esperado: H00 o D00 (p. ej. H04, D01)');

/* -------------------------------------------------------------------------- */
/* data/config/marca.json                                                      */
/* -------------------------------------------------------------------------- */

export const Marca = z.object({
  nombre: z.string().min(1),
  eslogan: z.string().min(1),
  tonoDeVoz: z.array(z.string().min(1)).min(1),
  firmaCorreos: z.string().min(1),
  canales: z.array(Canal).min(1),
  horarioAtencion: z.object({
    entreSemana: z.string().min(1),
    sabados: z.string().min(1),
    zonaHoraria: z.literal('America/Bogota'),
  }),
  ciudadesCobertura: z.array(z.string().min(1)).min(1),
  paleta: z.object({
    primario: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    primarioOscuro: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    acento: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    superficie: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    texto: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  avisoDemo: z.string().min(1),
});

/* -------------------------------------------------------------------------- */
/* data/config/catalogo.json                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `tipologiaDevolucion` es la clave que enlaza el producto con la tabla de
 * gastos de recogida de la regla DEV-08 (politica.json).
 */
export const TipologiaDevolucion = z.enum([
  'accesorios',
  'baneras',
  'bides',
  'columnas-hidromasaje',
  'columnas-auxiliares',
  'espejos-led',
  'espejos-sin-led',
  'griferia',
  'inodoros',
  'lavabos-2-senos',
  'lavabos-1-seno',
  'mamparas-con-flejes',
  'mamparas-sin-flejes',
  'muebles-bano',
  'platos-ducha',
  'radiadores',
]);

export const CategoriaProducto = z.enum([
  'muebles-bano',
  'mamparas',
  'platos-ducha',
  'lavabos',
  'griferia',
  'espejos',
  'sanitarios',
  'baneras',
  'accesorios',
  'toalleros-electricos',
]);

export const Producto = z.object({
  sku: z.string().regex(/^BN-[A-Z]{3}-\d{3}$/, 'Formato esperado: BN-XXX-000'),
  nombre: z.string().min(1),
  categoria: CategoriaProducto,
  fabricante: z.string().min(1),
  tipologiaDevolucion: TipologiaDevolucion,
  precioCOP: z.number().int().positive(),
  aMedida: z.boolean(),
  /**
   * Rango de anchos de hueco, en centimetros, al que se adapta el producto
   * gracias a sus perfiles de ajuste: [minimo, maximo].
   *
   * Solo lo tienen las mamparas. Es `null` en el resto de productos y tambien en
   * las mamparas a medida, que se fabrican a la medida exacta del hueco.
   *
   * Existe porque es el dato que mas piden los clientes antes de comprar y, sin
   * el, los redactores tendrian que inventarselo para poder responder.
   */
  rangoAjusteCm: z.tuple([z.number().int().positive(), z.number().int().positive()]).nullable(),
  plazoEntregaDiasHabiles: z.number().int().positive(),
  requiereEstiba: z.boolean(),
  garantiaMeses: z.number().int().positive(),
});

export const Catalogo = z.array(Producto).min(1);

/* -------------------------------------------------------------------------- */
/* data/config/clientes.json                                                   */
/* -------------------------------------------------------------------------- */

export const Cliente = z.object({
  id: z.string().regex(/^CLI-\d{4}$/),
  nombre: z.string().min(1),
  tipo: TipoCliente,
  /** Solo para profesionales: remodelador, constructora, arquitecto, hotel... */
  subtipo: z.string().min(1).nullable(),
  ciudad: z.string().min(1),
  zona: Zona,
  correo: z.email(),
  celular: z.string().min(1),
  pedidosPrevios: z.number().int().nonnegative(),
  valorHistoricoCOP: z.number().int().nonnegative(),
});

export const Clientes = z.array(Cliente).min(1);

/* -------------------------------------------------------------------------- */
/* data/config/politica.json                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `fuente` distingue las reglas adaptadas de una politica real de las que se
 * inventaron de forma razonada para la demo. Es importante para la clase:
 * los alumnos deben ver que el sistema cita SIEMPRE el origen de su criterio.
 */
export const FuenteRegla = z.enum(['original-adaptada', 'inventada-razonada']);

export const ReglaPolitica = z.object({
  id: IdRegla,
  titulo: z.string().min(1),
  texto: z.string().min(1),
  fuente: FuenteRegla,
  /** Parametros numericos citables por los agentes (plazos, topes, tarifas...). */
  parametros: z.record(z.string(), z.unknown()).optional(),
});

export const Politica = z.array(ReglaPolitica).min(1);

/* -------------------------------------------------------------------------- */
/* data/config/criterios-hitl.json                                             */
/* -------------------------------------------------------------------------- */

export const CriterioHitl = z.object({
  codigo: CodigoCriterio,
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  ejemplo: z.string().min(1),
});

export const CriteriosHitl = z.array(CriterioHitl).min(1);

/* -------------------------------------------------------------------------- */
/* Solicitud                                                                   */
/* -------------------------------------------------------------------------- */

export const LineaPedido = z.object({
  sku: z.string().min(1),
  cantidad: z.number().int().positive(),
  precioCOP: z.number().int().nonnegative(),
});

export const Pedido = z.object({
  numero: z.string().regex(/^BN-\d{6}$/),
  fecha: Fecha,
  estado: z.string().min(1),
  lineas: z.array(LineaPedido).min(1),
  totalCOP: z.number().int().nonnegative(),
  /** Fecha de entrega real o prevista; null si aun no se ha despachado. */
  fechaEntrega: Fecha.nullable(),
});

export const Adjunto = z.object({
  tipo: z.enum(['foto', 'documento', 'video']),
  descripcion: z.string().min(1),
});

/**
 * Etiqueta de control usada SOLO para medir la precision del sistema.
 * NUNCA debe pasarse a los agentes ni enviarse al navegador de un usuario
 * que no sea administrador (ver src/lib/datos.ts -> sinReferencia()).
 */
export const Referencia = z.object({
  categoria: Categoria,
  rutaEsperada: Ruta,
});

export const Clasificacion = z.object({
  categoria: Categoria,
  subcategoria: z.string().min(1),
  prioridad: Prioridad,
  /** De -2 (muy negativo) a +2 (muy positivo). */
  sentimiento: z.number().int().min(-2).max(2),
  confianza: z.number().min(0).max(1),
  entidades: z.record(z.string(), z.unknown()),
});

export const AnalisisPolitica = z.object({
  reglasAplicables: z.array(IdRegla),
  cumple: z.boolean().nullable(),
  calculos: z.record(z.string(), z.unknown()),
  riesgos: z.array(z.string()),
});

export const FichaEscalado = z.object({
  queDecidir: z.string().min(1),
  opciones: z.array(z.string().min(1)),
  riesgos: z.array(z.string()),
});

export const Decision = z.object({
  ruta: Ruta,
  criterios: z.array(CodigoCriterio),
  slaHoras: z.number().int().positive(),
  /** Obligatoria en la ruta `humano`; null en el resto. */
  fichaEscalado: FichaEscalado.nullable(),
});

export const Borrador = z.object({
  texto: z.string().min(1),
  redactadoPor: z.enum(['redactor-posventa', 'redactor-comercial', 'redactor-pedidos']),
  iteraciones: z.number().int().min(1).max(2),
});

export const Revision = z.object({
  aprobado: z.boolean(),
  observaciones: z.array(z.string()),
});

export const RespuestaFinal = z.object({
  texto: z.string().min(1),
  autor: z.enum(['ia', 'humano']),
});

/** Un paso del recorrido de agentes. Es lo que se pinta en la linea de tiempo. */
export const PasoTraza = z.object({
  orden: z.number().int().positive(),
  agente: z.enum([
    'generador-solicitudes',
    'clasificador',
    'analista-politica',
    'enrutador',
    'redactor-posventa',
    'redactor-comercial',
    'redactor-pedidos',
    'supervisor-calidad',
  ]),
  accion: z.string().min(1),
  resultado: z.string().min(1),
  /** Explicacion breve y auditable (2-4 frases), no un volcado de pensamiento. */
  justificacion: z.string().min(1),
  confianza: z.number().min(0).max(1).nullable(),
  reglas: z.array(IdRegla),
  criterios: z.array(CodigoCriterio),
});

export const Solicitud = z
  .object({
    id: z.string().regex(/^SOL-\d{8}-\d{4}$/),
    recibidaEn: Instante,
    canal: Canal,
    cliente: z.object({
      id: z.string().regex(/^CLI-\d{4}$/),
      nombre: z.string().min(1),
      ciudad: z.string().min(1),
      zona: Zona,
      tipo: TipoCliente,
    }),
    pedido: Pedido.nullable(),
    asunto: z.string().min(1),
    mensaje: z.string().min(1),
    adjuntos: z.array(Adjunto),
    _referencia: Referencia,
    clasificacion: Clasificacion,
    analisisPolitica: AnalisisPolitica,
    decision: Decision,
    borrador: Borrador.nullable(),
    revision: Revision.nullable(),
    respuestaFinal: RespuestaFinal.nullable(),
    estado: EstadoSolicitud,
    traza: z.array(PasoTraza).min(1),
  })
  // Reglas de coherencia entre campos: evitan que un agente publique un lote
  // internamente contradictorio (p. ej. ruta `humano` con respuesta ya cerrada).
  .refine((s) => (s.decision.ruta === 'humano' ? s.decision.fichaEscalado !== null : true), {
    message: 'La ruta `humano` exige una fichaEscalado para que la persona no parta de cero',
    path: ['decision', 'fichaEscalado'],
  })
  .refine((s) => (s.decision.ruta === 'ia' ? s.estado === 'resuelto_ia' : true), {
    message: 'La ruta `ia` debe terminar en estado `resuelto_ia`',
    path: ['estado'],
  })
  .refine((s) => (s.decision.ruta === 'ia' ? s.respuestaFinal !== null : true), {
    message: 'La ruta `ia` debe tener respuestaFinal',
    path: ['respuestaFinal'],
  })
  .refine((s) => (s.decision.ruta === 'descartado' ? s.respuestaFinal === null : true), {
    message: 'Una solicitud descartada no lleva respuesta',
    path: ['respuestaFinal'],
  })
  .refine((s) => (s.estado === 'pendiente_humano' ? s.respuestaFinal === null : true), {
    message: 'Si esta pendiente de humano todavia no puede haber respuesta final',
    path: ['respuestaFinal'],
  })
  .refine((s) => (s.decision.ruta === 'humano' ? s.decision.criterios.length > 0 : true), {
    message: 'Escalar a humano exige citar al menos un criterio Hxx',
    path: ['decision', 'criterios'],
  });

/* -------------------------------------------------------------------------- */
/* data/lotes/AAAA-MM-DD/lote-NN.json                                          */
/* -------------------------------------------------------------------------- */

export const Lote = z
  .object({
    id: z.string().regex(/^LOTE-\d{8}-\d{2}$/),
    fecha: Fecha,
    origen: z.enum(['programado', 'manual']),
    iniciadoEn: Instante,
    finalizadoEn: Instante,
    totales: z.object({
      solicitudes: z.number().int().nonnegative(),
      ia: z.number().int().nonnegative(),
      humano: z.number().int().nonnegative(),
      descartado: z.number().int().nonnegative(),
    }),
    alertas: z.array(z.string()),
    solicitudes: z.array(Solicitud).min(1),
  })
  .refine((l) => l.totales.solicitudes === l.solicitudes.length, {
    message: 'totales.solicitudes no coincide con el numero real de solicitudes',
    path: ['totales', 'solicitudes'],
  })
  .refine(
    (l) => l.totales.ia + l.totales.humano + l.totales.descartado === l.totales.solicitudes,
    { message: 'ia + humano + descartado debe sumar el total', path: ['totales'] },
  )
  .refine((l) => new Set(l.solicitudes.map((s) => s.id)).size === l.solicitudes.length, {
    message: 'Hay identificadores de solicitud repetidos dentro del lote',
    path: ['solicitudes'],
  });

/* -------------------------------------------------------------------------- */
/* data/respuestas-humanas/AAAA-MM/{idSolicitud}.json                          */
/* -------------------------------------------------------------------------- */

export const AccionHumana = z.enum([
  'aprobar_borrador',
  'editar_borrador',
  'reescribir',
  'reclasificar',
  'descartar',
]);

export const RespuestaHumana = z
  .object({
    idSolicitud: z.string().regex(/^SOL-\d{8}-\d{4}$/),
    usuario: z.string().min(1),
    accion: AccionHumana,
    categoriaCorregida: Categoria.nullable(),
    respuestaFinal: z.string(),
    motivo: z.string(),
    modificoBorrador: z.boolean(),
    respondidaEn: Instante,
  })
  .refine((r) => (r.accion === 'reclasificar' ? r.categoriaCorregida !== null : true), {
    message: 'Reclasificar exige indicar la categoria corregida',
    path: ['categoriaCorregida'],
  })
  .refine((r) => (r.accion === 'descartar' ? r.motivo.length > 0 : true), {
    message: 'Descartar exige un motivo',
    path: ['motivo'],
  })
  .refine((r) => (r.accion === 'descartar' ? true : r.respuestaFinal.length > 0), {
    message: 'Salvo al descartar, la respuesta final no puede estar vacia',
    path: ['respuestaFinal'],
  });

/* -------------------------------------------------------------------------- */
/* data/aprendizajes/ejemplos.json                                             */
/* -------------------------------------------------------------------------- */

/**
 * Ejemplos de estilo que los redactores leen antes de escribir. Se alimentan de
 * las respuestas humanas reales: es el bucle de aprendizaje de la demo.
 */
export const EjemploAprendizaje = z.object({
  idSolicitud: z.string().regex(/^SOL-\d{8}-\d{4}$/),
  categoria: Categoria,
  accion: AccionHumana,
  /** Borrador que propuso la IA (null si la persona reescribio desde cero). */
  borradorIa: z.string().nullable(),
  respuestaHumana: z.string().min(1),
  motivo: z.string(),
  respondidaEn: Instante,
});

export const Aprendizajes = z.object({
  actualizadoEn: Instante,
  /** Como maximo 5 ejemplos recientes por categoria. */
  porCategoria: z.record(z.string(), z.array(EjemploAprendizaje).max(5)),
});

/* -------------------------------------------------------------------------- */
/* data/metricas/diarias.json                                                  */
/* -------------------------------------------------------------------------- */

export const MetricaDia = z.object({
  fecha: Fecha,
  recibidas: z.number().int().nonnegative(),
  ia: z.number().int().nonnegative(),
  humano: z.number().int().nonnegative(),
  descartado: z.number().int().nonnegative(),
  respondidasPorHumano: z.number().int().nonnegative(),
  porCategoria: z.record(z.string(), z.number().int().nonnegative()),
  criteriosFrecuentes: z.record(z.string(), z.number().int().nonnegative()),
  /** Precision del clasificador frente a `_referencia`, de 0 a 1. */
  precisionClasificador: z.number().min(0).max(1).nullable(),
  /** Proporcion de borradores aprobados tal cual por las personas. */
  tasaAprobacionBorrador: z.number().min(0).max(1).nullable(),
});

export const Metricas = z.object({
  actualizadoEn: Instante,
  dias: z.array(MetricaDia),
});

/* -------------------------------------------------------------------------- */
/* data/estado/rutina.json y data/estado/lanzamientos/{timestamp}.json         */
/* -------------------------------------------------------------------------- */

export const EstadoRutina = z.object({
  ultimaEjecucion: Instante.nullable(),
  ultimoLoteId: z.string().nullable(),
  /** Marca hasta donde se incorporo aprendizaje de respuestas humanas. */
  ultimaRespuestaHumanaIncorporada: Instante.nullable(),
  errores: z.array(
    z.object({
      ocurridoEn: Instante,
      contexto: z.string().min(1),
      detalle: z.string().min(1),
    }),
  ),
});

export const Lanzamiento = z.object({
  solicitadoEn: Instante,
  solicitadoPor: z.string().min(1),
  tamano: z.number().int().min(1).max(50),
  /** URL de la sesion de Claude Code devuelta por el disparador. */
  sesionUrl: z.string().nullable(),
  resultado: z.enum(['aceptado', 'rechazado', 'error']),
  detalle: z.string(),
});

/* -------------------------------------------------------------------------- */
/* Tipos de TypeScript derivados (para usar en toda la web)                    */
/* -------------------------------------------------------------------------- */

export type Marca = z.infer<typeof Marca>;
export type Producto = z.infer<typeof Producto>;
export type Cliente = z.infer<typeof Cliente>;
export type ReglaPolitica = z.infer<typeof ReglaPolitica>;
export type CriterioHitl = z.infer<typeof CriterioHitl>;
export type Solicitud = z.infer<typeof Solicitud>;
export type Lote = z.infer<typeof Lote>;
export type RespuestaHumana = z.infer<typeof RespuestaHumana>;
export type PasoTraza = z.infer<typeof PasoTraza>;
export type Aprendizajes = z.infer<typeof Aprendizajes>;
export type Metricas = z.infer<typeof Metricas>;
export type MetricaDia = z.infer<typeof MetricaDia>;
export type EstadoRutina = z.infer<typeof EstadoRutina>;
export type Lanzamiento = z.infer<typeof Lanzamiento>;
export type Categoria = z.infer<typeof Categoria>;
export type Prioridad = z.infer<typeof Prioridad>;
export type Ruta = z.infer<typeof Ruta>;
export type EstadoSolicitud = z.infer<typeof EstadoSolicitud>;
