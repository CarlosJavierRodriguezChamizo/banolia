# Decisiones de producto y de arquitectura

Registro de las decisiones tomadas durante la construcción, con su motivo. Sirve como
material de clase: casi todas son disyuntivas reales que los alumnos encontrarán.

## Fase 0 — Verificación contra la documentación

**D-01. Versiones.** Astro 7.3.2 (publicada el 22-06-2026), `@astrojs/vercel` 11.0.10,
Tailwind 4.3.3, zod 4.6.5 y bcryptjs 3.0.3. Astro 7 exige Node ≥ 22.12.
`output: 'server'` sigue siendo válido en Astro 7, así que el diseño original se mantiene.

**D-02. Sin `@types/bcryptjs`.** bcryptjs 3 ya incluye sus propios tipos. Una dependencia
menos.

**D-03. Cookie firmada en vez de la Sessions API de Astro.** La documentación del
adaptador exige configurar un driver de almacenamiento (Redis del marketplace de Vercel)
para usar sesiones. Eso sería una base de datos, prohibida por el enunciado. Se usa una
cookie `HttpOnly` firmada con HMAC-SHA256, que no necesita infraestructura.

**D-04. El marcador `[hitl]` pasa al principio del mensaje, como prefijo `hitl:`.**
`VERCEL_GIT_COMMIT_MESSAGE` se trunca a 2048 bytes, así que una etiqueta al final puede
desaparecer. El prefijo es inmune al truncamiento. Se comprueba con `^hitl:`.
Descartada la alternativa de comparar SHAs porque `VERCEL_GIT_PREVIOUS_SHA` viene vacío
con frecuencia.

**D-05. Riesgo aceptado: despliegue omitido en un push agrupado.** Si un push contiene un
commit de código y encima uno `hitl:`, Vercel lee solo el mensaje del último y se salta el
despliegue. Se asume: el siguiente push vuelve a desplegar, y las respuestas humanas se
ven igualmente gracias a la lectura en vivo desde GitHub.

**D-06. La separación de escritores no basta para evitar los 409.** Cada `PUT /contents`
crea un commit sobre la cabeza de la rama, así que dos respuestas simultáneas chocan
aunque toquen archivos distintos. En la fase 4, `/api/hitl/responder` llevará reintentos
con retroceso exponencial y *jitter*, distinguiendo el 409 de carrera (reintentar) del
conflicto real de archivo ya existente (mensaje «ya fue respondida»).

**D-07. Publicar en `main` impone condiciones.** Claude Code acepta siempre los push a
ramas `claude/`, pero al empujar a otra rama comprueba y rechaza si está protegida, si
alguien tiene un PR abierto desde ella o si contiene commits de otra persona. Por tanto:
`main` **sin protección de rama**, y `GITHUB_TOKEN` debe pertenecer a la misma cuenta que
ejecuta la rutina. Si los commits `hitl:` quedan atribuidos a otra identidad, la rutina
perderá la capacidad de publicar.

**D-08. Volumen programado: 4 lotes × 10 = 40 solicitudes/día**, en vez de 4 × 25 = 100.
Cada solicitud recorre unos cinco agentes, de modo que 100 solicitudes suponen unas 500
invocaciones de subagente en una sola sesión, con riesgo real de agotar el contexto o el
tope diario de uso y publicar lotes a medias. El tamaño queda parametrizado en
`RUTINA.md` para subirlo cuando se compruebe que aguanta.

## Fase 1 — Esqueleto y datos

**D-09. Conversión de la tabla de gastos de DEV-08.** Factor 4.500 COP/€ con redondeo a
miles, como indica el enunciado. La conversión se verificó contra las cifras que el propio
enunciado da en DEV-12 (90.000, 441.000 y 531.000 COP) y coincide exactamente, lo que
confirma factor y redondeo.

**D-10. Catálogo de 63 productos y 150 clientes.** El catálogo se escribió a mano
(producto a producto) para que los nombres y precios sean verosímiles; los clientes se
generaron con un PRNG de semilla fija, porque son relleno y conviene que sean
reproducibles. Marcas de fabricante inventadas: Aqualinde, Verdaluz, Nórdica Baño,
Tierravera, Cerámicas Quindío, Hidrosur, Lumnia, Marmolina, Tecnograf y Bruma.

