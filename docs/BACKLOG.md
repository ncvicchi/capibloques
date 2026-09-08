# Backlog de CapiBloques

Pedidos del propietario desde el 7 de septiembre de 2026, registrados durante distintas entregas. **Registrados, no implementados ni iniciados.** No cambian la autorización ni interrumpen la fase en curso. Estos números identifican pedidos, no nuevas fases; su incorporación al plan requiere acordar alcance y orden.

## 1. Redistribuir la interfaz

Problema reportado: la parte superior está sobrecargada, con aproximadamente siete líneas de encabezados/controles que dejan muy poco espacio para programación y escena.

- Rediseñar la distribución general, no limitarse a reducir márgenes o letra.
- Dar prioridad al espacio útil de los bloques y la escena; agrupar acciones de proyecto/cuenta y presentar detalles secundarios bajo demanda.
- Mantener visibles y accesibles ejecución, pausa/paso, estado de guardado, deshacer/rehacer y avisos importantes, sin apilar encabezados permanentes.
- Verificar escritorio de altura limitada, móvil, teclado y texto ampliado; medir espacio realmente disponible para editar y simular.

El ajuste menor de espacios realizado al cerrar la fase 6 **no resuelve ni da por completado este pedido**.

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

El panel de bloques de una categoría se mezcla visualmente con los bloques del programa. Separar claramente ambas superficies. El catálogo puede superponerse temporalmente al elegir una categoría y ocultarse después, dejando el programa despejado. Verificar arrastre, cierre, foco y teclado en Chrome/Edge. Sólo registrado; no implementar durante fase 7.

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

**Sólo registrado. No cambiar el comportamiento de sesión ni interrumpir o modificar el trabajo en curso de fase 10 por este pedido.**

## Relación actualizada con el plan vigente

Estos pedidos cruzan la UX de la fase 6 y las futuras fases de mensajes/display, generadores, compilación y USB. Se incorporarán explícitamente al [plan principal](PLAN_MULTIUSUARIO_PROXMOX.md) antes de iniciar su implementación, con alcance y orden acordados. El rediseño general sigue pendiente aunque las funciones de fase 6 estén entregadas; el backlog no demuestra soporte funcional disponible.
