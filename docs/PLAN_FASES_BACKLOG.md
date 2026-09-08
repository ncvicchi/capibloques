# Nuevas fases de CapiBloques

Plan elaborado el 8 de septiembre de 2026 a pedido del propietario. **Sólo planificación: no autoriza iniciar implementación ni modificar servidores.** Complementa el [plan principal](PLAN_MULTIUSUARIO_PROXMOX.md) y asigna todos los pedidos del [backlog](BACKLOG.md).

La antigua fase 11 de producción pasa a llamarse **Fase final**, sin número y **postergada**. Las nuevas fases continúan con enteros 11–17; no hay fases con letras ni entregas parciales presentadas como fases completas. La fase 10 conserva su aceptación física pendiente por falta de Wemos. Primero se prepara el contexto portable para continuar desde otra cuenta; las mejoras de interfaz pueden comenzar después con autorización propia sin dar por hecha esa prueba.

## Orden y cobertura

| Fase | Entrega completa | Pedidos del backlog | Dependencia |
| --- | --- | --- | --- |
| 11 | Contexto portable y traspaso a otra cuenta | Pedido adicional del propietario | Documentación y estado verificable; sin migrar secretos ni datos |
| 12 | Editor despejado, navegación de escena, sesión sin interrupciones y guía visual Wemos | 1, 6, 8 y 10; 9: Wemos | Traspaso de fase 11; pinout documentado para la guía, sin sustituir ensayo físico |
| 13 | Ejecución visual en los bloques y paralelo vertical | 4, 5 y 7 | Distribución de fase 12 |
| 14 | Componentes y bloques TX/RX serial | 3: TX/RX; 9: conexiones seriales | Wemos actual como primer destino; simulador y ambos generadores |
| 15 | Soporte completo ESP32-S3 DevKit y selección de placa | 2: DevKit; 9: guía visual DevKit | Modelo exacto identificado; incorporar el contrato TX/RX de fase 14 |
| 16 | Perfil Waveshare ESP32-S3 con pantalla de 5 pulgadas | 2: Waveshare; 9: guía visual Waveshare | Perfiles de fase 15 y modelo/revisión exactos identificados |
| 17 | Escena gráfica y controles locales en el display | 3: display interactivo | Perfiles de pantalla de fase 16 y ejecución/componentes existentes |
| Final | Producción, HTTPS, respaldos y piloto | Antigua fase 11 | Postergada hasta autorización explícita y validaciones de salida |

Primero se asegura la continuidad desde otra cuenta sin depender de este chat; después se atienden los problemas cotidianos del editor. TX/RX se incorpora antes de las placas nuevas para tener un contrato de comportamiento que luego se valide en cada destino. Separar DevKit, Waveshare y display interactivo permite comprobar por separado placa, pantalla y aplicación gráfica: no son el mismo soporte.

## Fase 11 — Contexto portable y traspaso a otra cuenta

**Objetivo:** que otra cuenta o una conversación nueva pueda continuar el proyecto leyendo el repositorio, sin necesitar el historial de este chat ni adivinar decisiones.

Alcance:

