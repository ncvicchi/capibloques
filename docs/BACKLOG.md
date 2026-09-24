# Backlog de CapiBloques

Pedidos del propietario desde el 7 de septiembre de 2026, registrados durante distintas entregas. El 8 de septiembre se asignaron a las [nuevas fases](PLAN_FASES_BACKLOG.md), precedidas por una fase de contexto portable para otra cuenta. **La fase 12 implementa los pedidos 1, 6, 8 y 10, y la parte Wemos del 9; la fase 14 implementa los pedidos 4, 5 y 7**. Alcance, pruebas y límites en sus guías de entrega. Los restantes siguen pendientes. Los números de este archivo identifican pedidos, no fases. Las notas de «no interrumpir» son históricas, referidas a la entrega que transcurría cuando se hizo cada solicitud; no sustituyen el estado ni las autorizaciones del plan vigente.

## 1. Redistribuir la interfaz

Problema reportado: la parte superior está sobrecargada, con aproximadamente siete líneas de encabezados/controles que dejan muy poco espacio para programación y escena.

- Rediseñar la distribución general, no limitarse a reducir márgenes o letra.
- Dar prioridad al espacio útil de los bloques y la escena; agrupar acciones de proyecto/cuenta y presentar detalles secundarios bajo demanda.
- Mantener visibles y accesibles ejecución, pausa/paso, estado de guardado, deshacer/rehacer y avisos importantes, sin apilar encabezados permanentes.
- Verificar escritorio de altura limitada, móvil, teclado y texto ampliado; medir espacio realmente disponible para editar y simular.

El ajuste menor de espacios de fase 6 no resolvía este pedido. La reorganización de **fase 12** recupera altura útil medida: 54,9 % → 80,6 % a 1366 × 768, con dos filas globales y detalles bajo demanda.

## 2. Soporte ESP32-S3

- Agregar perfiles de placa para **ESP32-S3 DevKit** y **Waveshare ESP32-S3 con display de 5 pulgadas**.
- Conservar el perfil Wemos D1 R32 y la compatibilidad de sus proyectos.
- Incorporar capacidades, pines reservados, conexiones, validación, generación, compilación y posterior grabación para cada perfil, tanto en Arduino como en ESP-IDF según las fases acordadas.
- No tratar las dos placas nuevas como intercambiables ni trasladarles automáticamente el mapa de pines de Wemos.

