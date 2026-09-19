# Fase 23 — componente Matriz LED

## Estado

La parte de software del componente **Matriz LED** está implementada, desplegada en DEV y verificada el 19 de septiembre de 2026. La fase 23 completa permanece abierta: faltan la aceptación eléctrica de la matriz real y las pruebas físicas de los perfiles LCD/OLED/TFT existentes. La compilación automática demuestra compatibilidad de fuentes, no funcionamiento ni seguridad eléctrica.

## Contrato acordado

El catálogo ofrece **Matriz LED**, una unidad lógica de 32 × 8 píxeles formada por cuatro módulos MAX7219 de 8 × 8 encadenados. El primer alcance admite una sola unidad por proyecto y una sola salida visual: un proyecto puede tener una pantalla o una matriz, no ambas. No se admiten varias unidades ni giros de 90° hasta medir el hardware real.

Cuando el proyecto ya tiene una salida visual, ambas tarjetas quedan deshabilitadas deliberadamente. El editor muestra un aviso visible con el nombre del componente que ocupa ese lugar y explica que hay que quitarlo antes de elegir Pantalla de texto o Matriz LED; las tarjetas muestran el mismo motivo y un candado. No se debe presentar sólo un botón gris sin explicación.

Al seleccionar cualquier objeto, la cabecera del lienzo muestra un tachito **Quitar [nombre]**. `Supr/Delete` y `Backspace` hacen lo mismo cuando no se está escribiendo en un campo. Ambas vías usan la confirmación existente, conservan deshacer/rehacer y no borran silenciosamente los bloques que todavía apuntan al componente.

La escena configura:

- brillo de 0 a 15, con valor inicial 5;
- entrada física a la izquierda o a la derecha;
- orientación normal o girada 180°;
- entre 1 y 12 dibujos editables de 32 × 8, incluidos corazón, flecha y sonrisa iniciales.

La matriz usa tres señales reasignables: `DIN`, `CLK` y `CS/LOAD`. No se presenta como I2C ni como una matriz RGB. El JSON conserva configuración, patrones y pines; importación, guardado, historial y deshacer/rehacer usan el mismo modelo validado.

## Bloques y simulación

La categoría **Matriz LED** incorpora cuatro acciones:

- limpiar todos los puntos;
- encender o apagar un píxel mediante coordenadas `x` 0–31 e `y` 0–7;
- mostrar uno de los dibujos guardados;
- desplazar un texto de hasta 32 caracteres con velocidad acotada.

El texto se normaliza a una fuente 5 × 7 portable de mayúsculas, números y signos básicos. Los caracteres no representables se convierten en `?`; el comportamiento es igual en navegador y firmware.

La escena muestra los 256 puntos y el editor permite cambiarlos con botones accesibles. El texto desplazable corre en segundo plano y el mismo camino sigue inmediatamente. Puede ejecutarse una vez, entre 2 y 100 veces o sin parar. El bloque `esperar a que termine [matriz]` permite sincronizar sólo cuando hace falta; limpiar, cambiar un píxel, mostrar un dibujo o iniciar otro desplazamiento cancela el anterior. Detener o reiniciar también lo cancela. Se agregó el ejemplo **Cartel luminoso**.

## Firmware y cableado

Arduino y ESP-IDF generan el mismo framebuffer, fuente y protocolo bit a bit para cuatro MAX7219, sin biblioteca externa adicional. El servicio inicializa los registros, aplica brillo/orden/orientación y actualiza las ocho filas con trabajo acotado. Los patrones usan almacenamiento fijo y el desplazamiento no reserva memoria según texto recibido.

La guía muestra `VCC`, `GND`, `DIN`, `CLK` y `CS/LOAD`, y aclara que `DIN` entra al primer módulo. La matriz suele alimentarse a 5 V y puede consumir una corriente importante: requiere fuente apropiada, masa común y desacoplo; nunca se alimenta desde un GPIO. Si el módulo no reconoce de forma confiable la lógica de 3,3 V, se necesita adaptación de nivel para las tres señales.

## Validación de software

- `npm run typecheck`, lint general y lint específico de componentes;
- `npm run test:smoke`, incluido modelo, límites, píxeles, desplazamiento cooperativo y ambos generadores;
- `npm run test:idf`, `npm run test:idf-driver`, drivers de pantallas y Mensajes;
- `npm run build` y verificación de rutas estáticas;
- Playwright específico local y público en Chrome y Edge para configuración/editor, simulación, explicación de exclusividad y eliminación mediante tachito/Supr;
- validación Django de tipo, configuración, pines, bloques y exclusividad de salida visual;
- CI nativa con compilación Arduino-ESP32 3.3.11 y ESP-IDF 5.5.5 de la matriz generada.

La CI completa [35449365576](https://github.com/ncvicchi/capibloques/actions/runs/35449365576) pasó sus cuatro trabajos en `fa9ec15`, incluidos ocho proyectos nativos por framework y 202 pruebas de backend. DEV quedó en `fa9ec1534571e7afc194ecda5e28dc827cb237b8`; editor, API y base quedaron saludables, Compose/firewall válidos y salud interna/pública `ok`. La prueba específica pasó **4/4** sobre DEV público en Chrome y Edge. El compilador quedó activo, con admisión abierta, concurrencia/techo 1 y cola vacía. No se modificaron PRD, gateway, Proxmox, router ni Nginx.

La mejora de claridad y borrado quedó en `7afdf2a`, con el ajuste de regresión E2E en `94f2112`. La CI completa [35473606856](https://github.com/ncvicchi/capibloques/actions/runs/35473606856) pasó sus cuatro trabajos. DEV quedó desplegado en `94f21129f577ddc64fd55f0ff1fac3920a895f7d`, coincidente con la etiqueta de la imagen; Compose/firewall y salud interna/pública quedaron correctos. El E2E actualizado pasó **8/8** sobre DEV público en Chrome y Edge. El compilador quedó activo, admisión abierta en revisión 24, concurrencia/techo 1 y cola vacía. No se modificaron PRD, gateway, Proxmox, router ni Nginx.

## Aceptación física pendiente

Con el módulo exacto disponible hay que comprobar tensión/corriente declaradas, color, orden real de los cuatro paneles, orientación, brillo mínimo/máximo, dibujos, texto desplazable, desconexión y convivencia con delays, Mensajes, sensores y PWM. Esa medición decidirá si conviene autorizar más de una unidad 32 × 8 o rotación de 90°; hasta entonces el límite de una unidad es deliberado.

También siguen pendientes las pruebas físicas de LCD PCF8574 16 × 2/20 × 4, OLED SSD1306 e ILI9341/ILI9488 previstas en fase 23. Por eso esta entrega no declara cerrada toda la fase.