- Crear una entrada única, `docs/CONTEXTO_PARA_CONTINUAR.md`, enlazada desde README y AGENTS, con un mensaje inicial listo para copiar a la nueva conversación y un orden de lectura. Enlazar las guías existentes en lugar de duplicar instrucciones que puedan divergir.
- Documentar producto, público, decisiones y motivos; arquitectura, mapa de carpetas, contratos críticos, herramientas y versiones fijadas; flujo desde bloques/JSON hasta simulación, Arduino/ESP-IDF, compilación y USB.
- Inventariar fases entregadas, pendientes y postergadas; problemas conocidos y backlog completo. Distinguir explícitamente implementación, compilación, pruebas simuladas y aceptación física: la falta de Wemos de fase 10 sigue abierta.
- Registrar un corte fechado: rama, commit de código verificado, estado del árbol, pruebas/CI y resultados, versión desplegada conocida por entorno y fuentes de evidencia. Si un dato remoto no se vuelve a verificar, señalar su fecha y que debe comprobarse, sin declararlo vigente por suposición.
- Explicar desarrollo local y DEV, túnel dedicado y acceso LAN/salto mediante configuración privada, servicios, despliegue, compiladores, diagnóstico, respaldos y recuperación. Separar comandos de consulta de los que cambian datos o reinician servicios; conservar los procedimientos ya probados.
- Recoger directivas del propietario: una fase completa por vez, avances frecuentes, commit/push, no adelantar producción, recursos limitados, prohibición de modificar el gateway y límites sobre Proxmox/router/Nginx. Las autorizaciones previas no habilitan acciones nuevas al cambiar de cuenta.
- Enumerar lo que no viaja con Git: credenciales, sesiones, permisos de GitHub/SSH, configuración privada, base de datos, artefactos temporales y borradores del perfil del navegador. Indicar qué debe aportar o autenticar el propietario por un canal privado, sin copiar valores, rutas de claves, datos de alumnos ni secretos al repositorio.
- Incluir pendientes inmediatos, bloqueos reales, riesgos y próxima acción autorizada; una lista de comprobación para retomar sin reinstalar ni borrar datos y un procedimiento para mantener actualizado el contexto al cerrar futuras fases.

Aceptación:

- Desde un checkout limpio se encuentra el punto de entrada y se reconstruyen estado, alcance, reglas, arquitectura y próximos pasos sin leer el chat. Todos los enlaces y comandos de consulta documentados tienen un destino verificable; las operaciones sensibles están identificadas.
- Revisar coherencia con plan, backlog, README y AGENTS; no confundir la nueva fase 11 con la antigua fase de producción. Verificar que los archivos del traspaso no contienen credenciales ni información privada infantil.
- Entregar contexto y mensaje inicial mediante commit/push. La nueva cuenta necesita permisos propios verificados antes de operar; no se promete transferir automáticamente chats, memoria, autenticación o sesiones de herramientas.

Esta fase documenta y prepara continuidad: no migra usuarios de CapiBloques, no crea cuentas externas, no cambia contraseñas y no despliega producción.

## Fase 12 — Editor despejado y sesión sin interrupciones

**Objetivo:** recuperar espacio para programar y armar escenas, poder explorar la escena con desplazamiento/zoom y mantener una sesión que no interrumpa cada cambio de ventana.

Alcance:

- Reorganizar encabezados, acciones de proyecto/cuenta y controles secundarios. Guardar/estado de guardado, deshacer/rehacer, ejecutar y detener deben seguir accesibles; no ocultar errores o cambios pendientes.
- Como objetivo de diseño en 1366 × 768: no más de dos filas de controles globales y al menos 70 % de altura del editor dedicada a bloques/escena. Medir antes/después; adaptar móvil y zoom sin sacrificar legibilidad para cumplir una cifra.
- Separar visual y funcionalmente catálogo de componentes y programa. El catálogo podrá ser un panel temporal superpuesto con cierre claro; arrastrar desde él debe seguir funcionando en Chrome/Edge y con alternativas de teclado.
- Agregar cámara de escena con desplazamiento, zoom hacia una zona y controles «Ver toda la escena»/restablecer, tanto al editar como al simular y revisar en modo docente de sólo lectura. Distinguir herramienta «Mano» o gesto de navegación de mover objetos/accionar controles; incluir botones +/−, ratón, teclado y táctil sin secuestrar el scroll o zoom accesible de la página.
- Mantener la cámara separada del modelo: navegar no altera posiciones, dimensiones lógicas, simulación, firmware, JSON, autoguardado ni historial. Aplicar la transformación inversa al seleccionar/arrastrar, conservando cuadrícula y límites; respetar permisos y Guardar/Cancelar. El encuadre permanece durante ejecutar/pausar/pasos, sin seguimiento automático de objetos; ofrecer límites y recuperación explícita de la vista completa.
- Complementar el listado de conexiones con una imagen fiel de la Wemos D1 R32, pines/conectores etiquetados y resaltado por componente. Abrir/ampliar la guía bajo demanda, sin ocupar permanentemente el espacio de programación. Listado e imagen comparten los datos validados del proyecto, distinguen GPIO de etiqueta física y conservan advertencias eléctricas; no dibujar una conexión directa cuando se requiere resistencia, driver o alimentación externa. Usar un recurso propio o autorizado y contrastar el mapa con documentación de la placa, no con un pinout inventado.
- Eliminar comprobaciones de sesión disparadas exclusivamente por `focus`, `blur` o cambio de visibilidad. Propuesta inicial: chequeo periódico centralizado cada 60 segundos, discreto, sin desmontar el editor ni mostrar una pantalla de validación si sigue vigente; deduplicar solicitudes y temporizadores atrasados.
- Mantener expiración conocida, señales explícitas de cambio de cuenta/cierre y revocaciones. Cada operación remota conserva autorización en servidor; las guardas de acceso fresco a proyectos, descargas y grabación USB no se eliminan para reducir peticiones.
- En errores de red, conservar el trabajo y distinguir conexión perdida de contraseña incorrecta o sesión revocada. No introducir autenticación offline ni cambiar silenciosamente de cuenta.

