# Fase 15 — componente Mensajes

## Estado

Implementación de software terminada, desplegada en DEV y verificada el 19 de septiembre de 2026. Queda pendiente únicamente la aceptación eléctrica con una Wemos D1 R32 identificada y otro emisor/receptor de 3,3 V; las pruebas automáticas y la compilación no se presentan como prueba física.

## Contrato acordado

El catálogo ofrece un componente corto llamado **Mensajes**. En la escena se configura como **Enviar**, **Recibir** o **Enviar y recibir**; sólo aparecen y se reservan los pines utilizados. La velocidad se configura allí y comienza en 9600 baudios. Se admiten como máximo dos componentes, dejando separada la consola USB usada para diagnóstico y programación.

Cada componente conserva de 1 a 24 mensajes predefinidos y editables, de hasta 120 bytes UTF-8 cada uno. Esa misma lista alimenta los desplegables de bloques y los botones de prueba del simulador: durante la ejecución no se escribe texto libre.

Bloques incorporados:

- `enviar [mensaje] usando [componente]`;
- `esperar en [componente] el mensaje [mensaje] durante [segundos]`, con contenedores arbitrarios **igual**, **distinto** y **no llegó**.

La espera es cooperativa. Sólo detiene su camino; otros caminos de `Al mismo tiempo` continúan. Un paquete dañado se descarta y la espera continúa: nunca se interpreta como «distinto». Detener o reiniciar cancela las esperas y vacía las colas. Para escuchar permanentemente se coloca la recepción dentro de `repetir por siempre` en un camino paralelo; no se agregó un segundo modelo de callbacks/eventos.

## Trama protegida

El protocolo interno, compartido por Arduino y ESP-IDF, es:

```text
0x43 0x42 | versión 1 | tamaño uint16 LE | texto UTF-8 | CRC-16/CCITT | 0x0D 0x0A
```

El CRC cubre versión, tamaño y contenido. El lector valida cabecera, versión, longitud, CRC y cierre, admite fragmentación natural del flujo y limita cada sondeo para no monopolizar el scheduler. Los buffers son fijos y acotados. La implementación portable de referencia está en `lib/messages-protocol.ts` y el firmware genera su parser incremental equivalente.

## Interfaz y ejemplos

- El inspector de escena permite modo, velocidad, lista y pines reasignables, con detección común de conflictos.
- La escena identifica visualmente si el componente envía, recibe o hace ambas cosas.
- Estado ofrece botones grandes con los mensajes prearmados y muestra el último recibido; la consola registra envío, recepción, resultado y timeout sin mezclar el enlace con una lectura desde USB.
- Se agregaron los ejemplos **Robot por mensajes** y **Semáforo por mensajes**.
- La guía de conexiones indica cruce Enviar→Recibir, Recibir→Enviar, masa común y nivel de 3,3 V; el mapa Wemos usa los mismos pines del modelo.

## Validación realizada

- `npm run typecheck`
- `npm run lint`
- `npm run test:smoke`, incluido worker con recepción cooperativa y rama igual
- `npm run test:message-driver`: trama, CRC, parser y C++ Arduino generado ejecutados con HAL determinista
- `npm run test:idf` y `npm run test:idf-driver`: grafo compartido y C++ ESP-IDF generado
- `npm run build`
- Playwright específico: 4/4 en Chrome y Edge, configuración de modo/lista/pines y recorrido de simulación por botones
- validación Django agregada para bloques, configuración, UTF-8, pines no usados y límite de dos; la ejecución local requiere el entorno Django de contenedor/DEV

La CI completa [35444477812](https://github.com/ncvicchi/capibloques/actions/runs/35444477812) quedó correcta en `b2ebd05`: compila el firmware Wemos con Arduino 3.3.11, los cinco perfiles de pantalla y siete proyectos ESP-IDF 5.5, incluidos envío y recepción. Backend, interfaz Chromium y runtime público también pasaron. El primer intento detectó y permitió corregir el orden de prototipos impuesto por el preprocesador Arduino y la dependencia explícita `esp_driver_uart`; ambos casos quedaron cubiertos por regresión.

DEV quedó desplegado con la imagen `capibloques-editor-dev:b2ebd05bf91f`. La salud pública respondió `ok`, Compose/firewall fueron válidos, el compilador quedó activo con admisión abierta y cola vacía, y el recorrido específico pasó **4/4** sobre el dominio público en Chrome y Edge. No se modificaron PRD, gateway, Proxmox, router ni Nginx.

La comprobación física pendiente debe probar envío, igualdad, diferencia, timeout, paquete corrupto, fragmentación y dos paquetes consecutivos antes de retirar esta salvedad.