**D-11. Solo cuatro clientes profesionales superan los 50.000.000 COP.** El criterio H10
(cliente profesional estratégico) debe ser excepcional. Una primera versión del generador
dejaba a 21 de 30 profesionales por encima del umbral, lo que habría disparado H10 en el
70 % de los casos profesionales y falseado la demo.

**D-12. Los JSON se cargan con `import.meta.glob`, no con `fs`.** El sistema de archivos
de Vercel es de solo lectura en ejecución y las funciones serverless no incluyen archivos
que no estén referenciados de forma explícita. Con `import.meta.glob` los datos entran en
el bundle en tiempo de compilación.

**D-13. Variables de entorno con `astro:env`.** Astro trae validación con zod integrada y
`access: 'secret'` para impedir que un secreto llegue al cliente. Todas se declaran
`optional` para que el proyecto compile y muestre el tablero aunque el alumno todavía no
tenga tokens.

**D-14. El tablero y el detalle no se prerenderizan.** A partir de la fase 4 fusionan las
respuestas humanas leídas en vivo desde GitHub, así que deben renderizarse en el servidor.
Solo se prerenderizarán las páginas estáticas, como la de política.

**D-15. Las vistas de fases posteriores existen como marcadores.** `/humano`, `/lotes`,
`/metricas` y `/como-funciona` responden 200 con una nota de en qué fase se construyen, en
lugar de dejar enlaces rotos en la navegación.

**D-16. El lote semilla tiene 30 % de ruta humana.** Dentro del rango orientativo de 25-35 %
del enunciado. `validar.mjs` avisa (sin fallar) si un lote se sale del rango sin registrar
una alerta que lo explique.

**D-17. El caso de spam se atribuye a un cliente del maestro.** El esquema exige un cliente
en toda solicitud y el formulario web es público, así que el spam aparece asociado al
registro de un cliente existente. Es un artefacto del modelo de datos, no un descuido.

## Fase 2 — Orquestador y agentes

**D-18. Cada agente devuelve `justificacion`, pero no se guarda donde podría parecer.**
La justificación de 2 a 4 frases va al paso correspondiente de `traza`, no dentro de
`clasificacion`, `analisisPolitica` ni `decision`. Así la línea de tiempo de la web tiene
el relato completo y los objetos de datos quedan limpios, sin campos de prosa mezclados con
los que se usan para calcular métricas.

**D-19. Los subagentes se registran al iniciar la sesión.** Los archivos de
`.claude/agents/` creados a mitad de sesión no se pueden invocar por su nombre hasta que la
sesión se reinicia. En la rutina de la nube no es un problema, porque el repositorio se
clona antes de arrancar la sesión. Para la ejecución local de la fase 2 se invocó a cada
agente pidiéndole que leyera primero su propia definición y actuara conforme a ella, lo que
conserva el aislamiento de contexto y, de paso, comprueba que los `.md` funcionan como
instrucciones.

**D-20. El generador guarda `_referencia` y el orquestador la aparta de inmediato.**
La etiqueta de control viaja del generador al archivo del lote sin pasar por ningún otro
agente. Si el clasificador la viera, la medición de precisión dejaría de significar nada.
Es el punto donde más fácil sería hacer trampa sin darse cuenta.

**D-21. El supervisor aprueba lo correcto aunque sea mejorable.** Devolver un borrador tiene
un coste real: a la segunda devolución el caso escala a una persona por H09. Un supervisor
demasiado exigente convertiría en trabajo humano casos que la IA resolvía bien, que es justo
lo contrario de lo que la demo quiere enseñar.

**D-22. El payload del disparador se trata como contenido no confiable.** La documentación
de rutinas confirma que el texto llega envuelto en un bloque `<routine-fire-payload>`
marcado como no confiable, y que el prompt guardado debe optar explícitamente por leerlo.
`RUTINA.md` extrae solo `modo` y `tamano` e ignora cualquier otra instrucción, porque
cualquiera que tenga el token del disparador puede enviar ese texto.

**D-23. Un lote roto no tumba la ejecución.** Si la validación falla tras dos correcciones,
el lote no se publica, el error se registra en `data/estado/rutina.json` y la rutina
continúa con el siguiente. Con cuatro lotes diarios, perder uno es mucho mejor que perder
los cuatro.

**D-24. Los mensajes de commit de la rutina empiezan por `lote:` o `metricas:`.** Nunca por
`hitl:`, que está reservado a la web y hace que Vercel omita el despliegue. Una rutina que
publicara con ese prefijo dejaría la web congelada sin que nada pareciera fallar.