Aceptación:

- Cambiar repetidamente de pestaña dentro del intervalo no produce peticiones de sesión por foco, pantalla intermedia, reinicio del simulador ni pérdida de selección/borradores.
- Comprobar vencimiento real, revocación, cuenta cambiada, temporizador vencido mientras la pestaña estaba suspendida y red lenta/cortada. No se duplican verificaciones ni se autoriza una operación con permisos retirados.
- Probar catálogo, arrastre, escenas, guardado manual/automático, recuperación y deshacer/rehacer con ratón y teclado en Chrome/Edge; escritorio de altura limitada, móvil y zoom.
- Probar navegación de escena ampliada y desplazada: seleccionar/mover sin saltos, controles simulados sin gestos ambiguos, revisión sin edición, ajuste al redimensionar y retorno a vista completa. Navegar no modifica el JSON ni crea operaciones de guardado/deshacer; ejecutar conserva el encuadre y el resultado lógico, sin perder borradores.
- Verificar que imagen y listado Wemos coinciden al cambiar conexiones, agregar/quitar componentes, importar y deshacer/rehacer. Pines, orientación y etiquetas deben corresponder a la placa documentada; conflictos y conexiones incompletas se identifican sin sugerir un montaje válido. La guía visual no sustituye la aceptación física pendiente de fase 10.

No incluye todavía progreso dentro de bloques, cambio de disposición de paralelo ni nuevas placas/componentes. Esos pedidos tienen su fase propia.

## Fase 13 — Ejecución visual y paralelo vertical

**Objetivo:** entender qué está pasando mirando el propio programa, sin que el lienzo se desplace solo.

Alcance:

- Cambiar la presentación de «Al mismo tiempo» a la disposición vertical pedida, con hilos visualmente distinguibles. Al comenzar esta fase, fijar la orientación exacta con una propuesta visual para evitar interpretar de maneras distintas «vertical» y «en paralelo»; no cambiar su semántica fork/join.
- Mantener posición y escala del programa durante ejecutar, pausar y avanzar pasos. El resaltado no desplaza el lienzo; centrar un bloque, si se ofrece, es una acción manual.
- Mostrar en cada delay el tiempo restante con número y barra; en acciones que lo permitan, iteración/estado local. No inventar porcentajes para acciones sin duración conocida.
- Cada hilo muestra su propio avance. La cabecera conserva sólo estado global/controles y errores relevantes; la información pedagógica detallada se traslada a su bloque o dispositivo.
- El progreso es transitorio: no modifica el JSON, no dispara autoguardado, no crea pasos de deshacer ni se copia como parte de un favorito. Limpiar indicadores al detener, reiniciar o cambiar de proyecto.

Aceptación:

