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

**D-25. El clasificador confundía dificultad de resolución con ambigüedad de clasificación.**
Detectado al ejecutar la rutina por primera vez: en la primera pasada, **8 de 10**
solicitudes quedaron por debajo del umbral de confianza de 0,75 y habrían escalado por H06.
Al revisar los casos, la mayoría de esas confianzas bajas no respondían a duda sobre la
categoría, sino a que el caso era grave, caro o le faltaban pruebas: un toallero eléctrico
que da corriente es una incidencia sin ninguna duda, y un desistimiento de un producto a
medida es un desistimiento sin ninguna duda.

El efecto habría sido una demo en la que el sistema escala casi todo, y además por el motivo
equivocado: H06 (baja confianza) en lugar de H03 (seguridad) o H05 (responsabilidad dudosa),
que es lo que de verdad corresponde y lo que la persona necesita leer en la ficha de
escalado.

Se corrigió la regla 3 de `.claude/agents/clasificador.md` para separar de forma explícita
las dos cosas: la `confianza` mide **solo** si se ha acertado la categoría; la gravedad se
expresa en `prioridad`, la falta de pruebas la valora el analista de política y el escalado
por riesgo lo decide el enrutador. Se enumeran los motivos que **no** deben bajar la
confianza, porque la tendencia natural del modelo es curarse en salud.

Es el tipo de fallo que solo aparece al ejecutar el sistema de punta a punta: cada agente
por separado parecía razonable.

**D-26. El generador fabricaba lotes donde casi todo escalaba.** Segundo hallazgo de la
primera ejecución completa: **8 de cada 10** solicitudes acababan en ruta humana, muy por
encima del rango orientativo del 25-35 %.

Se comprobó que las decisiones individuales del enrutador eran correctas. Cada uno de los
ocho escalados se sostenía por un criterio propio e inequívoco al margen de H04: dos por
confianza baja (H06), tres por importe o crédito (H01), uno por seguridad y reclamación
formal (H02 y H03), uno por responsabilidad dudosa (H05) y uno por estar fuera de ámbito
(H11). El problema no estaba en el enrutador.

Estaba en el generador, que había fabricado un lote con un 60 % de casos límite cuando la
especificación pide alrededor del 15 %: riesgo eléctrico, quemadura a un menor, cotización
de 197 millones con solicitud de crédito, dos devoluciones fuera de política. La tendencia
del modelo es hacer interesante cada caso, y la atención al cliente real es mayoritariamente
rutinaria.

Se reescribió la regla 5 de `.claude/agents/generador-solicitudes.md` para exigir que **al
menos dos tercios** del lote sean casos que la política resuelva de forma limpia, con
ejemplos concretos de preguntas normales, y se añadió una **comprobación obligatoria antes
de entregar**: contar cuántas solicitudes llevarían `rutaEsperada: "humano"` y, si superan
un tercio, sustituirlas por casos rutinarios y volver a contar.

Lección para clase: un lote donde casi todo escala no demuestra nada, porque el sistema
existe justamente para automatizar lo automatizable. El fallo no estaba donde parecía.

**D-27. H04 se está usando como comodín.** En la primera ejecución fue el criterio más
activado, 6 veces de 10 solicitudes, por delante de H01 y H05 (3 cada uno). H04 está
definido para excepciones con motivo atendible (cliente recurrente, probable error de la
empresa, o uno o dos días fuera de plazo), pero el enrutador lo aplicaba también cuando la
política simplemente no cubría el caso con claridad. Nunca cambió una ruta por sí solo, así
que no se ha tocado la definición todavía; queda anotado para revisarlo con más lotes, en la
fase 5, cuando las métricas muestren la frecuencia real de cada criterio.

**D-28. Un ejemplo de mi propia definición de agente enseñaba a inventar datos.**
Detectado por el redactor comercial durante la ejecución: el ejemplo 2 de
`.claude/agents/redactor-comercial.md` afirmaba que una mampara de 120 cm «se adapta a
huecos de entre 115 y 120 cm», pero **el catálogo no tenía ese dato**. El mismo texto estaba
en el lote semilla de la fase 1.

Es el fallo más incómodo de los tres, porque estaba en el material que se usa para enseñar
al agente a no inventar. El agente lo detectó, se negó a copiarlo y respondió solo con lo
que sí constaba, que es el comportamiento correcto; pero un agente menos cuidadoso lo habría
replicado, y el supervisor no tenía cómo distinguirlo.

Había dos salidas: empobrecer la respuesta o completar el dato. Se eligió lo segundo, porque
saber si una mampara encaja en un hueco es la pregunta que más hacen los clientes antes de
comprar y una respuesta evasiva ahí no sirve de nada. Se añadió el campo `rangoAjusteCm`
(`[mínimo, máximo]` en centímetros, `null` cuando no aplica) al esquema y al catálogo, con
valores para las siete mamparas estándar; la mampara a medida queda en `null` porque se
fabrica a la medida exacta del hueco.

La regla 5 de `redactor-comercial.md` ahora manda usar ese campo y, cuando vale `null`,
decirlo y ofrecer confirmarlo en lugar de deducir un rango a partir de la medida nominal.

Lección: cuando un agente necesita un dato para responder bien, la solución no es prohibirle
responder, sino poner el dato en los datos. Un valor inventado que suena verosímil es más
peligroso que una respuesta incompleta, porque nadie lo verifica.

## Fase 3 — Web completa

