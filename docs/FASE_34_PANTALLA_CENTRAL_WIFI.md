# Fase 34 — Pantalla central Wi‑Fi y servicios entre placas

**Estado:** pendiente de autorización e implementación.

## Decisión de arquitectura

La Waveshare ESP32-S3 Touch LCD 5 se usa principalmente como **Pantalla
central**. Una Wemos, NodeMCU ESP32 o DevKit compatible funciona como **Placa
del proyecto** y se conecta por Wi‑Fi. La placa del proyecto ejecuta el programa
completo, maneja el hardware real y mantiene también el estado lógico de los
componentes virtuales. La pantalla central no ejecuta una segunda copia del
programa: dibuja la misma escena, refleja telemetría y envía entradas o
solicitudes autorizadas.

Esta separación evita dos relojes o estados divergentes. Si se corta Wi‑Fi, la
placa del proyecto continúa autónomamente; la pantalla muestra que sus datos
quedaron desactualizados y deja de fingir control.

## Recorrido infantil

1. En la escena se elige una Waveshare como **Pantalla central** y una placa
   compatible como **Placa del proyecto**.
2. La pantalla crea una red local o ambas usan una red configurada. La primera
   versión prioriza la red creada por la pantalla para no depender del router.
3. Un código breve de emparejamiento confirma qué dos placas se vinculan. Las
   credenciales y claves de sesión quedan fuera del JSON, historial y Git.
4. El firmware intérprete y las reglas se instalan en la placa del proyecto; la
   pantalla recibe el descriptor visual de la misma revisión de escena.
5. Al ejecutar, la pantalla representa posiciones, nombres, estados, camino
   activo y conexión. Cada objeto indica **real** o **virtual**.

Se evita «maestro/esclavo» en la interfaz porque no explica la función y la
pantalla no gobierna el reloj del programa.

## Telemetría desde la placa del proyecto

- revisión de reglas/escena y capacidades del firmware;
- inicio, pausa, detención y latido de conexión;
- bloque, camino o procedimiento que está avanzando, con límites de frecuencia;
- estados ordenados de actuadores y estados lógicos virtuales;
- valores de sensores reales o virtuales con tipo, unidad, origen y antigüedad;
- eventos relevantes y errores acotados, sin logs arbitrarios ni secretos.

Al conectar o reconectar se envía una instantánea completa; luego se transmiten
cambios incrementales con secuencia. La pantalla descarta duplicados, detecta
huecos y pide otra instantánea. «Tiempo real» significa respuesta interactiva
medida en la red local, no control determinista ni garantía de tiempo duro.

## Entradas y solicitudes desde la pantalla

La pantalla puede enviar únicamente operaciones publicadas por el proyecto:

- presionar/soltar un botón virtual;
- elegir uno de varios mensajes predefinidos;
- cambiar un sensor virtual o una entrada de prueba dentro de su rango;
- solicitar una acción publicada, como cambiar un semáforo o detener un motor;
- tomar/devolver prioridad manual de un componente cuando el proyecto lo
  permita.

No se permite escribir GPIO, ejecutar código, cambiar pines ni controlar un
componente por su identificador interno. Un sensor físico no se sustituye
silenciosamente: debe estar configurado como virtual o entrar explícitamente en
**modo de prueba**, visible en ambas placas. Las solicitudes se validan y la
decisión final pertenece al programa de la placa del proyecto.

Botones y controles momentáneos tienen vencimiento y se liberan al perder la
sesión. Para valores sostenidos se define una política visible —mantener último
valor o volver a un valor seguro— por tipo de entrada; nunca se adivina.

## Transporte y protección

La mensajería de fase 33 sirve para descubrimiento y mensajes simples, pero la
telemetría necesita mensajes binarios tipados, versionados y acotados. El canal
agrega identidad emparejada, autenticación de sesión, secuencia, confirmación
para comandos, idempotencia, expiración, límite de frecuencia y backpressure.

La primera versión admite una Pantalla central y una Placa del proyecto. No
depende de Internet ni del servidor una vez preparadas. La ampliación a varias
placas requiere selección visual, mezcla de escenas, límites medidos y otra
aceptación; no se obtiene gratis por permitir más conexiones Wi‑Fi.

## Integración con la escena

- La Waveshare usa la misma geometría normalizada del editor y simulador.
- El marco del display no se dibuja dentro de sí mismo; representa el resto de
  la escena y controles contextuales.
- Un componente real se dibuja con el estado informado por la placa; uno
  virtual usa el mismo motor lógico en la placa del proyecto y también llega por
  telemetría.
- La pantalla distingue conectado, reconectando y datos antiguos sin depender
  sólo del color.
- Tocar un objeto abre únicamente las entradas/acciones que ese objeto publicó.

## Fallos y continuidad

- La placa del proyecto sigue ejecutando reglas si la pantalla se apaga o sale
  de cobertura.
- La pantalla congela la última imagen con marca **Sin conexión**, invalida
  controles y no inventa cambios posteriores.
- Al reconectar se negocian firmware, ABI y revisión. Si no coinciden, no se
  aceptan comandos hasta actualizar o volver a cargar el proyecto correcto.
- Reinicios, retransmisiones o ACK perdidos no ejecutan dos veces una acción.
- Un paro de emergencia físico no se reemplaza por Wi‑Fi ni por un botón táctil.

## Orden de implementación

1. Validar físicamente fase 33 entre Waveshare y una Wemos/DevKit.
2. Definir manifiesto de escena, telemetría, instantánea/deltas y entradas
   virtuales sobre un protocolo versionado.
3. Renderizar en Waveshare la misma geometría y estados del simulador.
4. Implementar emparejamiento y una pareja 1 a 1, con reconexión y revisión.
5. Incorporar botones, mensajes y sensores virtuales; luego servicios publicados
   con confirmación.
6. Integrar firmware intérprete, Web Serial y pruebas de compatibilidad.

## Aceptación

- Un proyecto mixto ejecuta LED/sensor reales en Wemos/DevKit y objetos
  virtuales, todos visibles en la misma escena de la Waveshare.
- La pantalla refleja estados y bloque activo sin detener el programa.
- Un botón y un sensor virtual modifican el comportamiento; un comando no
  publicado, vencido, duplicado o de otra pareja se rechaza.
- Al apagar la pantalla, la placa continúa; al reconectar, una instantánea
  corrige la vista sin repetir acciones.
- Simulador multiplaca, Arduino, ESP-IDF e intérprete respetan el mismo contrato.
- Latencia, pérdida, reconexión, tasa de eventos, RAM y uso de radio se miden en
  Wemos D1 R32, ESP32 DevKit y la Waveshare exacta antes de prometer límites.