- Programas largos y varios caminos con delays distintos, bucles, condiciones y contadores compartidos: progreso legible sin saltos de scroll/zoom.
- Pausa, velocidad y modo guiado conservan el reloj lógico y las trazas de resultados. No hay progreso de un hilo atribuido a otro ni animaciones que sigan ejecutándose después de Stop.
- Compatibilidad al abrir proyectos existentes y deshacer/rehacer cambios de bloques; prueba visual de la disposición acordada y del contraste/movimiento reducido.

No incorpora seguimiento físico de bloques ni cambia la lógica del firmware para imitar una animación de la web.

## Fase 14 — TX/RX serial programable

**Objetivo:** que el programa pueda enviar mensajes y tomar decisiones según mensajes recibidos por un puerto serial configurable.

Alcance:

- Componente de conexión serial con puerto y pines válidos para el perfil de placa. Opciones de velocidad y fin de mensaje con valores iniciales simples y ayuda; validar conflictos y compatibilidad eléctrica antes de cablear.
- Bloque TX para enviar texto y bloque RX para comparar con un mensaje prearmado y bifurcar en igual/distinto. La comparación usa mensajes completos, no fragmentos arbitrarios de una lectura.
- Definir delimitador, codificación, normalización y límites. Si todavía no llegó un mensaje, RX espera cooperativamente: no ejecuta «distinto». Dar una salida/estado de timeout explícito y comprensible.
- Buffers y colas acotados, política visible para mensajes excesivos, cancelación al detener y tratamiento determinista cuando más de un hilo usa el mismo puerto.
- Simular recepción desde un panel de pruebas del navegador y visualizar lo enviado. Generar el equivalente autónomo para Arduino y ESP-IDF, inicialmente en Wemos.
- Guardar/restaurar configuración y bloques con el proyecto; actualizar validación de servidor, exportación/importación, compilación y guía de conexiones. Reservar/rechazar puertos en conflicto con programación o consola según el perfil.
- Reflejar TX/RX y sus reasignaciones tanto en el listado como sobre la imagen de la placa de fase 12, con la misma validación de pines y conflictos.

Aceptación:

- Ejemplo de robot que recibe «AVANZAR» y ejemplo de semáforo que recibe una orden. Probar igualdad, diferencia, ausencia, timeout, fragmentación, varios mensajes juntos, texto largo y concurrencia.
- El resto de los bloques sigue avanzando mientras RX espera. Resultados del simulador y firmware concuerdan; ambas salidas compilan y se validan en una Wemos identificada con un emisor serial de prueba.
- Consola USB/monitor y UART del componente no se confunden. No se agrega envío de órdenes desde el monitor web de fase 10: esto es comunicación del programa autónomo, no control remoto de la placa desde el navegador.

## Fase 15 — ESP32-S3 DevKit y perfiles de placa

**Objetivo:** elegir explícitamente el destino y completar para DevKit el recorrido proyecto → simulación → fuentes → compilación → USB.

Requisito antes de fijar el perfil: modelo y revisión exactos, módulo/memoria, conexiones USB y documentación del fabricante. No asumir que el nombre «ESP32-S3 DevKit» define una placa única ni elegir una compra por el usuario.

Alcance:

- Introducir identidad/capacidades de placa coherentes en proyecto, componentes, pines, generadores, cola, caché, manifiesto y grabador. Los proyectos existentes siguen siendo Wemos D1 R32; no se convierten automáticamente en S3.
- Selector de placa con confirmación y diagnóstico de conexiones incompatibles. Cambiar/cancelar/deshacer no pierde dispositivos ni reasigna pines a escondidas.
- Adaptar la guía visual de conexiones a una imagen técnica fiel de la DevKit exacta, con pines accesibles, orientación y etiquetas verificadas. Cambiar placa debe cambiar imagen y mapa conjuntamente; conservar el listado y no mostrar el pinout Wemos sobre una S3.
- Validar GPIO, entradas analógicas, PWM, servos, buzzers, pantallas existentes y UART según el perfil confirmado. Mostrar limitaciones antes de compilar, no después de cablear.
- Compilar Arduino y ESP-IDF para el destino correcto, con herramientas fijadas. Comprobar espacio y memoria de DEV antes de extender la imagen; conservar cola, cupos, aislamiento y privacidad, sin aumentar recursos por suposición.
- En USB, detectar el chip y distinguir el mecanismo de conexión de la placa real; gestionar reinicio/reselección si corresponde. Direcciones de grabación y tamaño salen de metadatos de compilación validados para ese perfil, no de copiar el mapa Wemos.