La DevKit quedó identificada e implementada en fase 16. La segunda unidad es **Waveshare ESP32-S3-Touch-LCD-5, SKU 28117**: módulo ESP32-S3-WROOM-1-N16R8, LCD RGB táctil **800 × 480**, GT911 por I2C, 16 MiB de flash y 8 MiB de PSRAM. Resolución, revisión y esquema fueron contrastados con la [documentación oficial de Waveshare](https://docs.waveshare.com/ESP32-S3-Touch-LCD-5) al implementar la fase 17; su prueba física permanece separada.

Al implementar, definir cómo se elige o cambia la placa sin perder dispositivos ni ocultar conexiones incompatibles. No trasladar el mapa de DevKit: la pantalla ocupa la mayoría de GPIO y la placa usa CH422G para backlight, resets, tarjeta e I/O aisladas.

## 3. Nuevos componentes

### Display interactivo

**Software entregado en fase 18; despliegue DEV y aceptación física pendientes.** La [guía de fase](FASE_18_CONTROLES_LOCALES.md) registra el alcance acordado: tablero táctil de hasta seis estados lógicos, prioridad manual por objeto y retorno al último estado del programa, sin fingir GPIO o salidas físicas en la Waveshare SKU 28117.

- Mostrar la escena en el display.
- Permitir controlar manualmente los dispositivos agregados mediante controles de esa vista.
- Representar en el simulador el comportamiento esperado y preservar la escena/configuración en JSON.

Precisar al diseñar: qué vista corre en el navegador y cuál en el display físico; qué entradas táctiles tiene cada placa; qué sucede si un bloque y un control manual actúan sobre el mismo dispositivo. Este pedido no se interpreta como autorización para agregar control remoto de la placa desde la web: el alcance previo excluye ese control en vivo y cualquier cambio debe acordarse explícitamente.

### TX/RX serial reasignable

**Entregado y verificado en DEV/CI en fase 15; aceptación física Wemos pendiente.** El nombre visible es **Mensajes**, con modos Enviar, Recibir o ambos. La [guía de fase](FASE_15_MENSAJES.md) fija bloques, trama protegida, simulación, límites y evidencia.

- **TX:** enviar mensajes por el puerto serial elegido.
- **RX:** recibir mensajes y compararlos con mensajes fijos/prearmados, con caminos **igual / distinto**.
- Puerto y asignaciones configurables según las capacidades/pines de la placa; no asumir que todo se transmite por la consola USB de diagnóstico.
- Permitir probar envío/recepción y bifurcaciones en el navegador antes de programar la placa.

Decisión cerrada: velocidad inicial 9600 en la escena; mensajes UTF-8 prearmados de hasta 120 bytes; cabecera, versión, tamaño, CRC-16 y cierre automáticos; ramas igual/distinto/no llegó y espera cooperativa. La consola USB permanece separada.

## 4. Disposición de «Al mismo tiempo»

Pedido durante la implementación de fase 7: cambiar la disposición del bloque a **vertical en lugar de horizontal**, para poder ver los hilos en paralelo. **Implementado en fase 14** con caminos apilados y conexiones `BRANCH0…BRANCH15`, preservando orden, importación/exportación y deshacer/rehacer.

## 5. Bloques estáticos al ejecutar

La vista se desplaza sola en cada paso, incluso cuando el programa completo ya está visible; al crecer, los saltos confunden. El propietario pide **dejar estático el programa durante la ejecución**. **Implementado en fase 14:** el resaltado no mueve el lienzo y centrar el último bloque requiere una acción manual.

## 6. Separar catálogo y programa

El panel de bloques de una categoría se mezcla visualmente con los bloques del programa. Separar claramente ambas superficies. El catálogo puede superponerse temporalmente al elegir una categoría y ocultarse después, dejando el programa despejado. Verificar arrastre, cierre, foco y teclado en Chrome/Edge. Se registró sin interrumpir fase 7; **implementado en fase 12** con fondo opaco, cierre explícito/Escape y cierre después del arrastre.

## 7. Progreso dentro del bloque o componente

Pedido durante el cierre de fase 9: trasladar la información de progreso del «header de estado» al bloque o componente que está ejecutándose, para no obligar a mirar otra zona de la pantalla.

- En esperas/delays, mostrar el tiempo restante en el propio bloque mediante un indicador gráfico, numérico o ambos.
- Aplicar el mismo criterio a otras acciones con progreso, relacionando claramente la información con su bloque o dispositivo.
- Preservar legibilidad, pausas/reanudación y pasos guiados; si hay caminos concurrentes, cada uno debe mostrar su propio progreso sin mover el lienzo ni mezclar sus tiempos.
- Este pedido se relaciona con la redistribución de la interfaz y los bloques estáticos; no implica cambiar el reloj lógico del simulador o del firmware ni agregar seguimiento físico en vivo.

**Implementado en fase 14:** cada camino muestra bloque, espera, tiempo restante, barra e iteración cuando corresponde; los dispositivos muestran su acción local. El estado es transitorio y se limpia al detener, reiniciar o cambiar de proyecto.

## 8. No revalidar la sesión al recuperar el foco

Pedido durante fase 10: al salir de la página y volver a enfocarla, la validación de sesión interrumpe repetidamente la experiencia y resulta molesta.

- Quitar el chequeo disparado sólo por perder/recuperar el foco o cambiar de pestaña.
- Mantener un chequeo periódico cada intervalo definido, sin bloquear ni reemplazar el editor cuando la sesión sigue vigente.
- Conservar comprobaciones frescas en operaciones que requieren permisos, expiración, cambios explícitos de cuenta/cierre de sesión y revocaciones reales. Resolver el problema de UX sin permitir acceso con una sesión revocada.
- Probar cambios frecuentes entre pestañas, regreso antes/después del intervalo, red lenta/cortada y vencimiento real, sin perder trabajo ni duplicar solicitudes.

Se registró sin interrumpir fase 10. **Implementado en fase 12:** reloj compartido de 60 segundos, sin consulta por foco/visibilidad y sin desmontar el editor por una sesión igual; expiración conocida, señales explícitas y permisos remotos conservados.

## 9. Conexiones sobre una imagen de la placa

Pedido del 8 de septiembre de 2026: donde se indica cómo conectar los componentes, **conservar el listado y complementarlo con una imagen de la placa**, inicialmente Wemos D1 R32 y, al incorporar su perfil, Waveshare ESP32-S3 con pantalla de 5 pulgadas.

- Mostrar una fotografía o ilustración técnica fiel del modelo/revisión seleccionado, con orientación reconocible y pines/conectores señalados. Incluir también la DevKit cuando se entregue su perfil; no reutilizar la imagen ni el mapa Wemos para otra placa.
- Relacionar cada componente del listado con sus conexiones en la imagen mediante etiquetas y resaltado, sin depender sólo del color. Distinguir nombre físico del conector/pin y GPIO; permitir ampliar la vista sin añadir encabezados permanentes al editor.
- Derivar listado y marcas gráficas de la misma configuración/validación de conexiones del proyecto. Cambiar pines o placa, agregar/quitar componentes, importar y deshacer/rehacer debe mantener ambas vistas sincronizadas; no asignar pines automáticamente desde una imagen.
- Conservar advertencias y requisitos eléctricos del montaje, incluidas alimentación, masa común, resistencias o drivers cuando correspondan. La imagen no debe sugerir conectar directamente un actuador que necesita una etapa intermedia ni presentar un conflicto como cableado válido.
- Usar imágenes propias o con permiso/licencia documentados y contrastar etiquetas/coordenadas con la documentación de la placa exacta; no generar ni adivinar pinouts. Para Waveshare, representar los conectores realmente accesibles y los recursos reservados por pantalla/táctil según el modelo confirmado.

Asignación: **fase 12 implementó la guía visual Wemos**, con dibujo propio, mapa contrastado y selección por componente/GPIO sincronizada con listado; fase 15 ya incorporó TX/RX. **Fase 16 entregó en software la guía de la DIYmall ESP32-S3-DevKitC V1.0 N16R8**; su aceptación con conexiones físicas sigue pendiente. **Fase 17** hará lo propio para la Waveshare exacta. La ilustración no sustituye una prueba eléctrica.

## 10. Desplazamiento y zoom de la escena

Pedido del 8 de septiembre de 2026: la programación permite desplazarse y ampliar, pero la escena no. Permitir **mover la vista y hacer zoom sobre zonas de la escena**, además de recuperar fácilmente la vista completa.

Estado histórico anterior a fase 12: Blockly permitía navegación y SceneStage sólo ajustaba la vista al contenedor, sin cámara. Era una limitación, no una prohibición explícita. **Fase 12 incorpora [SceneViewport](../components/scene-viewport.tsx)** al editar, simular y revisar; cámara transitoria, controles/teclado y gesto táctil en modo Mano, sin capturar la rueda o zoom accesible de la página.

- Agregar navegación de la vista en Armar escena y en la simulación, incluida la revisión docente de sólo lectura, sin conceder edición donde no corresponde. Zoom con controles +/−, rueda/gestos acotados a la escena y alternativas de teclado/táctiles; permitir acercarse a la zona indicada por el usuario.
- Incorporar desplazamiento mediante herramienta «Mano» o gesto explícito, distinguible de seleccionar/mover un componente y de accionar controles simulados. El zoom no debe apropiarse del desplazamiento de toda la página ni impedir su ampliación accesible.
- Ofrecer «Ver toda la escena» y restablecer zoom/centrado, con límites que eviten perderse en un lienzo vacío. Mantener el encuadre elegido durante ejecutar, pausar y avanzar pasos; no seguir automáticamente al robot ni saltar de zona por resaltados.
- Separar cámara y modelo: navegar no cambia posiciones, tamaño lógico, distancias, límites del simulador ni firmware. No marca el proyecto como modificado, no dispara autoguardado ni ocupa deshacer/rehacer. La cámara es estado de interfaz, no parte del JSON portable ni de la futura escena física en pantalla.
- Convertir correctamente coordenadas de pantalla a escena al seleccionar/arrastrar con zoom y desplazamiento, preservando ajuste a cuadrícula y límites. No perder borradores ni romper Guardar/Cancelar o la interacción con sensores/actuadores simulados.

Asignación: **fase 12**, implementada como parte de la usabilidad del editor. Pruebas en Chrome/Edge, teclado y gesto táctil sintético: acercar una sección, desplazar, seleccionar/mover, ejecutar conservando encuadre, volver a vista completa y comprobar que navegar no cambia JSON. No añade control físico en vivo.

## 11. Acceso externo persistente a DEV

Pedido del 12 de septiembre de 2026: poder acceder a DEV desde fuera de la LAN mediante el Nginx existente en la infraestructura Proxmox y un dominio administrado por el propietario en GoDaddy, quedando operativo como servicio aun cuando la PC de trabajo se cierre.

- Usar un subdominio HTTPS dedicado y mantener frontend/API en el mismo origen. El propietario crea el registro DNS exacto después de recibir los valores verificados; sus credenciales no se comparten ni se versionan.
- Modificar únicamente la VM Nginx identificada y autorizada. No tocar el gateway, host Proxmox, router, PRD ni otros sitios como efecto incidental.
- No exponer directamente el servidor con HMR. Preparar un runtime persistente, con arranque al reiniciar, healthcheck, logs acotados y rollback.
- Permitir el origen interno sólo desde la VM Nginx. No publicar PostgreSQL, Docker, compilador o administración y conservar el túnel localhost para recuperación.
- Activar configuración HTTPS segura de Django: hosts/orígenes exactos, cookies seguras, CSRF y cabeceras de proxy controladas. DEV conserva datos ficticios; antes de publicarlo se acuerda una barrera adicional recomendada o se documenta explícitamente la alternativa elegida. No sustituye producción.
- Verificar desde una conexión realmente externa en Chrome y Edge, incluida sesión, guardado, simulación, compilación, descarga, contexto seguro para Web Serial, reinicio y renovación de certificado.

Asignación: **fase 13, implementada y verificada**. Evidencia y operación en [su guía](FASE_13_ACCESO_EXTERNO_DEV.md).

## 12. Desafíos progresivos

Pedido del 12 de septiembre de 2026: agregar una sección de **desafíos de complejidad creciente**, entretenidos y suficientemente exigentes para que los chicos mejoren tanto en el uso de CapiBloques como en programación.

- Organizar un recorrido gradual, con objetivos claros, una escena o situación atractiva y criterios de éxito observables. No exigir una única secuencia de bloques si distintas soluciones tienen el mismo comportamiento correcto.
- Enseñar de forma acumulativa: manejo del editor y la simulación; secuencias; esperas y estado; bucles; condiciones y sensores; contadores; caminos paralelos; mensajes y pantallas. Separar los retos que requieren hardware físico de los que se pueden completar enteramente en el navegador.
- Permitir abrir un proyecto inicial como copia personal, trabajar sin sobrescribir el enunciado, guardar y retomar. Ofrecer pistas graduales y explicaciones después de validar, sin convertir el reto en copiar una solución completa.
- Validar con varios escenarios o entradas cuando corresponda, para que una respuesta fija no pase por casualidad. Explicar qué falta sin revelar datos privados, código interno o el trabajo de otro alumno.
- Registrar progreso por cuenta con reglas explícitas de privacidad y revisión. No introducir rankings públicos, comparación entre alumnos ni recompensas que oculten si el concepto fue comprendido.
- Mantener accesibilidad, teclado, móvil, texto ampliado, importación/exportación y compatibilidad de proyectos. El catálogo de desafíos debe poder versionarse sin invalidar avances ya obtenidos.

Asignación: **Fase 19**, agregada al plan y pendiente de autorización propia. La cantidad y selección final del catálogo inicial se fijan al autorizarla; el plan propone una base verificable sin hacer depender los primeros retos de hardware.

## 13. Barra de desplazamiento residual del catálogo

Pedido del 12 de septiembre de 2026: al elegir un bloque aparece una barra de desplazamiento; al cerrar o retirar el área del catálogo desaparece el área de bloques, pero **la barra queda visible**.

- Reproducirlo al abrir categorías cortas y largas, cerrar con el botón, Escape y después de arrastrar un bloque al programa.
- La barra propia del catálogo debe ocultarse o retirarse junto con el catálogo. Las barras necesarias del programa continúan funcionando y no cambian de posición ni tamaño por ese cierre.
- Verificar ratón, teclado, escritorio de altura limitada, móvil y Chrome/Edge; el arreglo no debe recortar bloques, dejar una franja vacía ni mover el lienzo.

**Implementado el 13 de septiembre de 2026** como corrección de mantenimiento autorizada por el propietario con «corrijamo la barra residual del catalogo». La causa era que Blockly ocultaba el `flyout`, pero conservaba visibles sus elementos `.blocklyFlyoutScrollbar`. La revisión `d096fd9` los oculta cuando el catálogo está cerrado sin afectar `.blocklyMainWorkspaceScrollbar`.

La prueba automatizada cubre categorías cortas y largas, cierre con botón y Escape, cierre después de arrastrar, escritorio de altura limitada y móvil. Pasó en Chrome y Edge tanto localmente como contra DEV público; typecheck, lint, smoke, build y el CI completo también quedaron correctos. DEV quedó desplegado en `d096fd9` con API/base saludables, admisión abierta y planificador activo. Esta corrección no cambia la numeración de fases ni autoriza la Fase 15.

## 14. Reacciones animadas del avatar ante resultados

Pedido del 12 de septiembre de 2026: usar el avatar elegido por cada alumno como acompañante visual y mostrar una reacción breve cuando consigue o supera un desafío, compila o graba una placa, y también cuando una de esas acciones falla.

- **Éxito:** alternar acciones como saltar y levantar los brazos, dar una vuelta corta, lanzar confeti, mostrar una estrella o pulgar arriba y felicitar con una frase breve. Los animales pueden mover orejas o cola; los robots pueden iluminar ojos/paneles o hacer un pequeño baile.
- **Fallo recuperable:** comunicar qué ocurrió sin castigar ni avergonzar. Usar gestos como quedar pensativo, inclinarse, una lágrima breve, negar suavemente con la cabeza o mostrar un pequeño indicador de error; después recuperar una pose de ánimo e invitar a intentar otra vez. Reservar el enojo para una caricatura muy leve y nunca dirigirlo al alumno.
- Distinguir completar/superar un desafío, compilación correcta, grabación correcta, error de compilación, placa no detectada y error de grabación. No presentar «compiló» como «se grabó» ni «se grabó» como validación física del circuito.
- Reproducir cada reacción una sola vez por resultado idempotente y evitar bucles que distraigan. El estado debe seguir expresado con texto accesible y no depender sólo del movimiento, color o sonido.
- Respetar `prefers-reduced-motion` con una pose estática equivalente, permitir omitir la animación y no reproducir audio automático. Mantener foco, lector de pantalla, contraste y navegación por teclado.
- Resolver el avatar desde la cuenta activa y limpiar la reacción al cambiar de cuenta o revocar sesión. La reacción es estado transitorio de interfaz: no forma parte del JSON del proyecto, autoguardado, historial ni firmware.
- Preparar poses y piezas reutilizables para los conceptos 2D de cuerpo completo y sus futuros modelos 3D, sin afirmar que una ilustración 2D ya es imprimible o animable en 3D.

Los conceptos 2D de cuerpo completo ya están guardados en dos juegos: [detallados](../public/avatars/full-body/README.md) y [simples](../public/avatars/full-body-simple/README.md). Son referencias visuales para la futura adaptación 3D; todavía no son modelos STL ni animaciones integradas a la interfaz.

Asignación: **fase 22**. Depende de los resultados que expondrán fase 19 (desafíos) y fase 20 (compilación/grabación); la asignación no autoriza todavía su ejecución.

## 15. Asistente grande para compilar y grabar la placa

Pedido del 13 de septiembre de 2026: el flujo actual exige compilar, esperar la cola, revisar condiciones, habilitar acciones, conectar la placa y grabar. Conservar esas garantías, pero presentarlas como un **asistente grande y secuencial** para que los chicos no tengan que descubrir varios controles separados.

- Mostrar una sola tarea principal por paso, con título claro, explicación breve, indicador «Paso N de M» y botón grande. Permitir volver cuando sea seguro, cancelar sin perder el proyecto y retomar una compilación que siga vigente.
- Recorrer como mínimo: revisar programa y cableado; elegir opciones necesarias; confirmar el envío privado de datos temporales cuando corresponda; compilar y mostrar la espera; revisar el resultado; conectar/elegir la placa; aceptar las condiciones específicas de grabación; grabar; informar el resultado y los próximos pasos.
- Mantener visibles los estados reales: en cola, compilando, compilación correcta, binario listo, placa detectada, grabando, grabación correcta o error recuperable. No presentar «compiló» como «se grabó» ni «se grabó» como prueba física del circuito.
- No eliminar consentimientos, permisos, comprobaciones de sesión/cuenta, guardas de cableado, vigencia del binario, idempotencia, cuotas ni límites del compilador. Un retroceso o doble clic no debe crear trabajos o grabaciones duplicadas.
- Usar texto grande, alto contraste, controles táctiles amplios, foco administrado, lector de pantalla y teclado. Los detalles técnicos pueden desplegarse, pero el error principal debe explicar qué puede hacer el alumno a continuación.
- Conservar las pantallas actuales como base funcional y reutilizar sus estados; el asistente coordina el recorrido, no introduce otra definición de compilación o grabación.

Asignación: **fase 20**, junto con medición/progreso real del pedido 17. Se coordina después con las reacciones de fase 22, sin hacer que una animación sustituya el estado textual ni la acción siguiente.

## 16. Movimiento individual y grupal de bloques

Decisión del propietario del 13 de septiembre de 2026: invertir el gesto original de Blockly después de comprobarlo en la interfaz.

- El arrastre normal mueve solamente el bloque señalado y recompone la cadena anterior con el bloque que seguía, cuando las conexiones son compatibles.
- `Control` + arrastre mueve el bloque y todos los bloques siguientes como grupo. `Comando` ofrece el mismo comportamiento en macOS.
- El comportamiento se aplica a proyectos iniciales, importados, recargados y restaurados con Deshacer; no cambia el JSON ni introduce una selección persistente.
- La ayuda accesible explica ambos gestos. Deshacer restaura en una sola operación la estructura y posición anteriores.

**Implementado el 13 de septiembre de 2026** en `d818093`, con la compatibilidad del arrastre desde el catálogo corregida en `0fc9ff2`. La regresión real arma tres bloques, mueve el intermedio solo y con su continuación, y verifica la estructura exportada antes y después de Deshacer. Pasó en Chromium y en Chrome/Edge junto con el arrastre desde el catálogo; también pasaron el archivo completo de experiencia de programación, typecheck, lint, smoke y build. El CI completo [34740573404](https://github.com/ncvicchi/capibloques/actions/runs/34740573404) fue correcto y ambos recorridos pasaron 4/4 sobre DEV público. DEV quedó desplegado en `0fc9ff2`, saludable, con admisión abierta y planificador activo.

## 17. Comprender, medir y mejorar la compilación de binarios

Pedido del 13 de septiembre de 2026: explicar con precisión cómo se genera un binario para ESP32, cómo entra y avanza por la cola, y revisar oportunidades de mejora. La interfaz debe dejar de mostrar solamente «Compilando» durante una espera larga y comunicar progreso real sin exponer información privada ni inventar exactitud.

- Documentar el recorrido vigente de extremo a extremo: validación y guardado del proyecto; admisión e idempotencia; posición/espera en cola; planificador, reserva y lease; preparación del trabajo aislado; generación de fuentes; compilación y enlace; empaquetado, hash, disponibilidad y vencimiento del binario; cancelación, error, reintento y limpieza.
- Medir con fixtures sintéticos cuánto tarda cada etapa, cuánto se espera por capacidad y dónde se consume CPU, memoria, disco e imágenes. Contrastar los límites de DEV antes de proponer concurrencia, cachés o cambios de receta.
- Exponer estados verificables al alumno: «validando», «en cola», «esperando turno», «preparando compilador», «compilando», «enlazando firmware», «preparando descarga» y resultado. Mostrar tiempo transcurrido y última actividad; indicar posición sólo si la cola puede calcularla sin mentir.
- No mostrar un porcentaje preciso cuando la herramienta no suministra unidades confiables. Si se estima tiempo restante, usar un rango basado en mediciones suficientes, identificarlo como estimación y actualizarlo sin saltos engañosos.
- Permitir desplegar detalles comprensibles y diagnósticos sanitizados. Nunca mostrar código o proyectos de otra cuenta, SSID/clave, secretos, comandos internos peligrosos ni logs crudos que puedan contenerlos.
- Revisar confiabilidad: doble envío, ACK perdido, cancelación pendiente, lease vencido, reinicio del planificador, proceso Docker todavía activo, artefacto vencido y actualización de la interfaz después de desconexiones. Conservar reserva hasta confirmar que el compilador terminó.
- Agregar una vista administrativa con etapas, tiempos y fallos agregados que permita detectar cuellos de botella sin abrir proyectos privados. Toda optimización debe compararse con una línea base y conservar aislamiento, techo de recursos, compilación sin red y limpieza de secretos.
- Coordinar esta información con el asistente del pedido 15: el asistente presenta el recorrido al alumno; este pedido define y mejora los estados reales que lo alimentan.

Asignación: **fase 20**, antes y como fundamento del asistente de compilación/grabación. No habilita aumentar recursos de la VM ni relajar aislamiento, privacidad o límites de concurrencia.

## 18. Displays I2C: LCD alfanumérico 20 × 4 y OLED SSD1306 128 × 64

Pedido aclarado el 14 de septiembre de 2026: considerar ambos tipos de pantalla. La fotografía aportada muestra un **LCD alfanumérico 2004A de 20 columnas × 4 filas** con una mochila `LCM2004 IIC`, del tipo PCF8574, con `GND`, `VCC`, `SDA`, `SCL`, selectores de dirección y ajuste de contraste. No es el display gráfico Winstar 128 × 64 descrito inicialmente.

- CapiBloques ya implementa el perfil **LCD 20 × 4 · PCF8574 I2C**: texto directo en 20 × 4 celdas, mochila estándar, direcciones PCF8574 `0x20–0x27` y PCF8574A `0x38–0x3F`. La unidad física Winstar/2004A y su mochila deben comprobarse antes de afirmar compatibilidad: código exacto, integrado, mapeo de pines del expansor, dirección configurada, tensión y niveles I2C.
- El componente visible se llama **Pantalla de texto** desde el 19 de septiembre de 2026. El nombre anterior, «Pantalla de mensajes», no cambia el tipo JSON `display`: proyectos guardados o importados siguen siendo compatibles.
- También conservar el perfil ya implementado **OLED SSD1306 128 × 64 · I2C**. Es una pantalla gráfica monocromática por píxeles, habitualmente en `0x3C` o `0x3D`; CapiBloques la presenta actualmente como una rejilla de zonas de texto de 16 × 8 celdas con fuente de 8 × 8.
- **Ampliación implementada en software el 19 de septiembre de 2026:** LCD permite texto directo o animado; OLED/TFT permiten además dibujos monocromáticos de 16 × 8. Hay siete figuras predeterminadas —incluidos avatares de capibara, robot y gato— y hasta 12 dibujos editables por proyecto. Los efectos son aparecer/desplazarse/parpadear para texto y quieto/deslizar/parpadear para dibujos; la velocidad se configura una vez en la escena. Simulación y firmware avanzan cooperativamente, sin bloquear otros caminos.
- Ambos perfiles siguen siendo opciones distintas dentro del contrato de una pantalla por proyecto. Elegir uno no convierte proyectos, direcciones, drivers ni cableado del otro.
- Verificar físicamente el LCD 20 × 4 aportado con texto, las cuatro filas, limpieza, actualización, contraste y dirección incorrecta en Arduino y ESP-IDF. Mantener diagnósticos de bus y actualización cooperativa; compilar no demuestra compatibilidad eléctrica ni visual.
- Si más adelante aparece un Winstar **gráfico** 128 × 64 diferente del SSD1306, registrarlo por su código de producto, controlador y adaptador antes de agregar otro perfil.

Los dos tipos ya están considerados por software. Queda pendiente la aceptación física del LCD Winstar/2004A exacto y la identificación de su mochila; no requiere crear un perfil nuevo si coincide con el PCF8574 estándar vigente.

## 19. Matriz de LED 32 × 8 con cuatro MAX7219 encadenados

Inventario físico confirmado el 20 de septiembre de 2026 para cerrar la fase 23: LCD Keypad Shield 16 × 2 paralelo con cinco botones por ADC, LCD 20 × 4 con mochila I2C, TFT ILI9341 SPI y matriz 32 × 8 de cuatro MAX7219. El Keypad Shield requiere un perfil combinado nuevo; no es el `lcd1602` PCF8574 ya implementado. El propietario confirmó que la pantalla 16 × 2 y sus botones funcionan correctamente. El contrato y orden de integración están en [FASE_23_MATRIZ_LED.md](FASE_23_MATRIZ_LED.md).

**Software implementado; aceptación física pendiente.** La [guía del componente](FASE_23_MATRIZ_LED.md) registra el contrato acordado: una unidad 32 × 8 por proyecto, editor de hasta 12 dibujos, brillo/orden/giro de 180°, cuatro bloques, simulación cooperativa y generación Arduino/ESP-IDF. La fase 23 completa sigue abierta por las pruebas eléctricas de esta matriz y de los displays existentes.

Pedido aclarado el 14 de septiembre de 2026: incorporar el módulo de la fotografía, formado por **cuatro matrices monocromáticas de 8 × 8**, cada una controlada por MAX7219 y conectadas en cadena sobre una misma placa. La superficie lógica inicial es de 32 × 8 LED.

- Usar la interfaz serie del MAX7219 (`DIN`, `CLK`, `CS/LOAD`) y modelar explícitamente los cuatro dispositivos en cascada, su orden y orientación. No presentarlo como I2C ni confundirlo con una matriz RGB o LED direccionables individualmente.
- Permitir agregar una unidad 32 × 8 y dejar preparada una cantidad máxima explícita de unidades encadenadas, que se fijará según el hardware y el presupuesto de corriente/memoria. Guardar cantidad, orden y orientación en JSON y conservarlos al importar y deshacer/rehacer.
- Definir operaciones educativas simples: limpiar, brillo, píxel, fila/columna, icono o patrón. Incluir texto desplazable y animaciones sólo dentro de límites de tamaño, velocidad y memoria acordados.
- Simular la disposición y el estado en el navegador. Generar servicios cooperativos para Arduino y ESP-IDF, con buffers y frecuencia de refresco acotados para que la matriz no detenga delays, sensores, UART u otros caminos.
- Validar pines y conflictos según la placa; mostrar `VCC`, `GND`, `DIN`, `CLK`, `CS/LOAD` y el sentido de entrada/salida de la cadena. Documentar alimentación, masa común, desacoplo y adaptación de nivel si la unidad de 5 V no reconoce de forma confiable la lógica de 3,3 V. No alimentar la matriz desde un GPIO.
- Probar la unidad física completa: orden de los cuatro paneles, orientación, color, brillo, actualización, texto/patrones, desconexión y corriente máxima acordada. Probar más de una unidad sólo si ese encadenamiento entra en el alcance autorizado.

El comportamiento educativo inicial ya quedó fijado e implementado. Quedan por confirmar el color, modelo/revisión de la placa, tensión/corriente declaradas y orientación interna. La cantidad permanece en una unidad 32 × 8 hasta que una medición física justifique ampliarla. Asignación: **fase 23**, junto con la aceptación física de los perfiles LCD/OLED/TFT existentes.

## 20. Panel web local para controlar y observar desde un celular

Pedido del 14 de septiembre de 2026: aclarar qué hace el componente Wi-Fi actual y agregar una forma de enviar información, usar controles virtuales o ver la escena desde un celular. Propuesta: separar la **conexión de red** del **servicio web** que utiliza esa conexión.

Este pedido cambia deliberadamente el límite vigente que excluye control físico en vivo desde la web. La solicitud autoriza documentar y diseñar la propuesta, pero su implementación necesita un alcance de fase explícito, pruebas de seguridad y una regla clara de quién puede controlar la placa.

### Aclaración del componente vigente

El componente actual representa la radio Wi-Fi integrada del ESP32; no ocupa GPIO externos. Habilita los bloques «conectar a Wi-Fi» con timeout y «Wi-Fi conectado». En la simulación sólo permite indicar si hay una red disponible; al compilar solicita SSID/clave por el flujo privado. **No envía ni recibe datos de aplicación, no aloja páginas y no controla componentes.**

- Renombrarlo en la interfaz como **«Red Wi-Fi de la placa»** o **«Conectar la placa a Wi-Fi»** y explicar en la tarjeta, inspector y bloques: «Conecta la placa al router para que otros servicios puedan comunicarse».
- Mostrar por separado los estados sin configurar, buscando red, conectado, sin conexión y error/timeout. No representar un router dibujado como si ya existiera un canal de mensajes.
- Mantener las credenciales fuera del JSON, historial y logs; pedirlas sólo al exportar/configurar localmente o en la compilación privada ya autorizada.

### Nuevo componente propuesto: Panel web para celular

Agregar a la escena un servicio **«Panel web para celular»** que genere una página pequeña y autocontenida, servida por HTTP desde el ESP32 en la red local. No debe intentar alojar el editor React completo ni código HTML arbitrario creado por el usuario.

Decisiones del propietario del 14 de septiembre de 2026:

- Se admite **un solo celular emparejado** por vez. Una segunda sesión no toma el control ni desplaza silenciosamente a la primera; la liberación, reconexión y transferencia deben ser explícitas.
- El servicio funciona solamente en la **misma LAN** que la placa, a través del router. No incluye nube, acceso desde Internet ni modo punto de acceso propio del ESP32.
- Cada proyecto conserva **una sola escena activa**. La página del celular tiene dos vistas fijas: **Escena** y **Controles**.
- **Escena** representa la escena del proyecto que está ejecutando el firmware y se actualiza con sus estados lógicos reales. Es de sólo lectura: no edita posiciones, conexiones, bloques ni el proyecto y no afirma medir el estado eléctrico físico.
- **Controles** se genera dinámicamente y puede quedar vacío. Todos los tipos de entrada que tengan sentido pueden estar disponibles, pero ninguno aparece sólo por existir un actuador: se muestra únicamente cuando el alumno agregó un input virtual y lo relacionó mediante su programación.

Entradas y salidas dinámicas propuestas:

- Incorporar elementos virtuales sin GPIO: botón momentáneo, interruptor, deslizador, joystick, número y campo de texto. Su presencia y nombre forman el manifiesto web generado con el proyecto.
- Filtrar o sugerir inputs según los componentes de la escena —por ejemplo joystick para robot, deslizador para servo/motor/LED y texto para display—, sin crear una conexión automática. Los bloques visibles hacen la relación y permiten soluciones distintas.
- Si el programa recibe texto del celular y decide escribirlo en una pantalla, aparece el campo correspondiente. Agregar una pantalla sin esos bloques no crea por sí solo un input web.
- El programa puede publicar etiquetas, valores, indicadores y mensajes en Controles. La vista Escena obtiene los estados de los componentes desde el runtime, sin duplicar bloques de publicación para cada cambio normal.

Bloques iniciales propuestos:

- condiciones «botón web [nombre] está presionado» e «interruptor web [nombre] está encendido»;
- valores «deslizador web [nombre]» y «último texto recibido de [nombre]»;
- espera cooperativa «esperar acción de [control]» con timeout opcional;
- acciones «mostrar [texto/valor] en [indicador web]» y «actualizar la escena del panel»;
- una marca de mensaje nuevo para que el mismo texto no dispare una acción indefinidamente.

El diseño recomendado conserva «al comenzar» como entrada única del programa y trata los controles web como sensores/entradas que pueden consultarse o esperarse dentro de caminos normales. No vincular directamente un botón del celular con un motor por fuera del programa: las plantillas pueden preparar bloques sencillos, pero la decisión queda visible y programable por el alumno. El generador deriva de escena y programa un manifiesto cerrado de vistas, inputs, outputs y estados; el firmware no acepta que el celular agregue controles o código en ejecución.

### Ejecución desde el celular

- En un proyecto que contiene Panel web, al encender la placa primero se conecta a la LAN, inicia el servidor y queda en estado **«Lista para ejecutar»**. El botón grande **«Ejecutar»** del único celular emparejado inicia desde «al comenzar» el programa real del ESP32 y crea una nueva identidad de ejecución.
- Mientras corre, Escena y Controles pertenecen a esa misma ejecución. Cada input lleva orden e identidad para que un evento atrasado de una ejecución anterior no se aplique después de reiniciar.
- Cuando ya está corriendo, la acción cambia a **«Reiniciar programa»** y requiere confirmación. Reiniciar limpia estado cooperativo, eventos web pendientes y salidas conforme a una política segura antes de volver a «al comenzar»; no simula un reset eléctrico completo.
- **«Detener»** finaliza la ejecución actual y lleva actuadores a estados seguros definidos por tipo. Soltar el botón, perder foco o perder conexión libera inmediatamente botones momentáneos y centra el joystick; los demás valores y el tratamiento de una desconexión prolongada deben fijarse antes de implementar.
- Un proyecto sin Panel web conserva el arranque autónomo vigente al encender. La espera por «Ejecutar» es una propiedad explícita del servicio web, no un cambio silencioso para proyectos existentes.

### Acceso y funcionamiento

- Primera versión: celular y placa en la **misma red Wi-Fi**, sin nube, reenvío de puertos, acceso desde Internet ni punto de acceso propio de la placa.
- La placa publica un nombre local cuando sea compatible y siempre informa una dirección IP de respaldo. Integrar con el asistente de grabación una pantalla grande y un QR para abrir el panel, sin suponer que mDNS funciona en todos los celulares.
- Exponer un protocolo mínimo y acotado: página de sólo lectura, canal de estados y operaciones de entrada con IDs/tipos previamente generados. Evaluar eventos HTTP/SSE más `POST` o polling acotado según mediciones en Arduino y ESP-IDF; no introducir endpoints arbitrarios.
- Definir emparejamiento antes de implementar: código breve o token temporal, vencimiento/revocación y exclusión de una segunda sesión. Estar en la misma LAN no autoriza por sí solo a controlar una placa.
- Limitar clientes, tamaño/frecuencia de mensajes, texto, controles y actualizaciones. Sanitizar todo contenido, aplicar backpressure y continuar el programa aunque el celular se desconecte o envíe datos inválidos.
- Conservar ejecución cooperativa: atender HTTP nunca bloquea delays, sensores, PWM, UART, pantallas ni caminos paralelos. Arduino y ESP-IDF deben implementar el mismo contrato y compilar con dependencias fijadas y sin descarga de código en ejecución.

### Simulación y aceptación propuestas

- El editor ofrece una vista previa adaptable al tamaño de un celular y permite accionar los controles simulados sin una placa. El JSON guarda la definición del panel, no credenciales de red, tokens activos ni sesiones de celulares.
- Ejemplos de aceptación: dos botones o un joystick web controlan el sentido de un robot mediante bloques; un texto enviado se muestra en una pantalla sólo porque el programa lo relaciona; un deslizador regula brillo/velocidad; el celular ve la única escena activa de un semáforo actualizada mientras el firmware se ejecuta; un proyecto sin inputs muestra Controles vacío con una explicación.
- Probar conexión tardía, reconexión, texto vacío/largo, pulsos rápidos, dos clientes, orden de eventos, timeout, pérdida de Wi-Fi, programa detenido y cambio de proyecto. Definir quién puede escribir si hay más de un celular y mostrarlo claramente.
- Verificar consumo de RAM/flash, latencia y capacidad con fixtures sintéticos y placa física. No presentar la simulación, la compilación o una página abierta como validación del control físico.

Decisiones que se fijarán al iniciar su fase: comportamiento ante una desconexión prolongada del único celular; estados seguros exactos por actuador; método de emparejamiento; frecuencia de actualización y límites medidos. Asignación: **fase 24**; requiere autorización propia y no amplía por inferencia las fases anteriores.

## 21. Guardado estable durante el arrastre de bloques

Error informado el 15 de septiembre de 2026: durante ciertos arrastres aparecía «Una conexión del bloque … apunta a un bloque vacío» y el navegador no podía guardar. La causa era un estado transitorio de Blockly: al mostrar el marcador que anticipa dónde se encastrará el bloque, su serializador emitía momentáneamente una conexión `block: null`. Esa representación no es un documento válido y podía llegar tanto al autoguardado como al render de React.

**Implementado y desplegado el 15 de septiembre de 2026** en `2b97af9`. El editor conserva la última instantánea válida mientras hay un arrastre y publica el resultado estable al soltar. La validación de importaciones no se relajó: un archivo realmente corrupto con una conexión vacía continúa rechazándose.

La regresión mantiene un bloque sobre un punto de inserción durante más tiempo que los temporizadores de cambio y guardado, comprueba que el editor siga montado, que no aparezca el error y que el proyecto final sea exportable. Pasó localmente en Chromium, Chrome y Edge; también pasaron typecheck, lint, smoke, el archivo completo de experiencia de programación y build. El CI completo [34974885825](https://github.com/ncvicchi/capibloques/actions/runs/34974885825) fue correcto. Contra DEV público pasó 2/2 en Chrome/Edge. DEV quedó saludable en `2b97af9`, con admisión abierta, cero trabajos activos y planificador activo; API/base no se recrearon.

## 22. Vista educativa del estado lógico de los pines

Posibilidad propuesta el 19 de septiembre de 2026: junto al diagrama de la placa elegida, mostrar cómo cambia cada pin durante la simulación según el componente y su estado. Una salida digital puede indicar 0/1 y apagado/encendido; un semáforo o LED puede reflejar su color; PWM puede usar intensidad o gradiente; una entrada analógica puede mostrar valor y nivel. El objetivo es unir bloques, componente y cable físico de una forma comprensible para chicos.

Debe ser una **visualización lógica simulada**, no una medición eléctrica ni evidencia de que la placa real tenga ese voltaje. No depender sólo del color: incluir número, texto o patrón accesible; distinguir entradas, salidas, PWM, pines reservados y estados indeterminados. Usar el mismo perfil de placa, asignación y estado cooperativo que la escena, sin duplicar reglas ni inventar lecturas. Evaluar una vista compacta y otra detallada para no sobrecargar la interfaz.

Asignación: **fase 21**, dentro de la revisión de UX educativa y claridad del circuito. Antes de implementarla hay que probar proyectos grandes, ejecución en pausa/paso/paralelo y ambos perfiles de placa; la futura Waveshare se incorpora sólo después de definir su perfil exacto.

## 23. Reducir al mínimo la latencia de compilación

Objetivo propuesto el 19 de septiembre de 2026: medir el recorrido completo y reducir el tiempo entre pedir un firmware y poder descargarlo, aprovechando precompilación, cachés y reutilización segura.

Precompilar funciones o componentes **puede ayudar**, pero no debe asumirse como la optimización principal: Arduino y ESP-IDF ya compilan bibliotecas y componentes separadamente, y el código generado del proyecto igualmente debe compilarse y enlazarse. Primero instrumentar tiempos de cola, arranque de contenedor, preparación de toolchain, generación, compilación, enlace, empaquetado y descarga. Luego comparar con mediciones reproducibles:

- workers calientes o pools acotados por toolchain/perfil, sin mezclar trabajos ni credenciales;
- caché persistente de toolchains, dependencias y objetos por versión, flags, placa y receta;
- compilación incremental o componentes C/C++ precompilados con ABI y flags exactos;
- deduplicación privada de artefactos sin Wi-Fi y fuentes idénticas; nunca reutilizar binarios con credenciales;
- imágenes precalentadas, menos I/O/copias y paralelismo limitado según RAM/CPU real;
- caída segura a compilación limpia cuando una clave de caché no coincide.

Toda caché debe incluir toolchain, framework, placa, memoria, particiones, bibliotecas, receta y fuentes relevantes; una coincidencia parcial no es válida. Conservar aislamiento entre cuentas, limpieza de secretos y builds reproducibles. Medir latencia p50/p95, tasa de aciertos, consumo y equidad bajo concurrencia; no optimizar sólo una compilación de laboratorio.

Asignación: **fase 20**, ampliando el pedido 17 de medición y mejora del compilador antes de diseñar el asistente. La implementación se decide a partir del perfil medido en DEV; no se promete que una biblioteca monolítica precompilada sea la mejor opción.

## 24. Identidad del colegio como centro del ingreso

Pedido del 20 de septiembre de 2026: antes de iniciar sesión, el **logo y el nombre del colegio deben ser los protagonistas visuales**. No alcanza con que estén presentes como una marca secundaria: la pantalla debe comunicar primero a qué institución pertenece el espacio y después pedir alias y contraseña.

La composición debe funcionar con o sin logo configurado, nombres largos, pantallas pequeñas, texto ampliado, teclado y lector de pantalla. Debe conservar el nombre CapiBloques como producto sin competir con la identidad institucional, evitar saltos de diseño mientras carga la marca pública y no exponer información de alumnos. La gestión del nombre/logo y sus límites de archivo continúan usando el contrato seguro ya implementado para una institución por instalación.

Asignación: **fase 26 — Acceso de aula**, junto con la revisión completa del ingreso normal y supervisado. La aceptación incluirá jerarquía visual comprobable, foco inicial y errores de autenticación claros sin desplazar u ocultar la marca del colegio.

## 25. Familia de robots HP Robots | Otto

Pedido del 20 de septiembre de 2026: soportar robots **HP Robots | Otto** en sus distintas configuraciones. No se creará otra aplicación ni otro lenguaje visual: Otto será una familia de componentes/escenas prearmadas dentro del editor vigente. El alumno podrá usar bloques de alto nivel —caminar, girar, bailar, detenerse, emitir sonidos, expresar emociones y reaccionar a sensores— y, cuando corresponda al nivel didáctico, abrir el robot para ver o programar sus servos, buzzer, sensor, botones y matriz.

El perfil del robot debe declarar qué piezas tiene y reservar todos sus recursos como un conjunto, evitando que un mismo servo o pin aparezca libre. Movimientos y coreografías serán cooperativos y cancelables, no `delay()` encadenados que congelen sensores, mensajes u otros caminos. La escena mostrará postura/movimiento; la configuración avanzada incluirá centros, sentido y límites de servos, sin poner calibración mecánica dentro de los bloques infantiles.

La familia exacta se fijará contra el hardware disponible. Como referencia primaria, el fabricante distingue kits HP/Otto y documenta configuraciones como Otto básico, Wheels y Ninja; Ninja publica variantes de cuatro y siete servos con buzzer, sensor ultrasónico, matriz LED intercambiable, botón y comunicación inalámbrica. Eso no autoriza a tratarlas como eléctricamente equivalentes ni a reemplazar su controlador: se deben inventariar modelo, placa, actuadores, sensores, firmware y licencia de cada unidad antes de ofrecer el perfil. Fuentes: [tienda oficial Otto/HP Robots](https://www.ottodiy.com/store), [Otto Ninja oficial](https://www.ottodiy.com/ninja) y [FAQ oficial](https://www.ottodiy.com/blog/faq).

Asignación: **fase 27 — Familia de robots HP Robots | Otto**. Primero se diseña la matriz de configuraciones y el contrato de movimientos; luego se implementan sólo las variantes físicamente identificadas. Arduino y ESP-IDF deben compartir semántica, pero la compatibilidad con una placa/controlador oficial distinto del ESP32 no se infiere y requiere decisión expresa.

Avance del 20 de septiembre de 2026: se implementaron en software cinco configuraciones genéricas ESP32, desde el bípedo de cuatro servos hasta el humanoide de seis servos con buzzer, ultrasonido y matriz expresiva. Incluyen calibración, 17 movimientos cooperativos, brazos, sonidos, expresiones, distancia como dato, simulación, JSON y generación Arduino/ESP-IDF. No equivale a certificación HP ni a aceptación física. Las variantes comerciales Ninja y Wheels requieren inventario y desarrollo específico. Ver [FASE_27_OTTO.md](FASE_27_OTTO.md).

## 26. Barrera infrarroja digital

Pedido del 20 de septiembre de 2026: incorporar una barrera infrarroja formada por emisor y detector cuya salida útil sea digital. Para los chicos se presenta como un solo sensor con los estados **libre** e **interrumpida**, sin exponer una lectura analógica ni obligarlos a razonar en 0 y 1.

La escena debe permitir elegir el GPIO de entrada y configurar si el módulo físico informa la interrupción en nivel alto o bajo. Los bloques deben ofrecer una condición utilizable dentro de cualquier bifurcación —por ejemplo, «si la barrera está interrumpida»— y la simulación debe permitir alternar claramente entre ambos estados. Arduino y ESP-IDF deben leer la entrada sin bloquear; importación/exportación, validación de pines, diagrama de conexiones y estado simulado deben conservar la misma semántica.

Asignación: **fase 28 — Barrera infrarroja digital**. **Implementada en software el 20 de septiembre de 2026** con componente libre/interrumpida, polaridad en escena, dato sí/no, simulación, JSON y ambos generadores; contrato y pendiente físico en [FASE_28_BARRERA_INFRARROJA.md](FASE_28_BARRERA_INFRARROJA.md). Antes del ensayo físico se identificará la tensión y el tipo de salida del modelo disponible; esa comprobación no cambia su contrato infantil de dos estados.

## 27. Datos, variables y textos dinámicos

**Estado: implementado en software el 20 de septiembre de 2026.** Guía y contrato en [FASE_29_VARIABLES.md](FASE_29_VARIABLES.md).

Pedido del 20 de septiembre de 2026: permitir conservar y reutilizar datos de forma general. El caso inicial es mostrar «El contador está en …», pero el diseño no debe crear una acción especial por cada combinación de componente y destino.

Se propone un modelo infantil y tipado con variables de **número**, **texto** y **sí/no**; bloques para asignar, cambiar y leer; valores producidos por componentes —contador, sensor, botón, estado de conexión, mensaje recibido o posición—; y un bloque **armar texto** que combine fragmentos fijos con valores. El resultado se podrá enviar a consola, pantalla, Mensajes u otros destinos que acepten texto. Comparadores, cálculos y acciones consumirán los mismos bloques de valor, evitando familias duplicadas como «mostrar contador», «enviar contador» o «guardar contador».

La fase debe definir alcance por proyecto e hilo, valor inicial, conversiones explícitas, nombres únicos y límites adecuados para ESP32. Variables y expresiones formarán parte del JSON, historial, deshacer/rehacer, simulación y ambos generadores. La interfaz mostrará el valor durante la ejecución sin convertir datos internos en una cabecera global invasiva.

Asignación: **fase 29 — Datos, variables y textos dinámicos**. Entregado con variables número/texto/sí-no, asignación y cambio, valores de contador/sensores/botones/Wi-Fi/Mensajes, cuentas, comparación genérica, composición textual, inspector, JSON, simulación y ambos generadores. Se excluye deliberadamente la posición física del robot hasta que exista una fuente real medible; la posición puramente simulada no sería portable.

## 28. Temporizadores y eventos cooperativos

Pedido del 23 de septiembre de 2026: incorporar temporizadores que puedan consultarse como un valor o generar una acción al cumplirse, sin detener el resto del programa.

Se propone crear temporizadores con nombre y bloques infantiles para iniciar, reiniciar, pausar, continuar y detener. Cada temporizador expondrá su tiempo transcurrido o restante como un valor numérico reutilizable en comparadores. También podrá disparar un camino de eventos una vez o periódicamente. Estos eventos no serán interrupciones arbitrarias: entrarán en el mismo planificador cooperativo y determinista que `Al mismo tiempo`, animaciones y movimientos, de modo que un temporizador nunca congele sensores, mensajes ni otros caminos.

La fase debe fijar unidad, alcance, reinicio, repetición, orden cuando vencen varios temporizadores en el mismo instante, comportamiento al pausar la simulación y equivalencia con relojes monotónicos de Arduino/ESP-IDF. No se implementará con cadenas de `delay()` ni dependerá de la hora civil.

Asignación: **fase 30 — Temporizadores y eventos cooperativos**.

Estado: **implementada en software el 24 de septiembre de 2026; despliegue DEV y aceptación física pendientes**. Se entregaron nombres, una vez/repetir, iniciar/reiniciar/pausar/continuar/detener, espera cooperativa explícita, valores transcurrido/restante, progreso visible, JSON, simulador, Arduino, ESP-IDF y firmware intérprete 1.1.0. Contrato y límites en [FASE_30_TEMPORIZADORES.md](FASE_30_TEMPORIZADORES.md).

## 29. Procedimientos y funciones

Pedido del 23 de septiembre de 2026: permitir agrupar bloques reutilizables como procedimientos o funciones.

La interfaz distinguirá **hacer una tarea** —procedimiento que ejecuta acciones— de **calcular un valor** —función que devuelve número, texto o sí/no—. Ambos podrán recibir parámetros tipados con nombres comprensibles. La primera entrega debe priorizar llamadas visibles, validación antes de ejecutar y límites aptos para chicos y ESP32: sin recursión, sin creación dinámica de funciones y sin llamadas ocultas que vuelvan incomprensible el recorrido visual.

Definiciones, parámetros, llamadas y valores devueltos formarán parte de JSON, historial, copiar/pegar, deshacer/rehacer, simulación y generadores Arduino/ESP-IDF. Se deben detectar nombres repetidos, ciclos de llamadas, parámetros faltantes y tipos incompatibles con mensajes accionables.

Estado: **implementada en software en fase 31 el 24 de septiembre de 2026; despliegue DEV y aceptación de uso pendientes**. Se entregaron tareas, funciones número/texto/sí-no, hasta tres parámetros locales tipados, expansión acotada sin recursión, validación y los cuatro destinos de ejecución. Ver [FASE_31_PROCEDIMIENTOS_FUNCIONES.md](FASE_31_PROCEDIMIENTOS_FUNCIONES.md).

Asignación: **fase 31 — Procedimientos y funciones**.

## 30. Estados y valores consultables de componentes

Pedido del 23 de septiembre de 2026: cualquier componente debe poder ofrecer sus entradas, estados o valores relevantes para utilizarlos en condiciones, expresiones y textos. Ejemplos: barrera interrumpida, distancia medida, botón presionado, semáforo rojo/amarillo/verde/apagado, brillo de un LED, posición ordenada a un servo o potencia ordenada a un motor.

La fase 29 ya introdujo valores de algunos sensores y servicios; esta fase crea un **contrato de capacidades tipadas por componente** para extenderlo de manera uniforme. Cada perfil publicará únicamente datos con sentido —número, texto, sí/no o estado enumerado— y los bloques de valor sólo mostrarán opciones válidas para esa instancia. No se crearán decenas de bloques especiales por destino.

Debe distinguirse en la interfaz y documentación entre un valor **medido** por una entrada física y un estado **lógico/ordenado** por el programa. Por ejemplo, «semáforo en verde» describe la orden vigente, pero no demuestra eléctricamente que el LED encendió; un servo común informa el ángulo solicitado, no una posición real, salvo que exista un sensor de realimentación. Simulador, JSON y ambos generadores conservarán esa semántica, incluso con caminos paralelos.

Asignación: **fase 32 — Estados y valores consultables de componentes**.

Estado: **implementada en software el 24 de septiembre de 2026; despliegue DEV y aceptación física pendientes**. Incluye registro tipado por perfil, selectores comunes número/texto/sí-no, origen medido/ordenado/servicio, simulador, Arduino, ESP-IDF y firmware intérprete 1.2.0. Ver [FASE_32_ESTADOS_COMPONENTES.md](FASE_32_ESTADOS_COMPONENTES.md).

## 31. Red entre placas por Wi-Fi

Pedido del 23 de septiembre de 2026: completar y probar Wi-Fi con dos roles. Una placa podrá **crear la red** —punto de acceso, equivalente al rol maestro propuesto— y una o más placas podrán **conectarse a esa red** como clientes. La interfaz evitará depender de «maestro/esclavo» y explicará los roles por lo que hacen.

La primera versión se limitará deliberadamente a mensajería de aplicación entre el punto de acceso y clientes identificados. Permitirá enviar textos predefinidos y reaccionar al mensaje recibido mediante los bloques y condiciones de Mensajes. Debe definir transporte, direccionamiento/nombre de cada placa, framing, tamaño, orden, duplicados, timeout, reconexión, cantidad máxima de clientes y qué sucede cuando el receptor no está disponible. La simulación incluirá una red virtual determinista para probar al menos un creador de red y varios clientes sin hardware.

SSID y claves —tanto de una red externa como de la creada por la placa— siguen siendo secretos: no ingresan al JSON portable, historial, Git ni logs. La compilación privada conserva las reglas ya acordadas. Arduino y ESP-IDF deben implementar el mismo protocolo y se requiere prueba física antes de anunciar interoperabilidad.

Asignación: **fase 33 — Wi-Fi AP/cliente y mensajes entre placas**.

Estado: **implementada en software el 24 de septiembre de 2026; actualización de DEV y aceptación física con tres placas pendientes**. Incluye roles crear/conectarse, identidades, listas de pares y mensajes, recepción con tres caminos, simulación, protocolo binario versionado con CRC y deduplicación, Arduino, ESP-IDF y firmware intérprete 1.3.0. Ver [FASE_33_WIFI_ENTRE_PLACAS.md](FASE_33_WIFI_ENTRE_PLACAS.md).

## 32. Servicios y control remoto entre placas

Posibilidad posterior derivada del pedido anterior: una placa podría publicar capacidades autorizadas para que otra solicite cambios —por ejemplo, cambiar un semáforo remoto— o consulte estados. Se separa de la conectividad básica porque requiere identidad de placa, descubrimiento, permisos, confirmación, idempotencia, límites de frecuencia y una respuesta clara cuando el componente o la placa no están disponibles.

No se expondrán escrituras arbitrarias de GPIO ni nombres internos del proyecto. El protocolo utilizará servicios explícitos y permitidos por el autor, con comandos tipados, confirmación y estado observable. Sólo se implementará después de validar la mensajería de fase 33; hasta entonces, el mismo comportamiento puede construirse de forma segura enviando mensajes predefinidos y haciendo que el programa receptor decida qué acción local ejecutar.

Asignación: **fase 34 — Servicios y control remoto entre placas**, pendiente y opcional respecto de la mensajería base.

## 33. Luces RGB inteligentes WS281x y SK6812

Pedido del 23 de septiembre de 2026: agregar los LED RGB direccionables comúnmente llamados WS2812 o «NeoPixel», contemplando tiras, matrices y los formatos habituales.

Se propone una sola familia infantil **Luces RGB inteligentes**, con perfiles de forma en lugar de componentes incompatibles duplicados:

- **Tira o cadena:** cantidad de píxeles y sentido de DIN a DOUT.
- **Aro, barra o figura:** cantidad de píxeles y posición del primero; incluye formatos comunes como barras de 8 y aros de 8/12/16/24, sin limitarse a esas cantidades.
- **Matriz:** ancho, alto, esquina del primer píxel, recorrido por filas o columnas y orden continuo o zigzag. Las coordenadas lógicas siempre empiezan arriba a la izquierda aunque el cableado sea distinto.

La primera compatibilidad cubrirá WS2812B/WS2812 y SK6812 RGB de 800 kHz. WS2811 y RGBW quedarán como perfiles explícitos, no como supuestos silenciosos: pueden cambiar tensión, agrupación de píxeles u orden/cantidad de canales. La escena configurará GPIO de datos, cantidad/geometría, orden de color —por ejemplo GRB/RGB—, brillo máximo y presupuesto estimado de corriente. La guía exigirá respetar DIN/DOUT, masa común y alimentación externa cuando corresponda; no sugerirá alimentar una matriz grande desde el pin de la placa.

Los bloques infantiles incluirán apagar, color/brillo de todo el conjunto, píxel y tramo, degradado y animaciones predefinidas como arcoíris, persecución, pulso y barra de progreso. Las matrices agregarán punto, dibujo y texto cuando la geometría lo permita. Animaciones y refresco serán cooperativos y cancelables, con `esperar a que termine` sólo cuando el programa lo pida. La simulación mostrará el mismo mapeo, color, brillo y progreso sin convertir el consumo estimado en una medición real.

Arduino y ESP-IDF compartirán el framebuffer y la semántica. ESP-IDF usará un backend temporizado soportado —preferentemente `led_strip`/RMT— y se medirán conflictos con otros consumidores de RMT, PWM, audio, Wi‑Fi y memoria antes de fijar límites por placa. En ESP32 clásico, combinaciones grandes con Wi‑Fi requieren límites y prueba específica; ESP32‑S3 puede aprovechar RMT con DMA. No se prometerá una cantidad universal de LED antes de medir actualización, RAM, fuente y concurrencia.

Asignación: **fase 35 — Luces RGB inteligentes WS281x/SK6812**.

Estado: **implementada en software el 24 de septiembre de 2026; actualización de DEV y aceptación física pendientes**. Incluye escena, ayuda, simulador, conjunto/píxel/tramo/coordenada/degradado/dibujo, animaciones cooperativas, Arduino, ESP-IDF y firmware intérprete 1.4.0. Ver [FASE_35_LUCES_RGB.md](FASE_35_LUCES_RGB.md).

Referencias técnicas primarias: [ESP-IDF `led_strip`](https://docs.espressif.com/projects/esp-board-manager/en/latest/references/devices/led-strip.html), [RMT de Arduino ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/rmt.html), [formatos y protocolo NeoPixel](https://learn.adafruit.com/adafruit-neopixel-uberguide/form-factors), [mapeo de matrices](https://learn.adafruit.com/adafruit-neopixel-uberguide/neomatrix-library) y [alimentación/conexión](https://learn.adafruit.com/adafruit-neopixel-uberguide/basic-connections).

## 34. Firmware intérprete y ejecución directa en placa

Pedido del 23 de septiembre de 2026: evitar la compilación cotidiana mediante un firmware CapiBloques precompilado por placa. La web lo descargaría del servidor y lo instalaría mediante Web Serial la primera vez o al actualizarlo. Después, el navegador enviaría directamente reglas compactas con componentes, pines y programa, sin cola ni compilación. Al ejecutar se podrá elegir **Simulador** o **Placa conectada y seleccionada**; la placa conservará el programa y podrá devolver telemetría real de bloques y estados. Antes de cargar reglas se verifica obligatoriamente la versión: un firmware viejo o incompatible sólo permite actualizar o cancelar, nunca enviar de todos modos.

Arduino y ESP-IDF nativos se mantienen como alternativas. El servidor continúa construyendo/publicando versiones del intérprete, pero no compila una aplicación nueva por cada cambio del alumno.

Asignación: **fase 36 — Firmware intérprete y ejecución directa en placa**. La arquitectura, formato, flujo web, runtime, seguridad, compatibilidad, pruebas, criterios y decisiones pendientes están centralizados en [FASE_36_FIRMWARE_INTERPRETE.md](FASE_36_FIRMWARE_INTERPRETE.md).

Estado del 24 de septiembre de 2026: **terminado en software; despliegue en DEV y aceptación física pendientes**. Se implementaron reglas/ABI, `CapiLink`, selector Simulador/Placa, instalación Web Serial, persistencia posterior a verificación, telemetría, controladores actuales y builds reproducibles Wemos/S3 con capacidades fail-closed. Ambos intérpretes compilan y se empaquetan con ESP-IDF 5.5.5; ver el inventario y los límites precisos al inicio del documento de fase.

## 35. Herramientas pedagógicas revisadas, autoría de desafíos y bloque `según`

Pedido del 23 de septiembre de 2026: incorporar al diseño de desafíos todas las herramientas identificadas al revisar en profundidad Pilas Bloques —lenguaje, paleta acotada, escenarios variables, programas iniciales vacíos/incompletos/incorrectos, ejecución paso a paso, validación funcional y estructural separadas, pistas, progresión por contraste, actividades abiertas, accesibilidad, autoría visual, importación/descarga/compartición y recursos docentes— sin copiar sus desafíos. Agregar además una decisión múltiple infantil **`según [valor]`**, con casos tipados y «en cualquier otro caso», sin caída entre casos ni `break` visible.

Asignación: ampliación de la **fase 19 — Desafíos progresivos**. El inventario completo, segunda revisión de la versión 3.0.2 y su creador, diferencias, decisiones de adaptación, contrato de `según`, modelo de datos, autoría docente, validador, interfaz, progreso, plan de construcción y aceptación están en [FASE_19_HERRAMIENTAS_PEDAGOGICAS.md](FASE_19_HERRAMIENTAS_PEDAGOGICAS.md). Esta entrada única es la referencia; no crear otra fase por cada hallazgo.

## 36. Ayuda infantil de componentes

Pedido del 23 de septiembre de 2026: cada componente debe tener una ayuda asociada y contextual para chicos de 8 a 12 años. Debe explicar qué es, para qué sirve, cómo funciona, cómo se usa y simula, cómo se conecta a la placa elegida, qué piezas/alimentación necesita, sus variantes, límites y problemas frecuentes, con fotografía exacta o claramente marcada como ilustrativa.

Asignación: **fase 37 — Ayuda infantil de componentes**. El contenido obligatorio, puntos de acceso, modelo versionado, lenguaje, mantenimiento y aceptación están en [FASE_37_AYUDA_COMPONENTES.md](FASE_37_AYUDA_COMPONENTES.md).

Estado: **implementada en software el 24 de septiembre de 2026; actualización de DEV y evaluación con alumnos/docentes pendientes**. Hay 27 fichas base/perfil con conexiones derivadas de la escena, accesos contextuales, impresión y control automático de cobertura. Las imágenes actuales son ilustraciones locales declaradas, no fotografías de hardware exacto.

## 37. Lista maestra de componentes a implementar

Pedido del 23 de septiembre de 2026: centralizar todos los componentes adicionales recomendados, con prioridad, nombre infantil, perfiles físicos, capacidades, simulación, precauciones, componentes postergados y aceptación física. La lista incluye Luces RGB inteligentes, distancia, movimiento PIR, ambiente, joystick, potencia de baja tensión, inclinación/IMU, NFC/RFID, humedad de tierra, encoder, motor paso a paso, color, nivel de sonido, teclado matricial, agua/lluvia, balanza y GPS. No crear un componente infantil distinto por cada fabricante ni presentar sensores experimentales como dispositivos de seguridad.

Asignación: Luces RGB conserva la **fase 35**; las demás familias quedan asignadas a las **fases 38–41**. La única fuente detallada es [COMPONENTES_A_IMPLEMENTAR.md](COMPONENTES_A_IMPLEMENTAR.md), que distingue implementar, postergar y excluir del alcance inicial. Esta entrada no declara comprado, implementado ni ensayado ningún módulo.

## Pedidos externos a analizar

Informe externo recibido el 14 de septiembre de 2026. Esta sección conserva sus observaciones para reproducirlas y contrastarlas con el comportamiento vigente. **No confirma que cada problema exista y la asignación no autoriza implementarlos.** Progreso/guardado/reinicio corresponden a fase 20; superposición y los ajustes de claridad/escena corresponden a fase 21; avatar a fase 22; compartir a fase 25; acceso de aula a fase 26. Las prioridades «vital» y «sutil» pertenecen al informe de origen y cada observación debe reproducirse antes de cambiar código.

### Señalados como de vital importancia

1. **Progreso de compilación paso a paso.** Informar qué está sucediendo con cada pedido y, cuando exista una medida real, su avance. Se analiza dentro del [pedido 17](#17-comprender-medir-y-mejorar-la-compilación-de-binarios); no mostrar porcentajes inventados.
2. **Proyecto sin guardar al abrir Compilar y descargar firmware.** Dar mayor jerarquía al aviso «Hay cambios sin guardar o el proyecto todavía es local…», con color de advertencia, icono y una acción para Guardar desde ese recorrido. Analizar cómo reutilizar el guardado vigente, sus conflictos, su estado pendiente y la reanudación del flujo sin duplicar operaciones. Coordinarlo con el [asistente del pedido 15](#15-asistente-grande-para-compilar-y-grabar-la-placa).
3. **Reinicio automático después de grabar.** Verificar con hardware por qué la Wemos necesita actualmente pulsar RESET después del flasheo y si Web Serial/esptool puede controlar de forma confiable DTR/RTS o ejecutar el reinicio correspondiente. Conservar mensajes y recuperación cuando la placa o el adaptador no lo permitan; una grabación correcta no demuestra que el circuito funcione.
4. **Evitar bloques superpuestos.** Reproducir la superposición entre bloques sueltos y debajo del programa principal. Diseñar una separación automática que encuentre una posición libre sin alterar conexiones, orden, coordenadas portables o una cadena que el usuario esté intentando encastrar; cubrir zoom, desplazamiento, Deshacer y proyectos importados.

### Señalados como cambios sutiles

1. **Nombre de proyecto reconocible como editable.** Agregar una señal visual y accesible de edición, manteniendo lectura clara del nombre y funcionamiento con teclado, táctil y texto ampliado.
2. **Colores traducidos durante la ejecución guiada.** Mostrar nombres en español en los tooltips de la escena —por ejemplo, «Semáforo principal: rojo»— usando el mismo vocabulario visible de los bloques, sin modificar los valores internos del proyecto.
3. **Advertencias de conexionado más visibles y controlables.** Reproducir el tooltip de la barra inferior que dificulta la lectura; evaluar cierre explícito y un triángulo de advertencia con texto accesible. No depender sólo del color o del icono ni ocultar un conflicto eléctrico pendiente.
4. **Acciones de selección de avatar más grandes y claras.** Evaluar botones amplios con los textos «Seleccionar avatar» y «No cambiar mi avatar», conservando foco, teclado, táctil y confirmación de la elección.
5. **Escribir «segundos» en el bloque de Wi-Fi.** Sustituir la abreviación «s» donde corresponda sin cambiar el valor temporal, la serialización ni el código generado.
6. **Emoji de chincheta en el bloque de pin.** Evaluar `📌` para «pin … en encendido» sólo después de comprobar que no se use en otro bloque y que mejore la identificación con lector de pantalla y fuentes disponibles.
7. **Saludo personalizado en el encabezado.** Evaluar «Hola, {nombre visible}» acompañado por el alias en gris. Definir textos para docentes y administradores, evitar exponer identidad en pantallas compartidas y mantener contraste y espacio útil.
8. **Atenuar bloques fuera del programa ejecutable.** Definir con precisión qué significa «inactivo» —bloque suelto, desconectado de «al comenzar» o camino no ejecutado— y reducir saturación sin volver ilegible el bloque ni usar sólo color para comunicar el estado.

### Observaciones para posibles cambios futuros

1. **Auto-conectar y borrador de escena.** Reproducir que Auto-conectar no refleja cambios hasta «Guardar cambios» y que los componentes no pueden moverse durante el borrador. Analizar una vista previa inmediata y coherente con Guardar/Cancelar, sin persistir silenciosamente, mezclar escena pendiente con confirmada ni romper Deshacer, autoguardado o simulación.
2. **Simplificación adicional de barras y acciones superiores.** Auditar la interfaz posterior a fase 12 con chicos de 5–11 años, medir espacio vacío y cantidad de decisiones, y proponer lenguaje más cotidiano. Se relaciona con el [pedido 1](#1-redistribuir-la-interfaz), ya entregado en su alcance original; una nueva simplificación requiere alcance y pruebas propios.
3. **Avatar como asistente emocional.** Analizar personalidad, ubicación, frecuencia y mensajes del avatar. Coordinarlo con las [reacciones del pedido 14](#14-reacciones-animadas-del-avatar-ante-resultados), sin sustituir instrucciones, estados textuales ni accesibilidad.
4. **Compartir proyectos mediante enlace y QR.** Definir quién puede compartir y abrir, duración y revocación del enlace, copia frente a edición, proyectos de curso y protección de datos infantiles. No convertir un UUID en autorización ni publicar proyectos privados por defecto.
5. **Menús desplegables dentro de bloques más distinguibles.** Evaluar fondo, borde, icono y estados de foco comparándolos con los campos numéricos, con contraste suficiente en todos los colores de bloque.
6. **Operadores expresados con palabras.** Evaluar reemplazar o acompañar `=`, `<`, `≠` y otros símbolos con «igual a», «menor que» y «distinto de» en comparadores, contadores y bloques relacionados. Verificar tamaño, traducción, compatibilidad de proyectos y comprensión con alumnos.
7. **Mayor visibilidad de los emojis de bloques.** Revisar tamaño, contraste, posición, consistencia y alternativas textuales antes de aumentar todos de forma global; comprobar plataformas y fuentes distintas.
8. **Acceso de alumnos sin contraseña.** Investigar un ingreso de aula autorizado por el docente que también pueda registrar asistencia. Requiere un modelo explícito de identidad, sesión, caducidad, revocación, suplantación y equipos compartidos; no quitar contraseñas ni debilitar el acceso actual como ajuste de interfaz.

### Asignación completa del informe externo

| Observación | Fase |
| --- | --- |
| Progreso real de compilación; proyecto sin guardar; reinicio posgrabación | 20 |
| Bloques superpuestos | 21 |
| Nombre editable; colores traducidos; advertencias; selector de avatar; «segundos»; pin; saludo; bloques inactivos | 21 |
| Auto-conectar/mover en borrador; simplificación de barras; menús; operadores; emojis | 21 |
| Avatar como asistente emocional | 22 |
| Compartir mediante enlace y QR | 25 |
| Acceso de alumnos sin contraseña y asistencia | 26 |

Esta tabla asigna cada observación implementable. No garantiza que el problema exista: fase 21 exige reproducir o descartar cada informe antes de modificar el producto.

### Idea experimental descartada — no implementar ni usar

- **Selector de ángulos con reloj.** El informe pide expresamente no implementarlo ni usarlo en el producto actual. No es trabajo pendiente ni requiere fase; se conserva sólo para evitar que otra conversación lo trate por error como requisito.

Antes de implementar estos pedidos: reproducir cada observación sobre la versión DEV vigente, registrar evidencia sin datos reales y detectar duplicados o conflictos con contratos existentes. La revisión puede descartar o reformular una observación; las asignaciones están en fases 20–26 y no cambian el orden de las fases 15–19.

## Relación actualizada con el plan vigente

El [plan principal](PLAN_MULTIUSUARIO_PROXMOX.md) y el [alcance detallado de las nuevas fases](PLAN_FASES_BACKLOG.md) incorporan todos los pedidos. La fase 11 conserva el contexto vivo; la fase 12 implementó la reorganización general y navegación; la fase 13 publicó DEV de forma controlada; la fase 14 entregó la ejecución dentro de bloques, el lienzo estático y el paralelo vertical.

| Pedido | Fase y estado |
| --- | --- |
| 1. Redistribución de interfaz | 12. Implementado |
| 2. ESP32-S3 | 16. DevKit y 17. Waveshare de 5 pulgadas |
| 3. Display interactivo | 18. Escena y controles locales en pantalla |
| 3. TX/RX serial | 15. TX/RX programable |
| 4. Paralelo vertical | 14. Implementado |
| 5. Bloques estáticos | 14. Implementado |
| 6. Catálogo separado | 12. Implementado |
| 7. Progreso dentro del bloque/componente | 14. Implementado |
| 8. Sesión sin revalidación por foco | 12. Implementado |
| 9. Imagen de la placa con conexiones | 12. Wemos implementada; pendientes DevKit (16), Waveshare (17) y TX/RX (15) |
| 10. Desplazamiento y zoom de la escena | 12. Implementado |
| 11. Acceso externo persistente a DEV | 13. Implementado |
| 12. Desafíos progresivos | 19. Pendiente de autorización |
| 13. Barra residual del catálogo | Implementado el 13 de septiembre de 2026, revisión `d096fd9` |
| 14. Reacciones animadas del avatar | 22. Avatar acompañante y reacciones accesibles |
| 15. Asistente grande para compilar y grabar | 20. Compilación y grabación guiadas, medibles y comprensibles |
| 16. Movimiento individual y grupal de bloques | Implementado y desplegado el 13 de septiembre de 2026, revisión `0fc9ff2` |
| 17. Comprender, medir y mejorar la compilación | 20. Medición, estados reales y mejoras antes del asistente |
| 18. LCD 20 × 4 PCF8574 y OLED SSD1306 128 × 64 | 23. Aceptación física de perfiles LCD/OLED/TFT existentes |
| 19. Matriz de LED 32 × 8 con cuatro MAX7219 | 23. Nuevo componente, simulación, ambos generadores y ensayo físico |
| 20. Panel web local para celular | 24. Panel local seguro y programable en la misma LAN |
| 21. Guardado estable durante el arrastre | Implementado y desplegado el 15 de septiembre de 2026, revisión `2b97af9` |
| 22. Vista educativa del estado lógico de pines | 21. Claridad del circuito y UX educativa |
| 23. Reducir al mínimo la latencia de compilación | 20. Caché, reutilización segura y medición reproducible |
| 24. Logo y nombre del colegio centrales en el ingreso | 26. Identidad institucional y acceso de aula |
| 25. Familia de robots HP Robots / Otto | 27. Perfiles compuestos, movimientos y validación por variante |
| 26. Barrera infrarroja digital | 28. Implementada en software; aceptación física pendiente |
| 27. Datos, variables y textos dinámicos | 29. Tipos, expresiones, valores de componentes y composición de texto |
| 28. Temporizadores y eventos cooperativos | 30. Relojes consultables y disparadores no bloqueantes |
| 29. Procedimientos y funciones | 31. Tareas reutilizables, parámetros y valores devueltos |
| 30. Estados y valores consultables de componentes | 32. Capacidades tipadas, medidas o lógicas, utilizables en condiciones |
| 31. Red entre placas por Wi-Fi | 33. Punto de acceso, clientes y mensajes de aplicación |
| 32. Servicios y control remoto entre placas | 34. Servicios autorizados sobre la mensajería validada |
| 33. Luces RGB inteligentes WS281x/SK6812 | 35. Tiras, aros, barras y matrices direccionables |
| 34. Firmware intérprete y ejecución directa en placa | 36. Runtime precompilado, reglas locales y destino Simulador/Placa |
| 35. Herramientas pedagógicas revisadas y bloque `según` | 19. Amplía desafíos progresivos; plan externo completo |
| 36. Ayuda infantil de componentes | 37. Fichas contextuales, fotos, conexión, uso y diagnóstico |
| 37. Lista maestra de componentes a implementar | 35 y 38–41. Prioridades, perfiles y exclusiones centralizados |
| 23. Reducir al mínimo la latencia de compilación | 20. Medición, caché, precompilación y arquitectura del compilador |

Las observaciones externas quedan asignadas así: fase 20 (progreso/guardado/reinicio de compilación), fase 21 (superposición y claridad/escena), fase 22 (avatar), fase 25 (enlaces/QR) y fase 26 (acceso de aula/asistencia). Producción es la **Fase final, postergada**, fuera de esta numeración. La fase 10 mantiene su aceptación física pendiente. La fase 15 está implementada en software y la fase 23 está en curso con la matriz implementada; el resto requiere autorización propia. Los números de pedido no son fases nuevas.
