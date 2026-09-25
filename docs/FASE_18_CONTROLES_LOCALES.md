# Fase 18 — Tablero y controles locales en Waveshare

Estado al 25 de septiembre de 2026: **base de tablero lógico implementada; fase reabierta por ampliación de alcance, despliegue DEV y aceptación física pendientes**.

## Ampliación de alcance — escena híbrida

El propietario aclaró que la pantalla debe representar la misma escena armada
en la web. Cada componente conectado mediante una interfaz realmente soportada
se ejecuta físicamente; los componentes restantes se simulan en la pantalla y
continúan participando del mismo programa. La lista lógica de hasta seis objetos
entregada el 24 de septiembre es una base parcial, no el cierre de esta fase.

La ampliación debe reemplazar las filas del tablero por la escena compartida,
marcar cada objeto como **real** o **simulado**, conservar controles táctiles y
prioridad manual/programa, y permitir ambos destinos simultáneamente. La placa
expone I2C, CAN, RS485, DI0/DI1 y DO0/DO1 aislados; se incorporan como interfaces
tipadas cuando exista soporte, nunca como GPIO/PWM genéricos. Los componentes
que requieran PWM, motores o conexiones no disponibles necesitan un expansor o
controlador físico identificado y probado.

El catálogo debe anticipar el resultado con etiquetas **Simulable**, **Real
compatible** o **Necesita expansión**. Agregar una luz sin conexión física la
crea como objeto virtual válido; no debe producir faltantes de GPIO ni obligar a
entender el pinout. Cambiarla a real abre únicamente las conexiones válidas y
recién entonces aplica los diagnósticos de cableado.

Referencia de capacidades y bornes: [documentación oficial de la Waveshare
ESP32-S3-Touch-LCD-5](https://docs.waveshare.com/ESP32-S3-Touch-LCD-5).

## Decisión de alcance

La Waveshare ESP32-S3 Touch LCD 5 SKU 28117 no expone GPIO escolares libres con el perfil seguro de fase 17. Por decisión explícita del propietario, esta entrega no inventa conexiones ni presenta actuadores físicos inexistentes: el tablero controla **estados lógicos locales** de hasta seis semáforos, robots de dos motores, motores, LEDs o servos. La ampliación física requeriría definir y probar un expansor/controlador separado.

El tablero ocupa la pantalla completa. Por eso, al seleccionar el primer objeto se retiran las zonas de texto existentes, con una explicación visible. Las LCD, OLED y TFT externas conservan su comportamiento de mensajes; no muestran controles táctiles que su hardware no posee.

## Contrato funcional

- En `Armar escena`, la pantalla integrada permite activar **Tablero táctil de la escena** y elegir hasta seis objetos compatibles por nombre.
- El JSON guarda `display.config.dashboard = { enabled, deviceIds }`; cliente y backend validan perfil, límite, duplicados, referencias y tipos. Borrar un objeto vuelve inválida una referencia huérfana en vez de dirigirla a otro componente.
- La vista simulada muestra nombre, estado y modo de cada objeto. `Cambiar` toma prioridad manual sólo para ese objeto; `Volver al programa` restaura el último estado que el programa alcanzó mientras el control manual estaba activo.
- Iniciar una ejecución no pierde la prioridad manual. El simulador sincroniza una escena recién abierta antes de habilitar los botones, evitando acciones contra una escena anterior.
- Arduino y ESP-IDF generan la misma máquina de prioridad no bloqueante. El touch GT911 divide cada fila en acción manual y retorno al programa; el refresco está limitado y no detiene el planificador.
- En objetos incluidos en el tablero, el firmware omite toda configuración/escritura GPIO, PWM o ADC. Sus estados siguen cambiando por bloques y por touch únicamente como lógica visible en la pantalla.
- El encabezado de la pantalla dice expresamente `ESTADOS LOGICOS` y `SIN SALIDAS FISICAS`. No es control remoto desde el navegador, paro de emergencia ni realimentación eléctrica.

## Pruebas de software

- Modelo/JSON: aceptación Waveshare, máximo y referencias; rechazo de objeto inexistente y de tablero en otro perfil.
- Simulador: prioridad manual, avance oculto del programa y retorno al último estado; sincronización inicial de escena.
- Navegador: importar, ver el tablero, tomar control manual, ejecutar, volver al programa y exportar conservando la configuración.
- Generadores: Arduino y ESP-IDF contienen tablero/touch y no generan llamadas físicas para el objeto lógico.
- Fixtures de display: fuentes Arduino/ESP-IDF generadas y verificadas para el tablero Waveshare.

La compilación real en toolchains remotos, el despliegue DEV y la prueba táctil sobre la unidad física no se confunden con estas pruebas locales.

## Aceptación física pendiente

Después de actualizar DEV:

1. crear un proyecto Waveshare con pantalla, semáforo lógico y robot lógico;
2. guardar, cerrar, recargar e importar/exportar y confirmar que la selección persiste;
3. compilar y grabar Arduino, luego ESP-IDF;
4. tocar `Cambiar`, dejar que el programa avance y usar `Volver al programa`;
5. comprobar coordenadas, orientación, legibilidad, latencia y ejecución cooperativa durante varios minutos.

Un resultado correcto certificará solamente la SKU 28117 y sus estados lógicos. No certifica salidas eléctricas ni otras variantes Waveshare.

## Actualización DEV

El propietario ejecuta después del push:

```sh
cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast
```

El cambio toca frontend, validación backend y generación de firmware; el actualizador decidirá los servicios afectados y hará sus comprobaciones locales sin esperar GitHub Actions.
