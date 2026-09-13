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

Antes de implementar: identificar modelo/revisión exactos de DevKit y Waveshare, memoria y pantalla/táctil presentes; verificar documentación del fabricante. Definir cómo se elige o cambia la placa sin perder dispositivos ni ocultar conexiones incompatibles. No hay controladores ni asignaciones de pines elegidos todavía.

## 3. Nuevos componentes

### Display interactivo

- Mostrar la escena en el display.
- Permitir controlar manualmente los dispositivos agregados mediante controles de esa vista.
- Representar en el simulador el comportamiento esperado y preservar la escena/configuración en JSON.

Precisar al diseñar: qué vista corre en el navegador y cuál en el display físico; qué entradas táctiles tiene cada placa; qué sucede si un bloque y un control manual actúan sobre el mismo dispositivo. Este pedido no se interpreta como autorización para agregar control remoto de la placa desde la web: el alcance previo excluye ese control en vivo y cualquier cambio debe acordarse explícitamente.

### TX/RX serial reasignable

- **TX:** enviar mensajes por el puerto serial elegido.
- **RX:** recibir mensajes y compararlos con mensajes fijos/prearmados, con caminos **igual / distinto**.
- Puerto y asignaciones configurables según las capacidades/pines de la placa; no asumir que todo se transmite por la consola USB de diagnóstico.
- Permitir probar envío/recepción y bifurcaciones en el navegador antes de programar la placa.

Precisar al diseñar: selección de UART, TX/RX, velocidad, fin de mensaje, codificación, tamaño máximo, espera/timeout y estado «sin mensaje». No confundir ausencia de datos con una comparación distinta. Las lecturas y esperas deben ser no bloqueantes; validar conflictos con otros componentes y puertos reservados.

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

Asignación: **fase 12 implementa la guía visual Wemos**, con dibujo propio, mapa contrastado y selección por componente/GPIO sincronizada con listado. **Fase 16** la adaptará a DevKit y **fase 17** a Waveshare; la fase 15 reflejará TX/RX. Esas ampliaciones siguen pendientes, sin autorización para iniciarlas. La ilustración no sustituye una prueba eléctrica.

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

Pendiente de priorización y asignación a una fase autorizada. Tiene relación directa con la futura Fase 19 de desafíos, pero debe cubrir también compilación y grabación sin ampliar esa fase hasta que el propietario defina el alcance.

## 15. Asistente grande para compilar y grabar la placa

Pedido del 13 de septiembre de 2026: el flujo actual exige compilar, esperar la cola, revisar condiciones, habilitar acciones, conectar la placa y grabar. Conservar esas garantías, pero presentarlas como un **asistente grande y secuencial** para que los chicos no tengan que descubrir varios controles separados.

- Mostrar una sola tarea principal por paso, con título claro, explicación breve, indicador «Paso N de M» y botón grande. Permitir volver cuando sea seguro, cancelar sin perder el proyecto y retomar una compilación que siga vigente.
- Recorrer como mínimo: revisar programa y cableado; elegir opciones necesarias; confirmar el envío privado de datos temporales cuando corresponda; compilar y mostrar la espera; revisar el resultado; conectar/elegir la placa; aceptar las condiciones específicas de grabación; grabar; informar el resultado y los próximos pasos.
- Mantener visibles los estados reales: en cola, compilando, compilación correcta, binario listo, placa detectada, grabando, grabación correcta o error recuperable. No presentar «compiló» como «se grabó» ni «se grabó» como prueba física del circuito.
- No eliminar consentimientos, permisos, comprobaciones de sesión/cuenta, guardas de cableado, vigencia del binario, idempotencia, cuotas ni límites del compilador. Un retroceso o doble clic no debe crear trabajos o grabaciones duplicadas.
- Usar texto grande, alto contraste, controles táctiles amplios, foco administrado, lector de pantalla y teclado. Los detalles técnicos pueden desplegarse, pero el error principal debe explicar qué puede hacer el alumno a continuación.
- Conservar las pantallas actuales como base funcional y reutilizar sus estados; el asistente coordina el recorrido, no introduce otra definición de compilación o grabación.

Pendiente de priorización y asignación a una fase autorizada. Debe coordinarse con las reacciones de avatar del pedido 14, sin hacer que una animación sustituya el estado textual ni la acción siguiente.

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

Pendiente de priorización y asignación a una fase autorizada. La investigación puede producir documentación y métricas antes de cambiar la receta, pero no habilita aumentar recursos de la VM ni relajar aislamiento, privacidad o límites de concurrencia.

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
| 14. Reacciones animadas del avatar | Pendiente de priorización y asignación; relacionada con desafíos, compilación y grabación |
| 15. Asistente grande para compilar y grabar | Pendiente de priorización y asignación; conserva todas las guardas del flujo actual |
| 16. Movimiento individual y grupal de bloques | Implementado y desplegado el 13 de septiembre de 2026, revisión `0fc9ff2` |
| 17. Comprender, medir y mejorar la compilación | Pendiente de priorización y asignación; alimenta el progreso real del asistente |

Producción es la **Fase final, postergada**, fuera de esta numeración. La fase 10 mantiene su aceptación física pendiente. La fase 14 y las correcciones de los pedidos 13 y 16 están entregadas; las fases 15–19 y los pedidos 14–15 y 17 requieren autorización o priorización propia.