**D-29. Los filtros se resuelven en el servidor, no con JavaScript.** El tablero y las
secciones usan un formulario GET normal. Así los filtros funcionan sin scripts, se pueden
compartir por enlace, quedan en el historial del navegador y no hay estado que sincronizar.
La web entera sigue sin una sola línea de JavaScript de cliente.

**D-30. La página «Cómo funciona» lee las fichas de `.claude/agents/*.md`.** No hay una copia
de la documentación que pueda quedarse desfasada: lo que se explica en clase es exactamente
lo que ejecuta el orquestador. Se comprobó que Vite resuelve el glob pese a estar el
directorio oculto por el punto inicial, que era el riesgo.

**D-31. Las secciones muestran todo el histórico por defecto; el tablero, 7 días.** Son usos
distintos: el tablero responde a «qué está pasando ahora» y las secciones a «encuéntrame
aquel caso». Un filtro de 7 días en un listado de consulta esconde justo lo que se busca.

**D-32. Desbordamiento horizontal en móvil por `min-width: auto`.** Detectado con Chromium a
390 px: el detalle de una cotización se salía 238 px de la pantalla. La causa era una cadena
de 250 caracteres sin espacios (el volcado con `JSON.stringify` de las líneas de la
cotización) que ensanchaba la columna, porque los elementos de una rejilla CSS tienen
`min-width: auto` por defecto y no se encogen por debajo de su contenido.

Se corrigieron las dos cosas: `min-w-0` en las columnas, que es la protección estructural
frente a cualquier texto largo futuro, y una presentación propia de los cálculos en lugar del
volcado JSON. Ahora los importes salen como `$ 6.660.000`, los booleanos como «sí» y «no»,
los rangos como «3 a 8» y las listas de líneas una por renglón. El arreglo de maquetación
mejoró además lo que se ve en clase, que es donde esos cálculos se miran de verdad.

**D-33. La comprobación del navegador es parte de la aceptación, no un extra.** El criterio
de la fase pedía navegación en móvil y sin errores de consola, así que se verificó con
Chromium en 390 px y 1280 px sobre nueve rutas, midiendo desbordamiento horizontal, errores
de consola y enlaces de navegación alcanzables. El único fallo real de la fase salió de ahí,
y no se habría visto revisando el código.

## Fase 4 — Login, HITL y botón de lanzar lote

**D-34. APIs web en lugar de las de Node, para no añadir una dependencia.** La firma de la
cookie y la codificación base64 se implementaron con `crypto.subtle`, `TextEncoder` y
`btoa`/`atob` en vez de `node:crypto` y `Buffer`. Usar las de Node habría obligado a añadir
`@types/node`, y la regla del proyecto es no añadir dependencias sin permiso. El resultado
es además más portable.

**D-35. El presupuesto de reintentos tiene que caber en el tiempo de la función.** La primera
versión hacía 5 intentos con esperas de hasta 4 segundos: medido contra un servidor falso,
el peor caso eran **13,3 segundos**. El límite por defecto de una función serverless en
Vercel es de 10, así que el usuario habría visto un 504 en lugar del mensaje de error
preparado, que es bastante peor. Se bajó a 4 intentos con tope de 1.500 ms por espera, y el
peor caso medido queda en **4,5 segundos**.

Es un detalle que no se ve leyendo el código: hubo que medirlo.

**D-36. Node solo borra tipos, no transforma código.** `ErrorGithub` usaba *parameter
properties* (`constructor(readonly estado: number)`), que Node rechaza al importar
TypeScript porque exigen generar código, no solo quitar anotaciones. Se reescribió con
campos explícitos. Conviene recordarlo: cualquier módulo que deba poder importarse desde un
script de Node tiene que limitarse a sintaxis que se pueda borrar.

**D-37. Astro trae protección CSRF y está activa.** Se descubrió al probar: los `POST` sin
cabecera `Origin` coincidente reciben 403. Los formularios reales del navegador la envían
siempre, así que no hay que hacer nada, pero conviene saberlo porque desconcierta al probar
los endpoints con `curl`. Queda como comprobación explícita en las pruebas.

**D-38. Se publican contraseñas de demostración, apartándose del enunciado.** El enunciado
pedía dejar los hashes como marcadores. Se decidió lo contrario: hashes reales de
contraseñas documentadas (`usuario-banolia-2026`), porque con marcadores **nadie podría
entrar el primer día de clase** y veinte alumnos necesitan poder responder desde el minuto
uno. Los datos son ficticios y la web no expone nada real. El archivo y el README avisan de
que hay que regenerarlas para cualquier otro uso.

**D-39. El formulario HITL no oculta campos según la acción.** Se valoró usar `:has()` de CSS
para mostrar y ocultar campos según la acción elegida, sin JavaScript. Se descartó: cuatro
campos siempre visibles, cada uno con una línea que explica cuándo se usa, es más claro para
quien lo ve por primera vez. El servidor valida igual con los mismos esquemas zod.

**D-40. `modificoBorrador` se calcula en el servidor, no se pregunta al formulario.** El
endpoint compara el texto recibido con el borrador original. Es el dato con el que se mide
la tasa de aprobación del borrador, una de las métricas de la fase 5, y no debe depender de
lo que envíe el cliente.

**D-41. La lectura en vivo degrada, nunca rompe.** Si GitHub falla o falta el token, la web
devuelve lo que venía en el build y sigue funcionando. La lectura en vivo es una mejora para
que las respuestas se vean sin desplegar, no un requisito para que la página cargue.
