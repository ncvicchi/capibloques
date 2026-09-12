# Backlog de CapiBloques

Pedidos del propietario desde el 7 de septiembre de 2026, registrados durante distintas entregas. El 8 de septiembre se asignaron a las [nuevas fases](PLAN_FASES_BACKLOG.md), precedidas por una fase de contexto portable para otra cuenta. **La fase 12 implementa los pedidos 1, 6, 8 y 10, y la parte Wemos del 9**; alcance, pruebas y límites en su [guía de entrega](FASE_12_MESA_DE_TRABAJO.md). Los restantes siguen pendientes. Los números de este archivo identifican pedidos, no fases. Las notas de «no interrumpir» son históricas, referidas a la entrega que transcurría cuando se hizo cada solicitud; no sustituyen el estado ni las autorizaciones del plan vigente.

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

Pedido durante la implementación de fase 7: cambiar la disposición del bloque a **vertical en lugar de horizontal**, para poder ver los hilos en paralelo. Validar la propuesta visual con el propietario antes de implementarla, preservando orden, conexiones, deshacer/rehacer y proyectos existentes. Sólo registrado; no cambia la fase 7 en curso.

## 5. Bloques estáticos al ejecutar

La vista se desplaza sola en cada paso, incluso cuando el programa completo ya está visible; al crecer, los saltos confunden. El propietario pide **dejar estático el programa durante la ejecución**. Mantener resaltado del paso actual sin mover automáticamente el lienzo. Sólo registrado; no cambiar ahora el seguimiento de ejecución.

## 6. Separar catálogo y programa

El panel de bloques de una categoría se mezcla visualmente con los bloques del programa. Separar claramente ambas superficies. El catálogo puede superponerse temporalmente al elegir una categoría y ocultarse después, dejando el programa despejado. Verificar arrastre, cierre, foco y teclado en Chrome/Edge. Se registró sin interrumpir fase 7; **implementado en fase 12** con fondo opaco, cierre explícito/Escape y cierre después del arrastre.

## 7. Progreso dentro del bloque o componente

Pedido durante el cierre de fase 9: trasladar la información de progreso del «header de estado» al bloque o componente que está ejecutándose, para no obligar a mirar otra zona de la pantalla.

- En esperas/delays, mostrar el tiempo restante en el propio bloque mediante un indicador gráfico, numérico o ambos.
- Aplicar el mismo criterio a otras acciones con progreso, relacionando claramente la información con su bloque o dispositivo.
- Preservar legibilidad, pausas/reanudación y pasos guiados; si hay caminos concurrentes, cada uno debe mostrar su propio progreso sin mover el lienzo ni mezclar sus tiempos.
- Este pedido se relaciona con la redistribución de la interfaz y los bloques estáticos; no implica cambiar el reloj lógico del simulador o del firmware ni agregar seguimiento físico en vivo.

**Sólo registrado. No modificar ni interrumpir la implementación, pruebas o cierre de fase 9 por este pedido.**

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

Asignación: **fase 13**, planificada en [su guía](FASE_13_ACCESO_EXTERNO_DEV.md). Incorporarla al plan no autoriza todavía las mutaciones de servidor.

## Relación actualizada con el plan vigente

El [plan principal](PLAN_MULTIUSUARIO_PROXMOX.md) y el [alcance detallado de las nuevas fases](PLAN_FASES_BACKLOG.md) incorporan todos los pedidos. La fase 11 conserva el contexto vivo; la fase 12 implementa la reorganización general y navegación; la fase 13 publicará DEV de forma controlada. La ejecución dentro de bloques y paralelo vertical siguen en fase 14, no se dan por resueltos al redistribuir la UI.

| Pedido | Fase y estado |
| --- | --- |
| 1. Redistribución de interfaz | 12. Implementado |
| 2. ESP32-S3 | 16. DevKit y 17. Waveshare de 5 pulgadas |
| 3. Display interactivo | 18. Escena y controles locales en pantalla |
| 3. TX/RX serial | 15. TX/RX programable |
| 4. Paralelo vertical | 14. Ejecución visual |
| 5. Bloques estáticos | 14. Ejecución visual |
| 6. Catálogo separado | 12. Implementado |
| 7. Progreso dentro del bloque/componente | 14. Ejecución visual |
| 8. Sesión sin revalidación por foco | 12. Implementado |
| 9. Imagen de la placa con conexiones | 12. Wemos implementada; pendientes DevKit (16), Waveshare (17) y TX/RX (15) |
| 10. Desplazamiento y zoom de la escena | 12. Implementado |
| 11. Acceso externo persistente a DEV | 13. Planificado; no implementado |

Producción es la **Fase final, postergada**, fuera de esta numeración. La fase 10 mantiene su aceptación física pendiente. Los pedidos de fases 13–18 siguen sin implementar ni autorizar; su asignación no demuestra soporte disponible ni habilita cambios en servidores.