Aceptación:

- Un mismo ejemplo se prueba en Wemos y DevKit con conexiones válidas para cada una; ambas herramientas generan/compilan y los proyectos anteriores siguen abriendo.
- Listado e imagen de conexiones concuerdan con el perfil físico y siguen sincronizados al cambiar/cancelar/deshacer la selección de placa o modificar pines; el recurso gráfico tiene procedencia y permiso de uso documentados.
- Un firmware de otra placa, memoria desconocida o rango inválido se rechaza. Guardar/cachear una compilación nunca mezcla destinos, cuentas o credenciales.
- Grabación y ejecución autónoma verificadas en la DevKit concreta, incluidas consola, PWM y un caso TX/RX. Registrar por separado pruebas de software y de hardware; no cerrar soporte físico sólo con mocks.

## Fase 16 — Waveshare ESP32-S3 de 5 pulgadas

**Objetivo:** incorporar el perfil real de la Waveshare, su pantalla y las entradas disponibles antes de construir una aplicación gráfica interactiva.

Requisito: modelo/revisión exactos y documentación del display, controlador, interfaz, resolución, memoria, alimentación y táctil si existe. No asignar de antemano un controlador ILI a esta pantalla ni dar por disponible el táctil.

Alcance:

- Extender perfiles de fase 15 con los recursos y pines reservados de esta placa; rechazar conexiones incompatibles y revisar consumo de memoria.
- Incorporar la imagen de la Waveshare ESP32-S3 de 5 pulgadas exacta en la guía de conexiones, además del listado. Señalar conectores/pines realmente disponibles y los reservados, con la cara/orientación necesaria para localizarlos; validar contra documentación del modelo/revisión y registrar procedencia/permiso del recurso gráfico. No representar un GPIO interno como conector accesible ni reutilizar el mapa de DevKit.
- Inicialización y refresco no bloqueante de su pantalla para Arduino y ESP-IDF. Integrar los mensajes y zonas de texto existentes; conservar **una sola pantalla por proyecto**.
- Si la unidad tiene táctil, incorporar lectura, orientación/coordenadas y una prueba local de entrada. Esto valida el dispositivo de entrada, no agrega aún controles de actuadores ni un diseñador de escenas gráficas.
- Ejemplos mínimos de mensajes/zonas y entrada, simulación acorde al perfil, JSON portable, fuentes, compilación privada y grabación USB específica.

Aceptación:

- La unidad real muestra texto/zonas correctamente, conserva orientación y registra entradas si tiene táctil. El refresco y entradas no detienen delays, UART o PWM.
- Presupuesto medido de memoria/tiempo, errores comprensibles y validación de pines ocupados; ambas herramientas y USB probados sin romper Wemos/DevKit ni las pantallas anteriores.
- Contrastar imagen, listado y unidad física de Waveshare: las marcas identifican el conector correcto para cada componente y se actualizan ante cambios de proyecto, sin ocultar conflictos con pantalla/táctil u otros recursos reservados.

La escena gráfica y la interacción con dispositivos se entregan en fase 17. Esta fase entrega soporte de placa/pantalla, no promete un tablero interactivo antes de implementarlo.

## Fase 17 — Escena y controles locales en pantalla

**Objetivo:** representar la escena en una pantalla gráfica y permitir accionar sus dispositivos desde controles locales del display.

Alcance:

- Vista gráfica adaptada a la resolución: posiciones, nombres/representaciones y estados de los componentes. No ejecutar el editor web dentro del ESP32 ni prometer una copia pixel a pixel del navegador; el display no se dibuja recursivamente a sí mismo.
- Configurar controles de los dispositivos existentes: acciones y velocidad/potencia según corresponda, mensajes y zonas de texto integradas. Mantener una pantalla por proyecto y una edición con Guardar/Cancelar, deshacer/rehacer e importación/exportación.
- Simular la misma interacción en la web. En hardware, los controles son locales a la placa/pantalla con una entrada compatible, no órdenes desde el navegador por Wi-Fi/USB.
- Resolver explícitamente quién controla un actuador cuando hay bloques y controles manuales: proponer un modo manual por dispositivo, con prioridad y transición de vuelta al programa visibles y deterministas. No permitir que dos escritores se pisen sin explicación.
- Usar una representación compartida de escena/controles para simulador y generadores Arduino/ESP-IDF, con límites de elementos, memoria y refresco medidos. Los perfiles sin entrada táctil no ofrecen controles físicos inoperables; las LCD de texto mantienen sus mensajes, no una escena gráfica.

Aceptación:

- Escena de dos semáforos y escena de semáforo con robot, mensajes y controles de potencia. Probar interacción manual/programada, cambio de modo, guardar/cancelar/recargar y diferencias de tamaño de pantalla.
- Equivalencia lógica entre simulación y firmware; capacidad gráfica declarada por perfil, compilación en ambos frameworks y ensayo físico en la Waveshare identificada. No extender automáticamente esa certificación a otro display sin probar su adaptación.
- Arranque y salida de modo manual seguros para el montaje verificado; no presentar el control gráfico como paro de emergencia ni confundir cerrar la pestaña con detener la placa.

## Fase final — Producción y piloto, postergada

Es la antigua fase 11, renombrada por decisión del propietario. No se ejecuta como consecuencia de terminar una fase del backlog.

Conserva su alcance: despliegue de producción en la VM correspondiente, dominio/HTTPS, secretos separados, permisos operativos, copias externas y restauración ensayada, reaplicación de registros de eliminación al restaurar respaldos antiguos, límites de compilación, carga representativa, monitoreo y reversión del despliegue. Validar el recorrido con administrador, docentes y alumnos de prueba antes de introducir datos reales o abrir el piloto.

Antes de iniciarla: nueva autorización explícita, inventario/acceso vigentes, decisión de qué perfiles integran el piloto y cierre físico de la fase 10 y de los perfiles/componentes que se vayan a ofrecer. No omitir incompatibilidades ni anunciar como soportado hardware no ensayado. Confirmar con el propietario cualquier cambio del alcance del piloto.

El gateway sigue siendo sólo un salto SSH, con prohibición de cambios. Tampoco se modifican Proxmox, router o Nginx sin la autorización específica correspondiente. No se aumenta capacidad de las VMs ni se reactiva Pages/Sites.

## Cómo se trabaja y qué falta decidir

- Una fase completa autorizada por vez, con implementación, pruebas proporcionales, entrega en DEV y commit/push. Informar avances con evidencia y pendientes; no inventar porcentajes ni tiempos exactos.
- Este plan **no inicia la fase 11**. La próxima a autorizar es «Contexto portable y traspaso a otra cuenta». Su alcance no incluye implementar las fases 12–17.
- No se necesitan placas para decidir el rediseño. Para fases 15 y 16 sí hacen falta modelos exactos antes de fijar drivers/pines; para cerrar las entregas físicas hace falta hardware identificado y autorización para reemplazar firmware.
- La disposición exacta del paralelo se fija al abordar fase 13; formato de mensajes/timeout en fase 14; prioridad manual/programa y límites gráficos en fase 17. Son decisiones dentro de esas fases, no nuevas fases con letras.
- No hay estimaciones horarias comprometidas: hardware, alcance de la adaptación gráfica y mediciones en la VM condicionan el esfuerzo. No retrasar ahora la planificación esperando esos datos, ni prometer implementaciones específicas de un modelo no identificado.
