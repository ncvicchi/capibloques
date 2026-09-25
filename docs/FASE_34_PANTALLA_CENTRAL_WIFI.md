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

## Dos roles de placa en el proyecto

Todo proyecto físico conserva una **Placa del proyecto**. Activar Pantalla
central no cambia esa placa por una Waveshare: agrega un segundo rol y la
interfaz muestra ambas imágenes, nombres, firmware y estado de conexión. Un
proyecto sencillo puede seguir usando sólo Wemos/DevKit; al elegir una Waveshare
como Pantalla central, la Placa del proyecto continúa siendo obligatoria.

Cambiar cualquiera de las dos placas es una operación independiente y
confirmada. El asistente explica qué firmware se actualiza, qué conexión se
conserva y si el perfil nuevo puede ejecutar los componentes reales. Nunca
reasigna la Waveshare como ejecutora por inferencia.

## Punto de acceso persistente por Waveshare

Cada Waveshare provisionada inicia automáticamente su propio AP de 2,4 GHz con
una identidad estable. El SSID se calcula sin intervención del alumno como
`WSMMMMMM`, donde `MMMMMM` son los últimos seis dígitos hexadecimales de la MAC
de Wi-Fi de esa Waveshare (por ejemplo, `WS3FA21C`). La contraseña es aleatoria
y propia de esa unidad. No se usa un SSID o una contraseña universal: en un
aula conectaría placas al puesto equivocado y permitiría que conocer una clave
abra todas las pantallas.

El docente prepara la pareja mediante el asistente y Web Serial. CapiBloques lee
la identidad de la Waveshare, calcula el SSID y escribe automáticamente el mismo
perfil —SSID, contraseña e identidad esperada— en ambas placas. Los chicos no
eligen una red, no copian una clave y no ven una lista de AP. El perfil se guarda
en almacenamiento local de las placas, fuera del proyecto, historial, Git y
servidor. Sobrevive a reinicios y a una actualización normal del firmware; la
contraseña puede regenerarse con una acción docente confirmada que obliga a
volver a preparar la placa del proyecto.

Al preparar la Placa del proyecto, el navegador le entrega localmente las
credenciales de **esa** Pantalla central y su identidad esperada. Por lo tanto,
“programar el mismo AP en ambas” significa que CapiBloques configura la
Waveshare como dueña del AP y la Wemos/DevKit como cliente de ese perfil; no que
todas las parejas compartan la misma red. El JSON portable guarda sólo la
identidad no secreta de la pareja. Cambiar de Pantalla central exige volver a
preparar la conexión de la Placa del proyecto.

WPA protege la red, pero no sustituye el emparejamiento de aplicación. Un código
breve mostrado por la Waveshare confirma la pareja y deriva una clave de sesión;
una placa conectada al SSID correcto pero no emparejada no puede enviar comandos
ni aparecer como origen válido.

Varias parejas pueden convivir porque tienen SSID, contraseña e identidad
distintos. Eso no crea espectro ilimitado: los AP comparten 2,4 GHz. La
provisión distribuye canales no superpuestos cuando sea posible y la aceptación
de aula mide pérdida/latencia con varias parejas simultáneas antes de fijar un
máximo. La interfaz muestra la Pantalla central elegida y evita seleccionar dos
unidades con el mismo alias visible.

## Recorrido infantil

1. En la escena se conserva una placa compatible como **Placa del proyecto** y
   se agrega una Waveshare como **Pantalla central**.
2. El asistente conecta ambas por USB, obtiene la MAC de la pantalla y configura
   automáticamente en las dos el perfil `WSMMMMMM`; el alumno no elige Wi-Fi.
3. La pantalla inicia su AP persistente y la placa se conecta al perfil de esa
   unidad, sin depender del router.
4. Un código breve de emparejamiento confirma qué dos placas se vinculan. Las
   credenciales y claves de sesión quedan fuera del JSON, historial y Git.
5. El firmware intérprete y las reglas se instalan en la placa del proyecto; la
   pantalla recibe el descriptor visual de la misma revisión de escena.
6. Al ejecutar, la pantalla representa posiciones, nombres, estados, camino
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
5. Implementar provisión automática: leer MAC, formar `WSMMMMMM`, generar la
   clave y escribir el perfil en ambas placas, con rotación y recuperación.
6. Incorporar botones, mensajes y sensores virtuales; luego servicios publicados
   con confirmación.
7. Integrar firmware intérprete, Web Serial y pruebas de compatibilidad.

## Aceptación

- Un proyecto mixto ejecuta LED/sensor reales en Wemos/DevKit y objetos
  virtuales, todos visibles en la misma escena de la Waveshare.
- La pantalla refleja estados y bloque activo sin detener el programa.
- Un botón y un sensor virtual modifican el comportamiento; un comando no
  publicado, vencido, duplicado o de otra pareja se rechaza.
- Al apagar la pantalla, la placa continúa; al reconectar, una instantánea
  corrige la vista sin repetir acciones.
- Simulador multiplaca, Arduino, ESP-IDF e intérprete respetan el mismo contrato.
- Dos o más parejas cercanas usan AP/identidad distintos y ninguna placa acepta
  telemetría o comandos de la pareja vecina.
- El alumno no selecciona SSID ni escribe contraseñas; CapiBloques configura las
  dos placas y muestra sólo cuál pareja está preparando.
- Latencia, pérdida, reconexión, tasa de eventos, RAM y uso de radio se miden en
  Wemos D1 R32, ESP32 DevKit y la Waveshare exacta antes de prometer límites.
