# Grabación y envío de reglas resistentes a fallos

Trabajo autorizado el 30/10/2026 en `codex/dev1-carga-placa-robusta`, desde
`origin/dev1` (`0c71577`). Amplía la fase 20; no incorpora por inferencia las
entregas de las fases 61/62 que están en otras ramas. No modifica main, dev2,
datos, migraciones ni infraestructura. El propietario actualiza dev1.

## Fallos encontrados y correcciones

1. **Reset incompleto de esptool-js 0.6.1, reproducido físicamente.** Su
   `HardReset.reset()` espera y libera RTS, pero no lo activa. Una grabación
   verificada podía dejar el stub ejecutándose, sin responder a CapiLink.
   El adaptador ahora libera BOOT/DTR y activa RTS/EN antes de llamar al
   retardo/liberación existente. Es un único pulso de reset, no dos resets.
   La prueba exige ambos flancos para evitar que regrese este defecto.
2. **Respuestas sin correlación.** CapiLink agrega un `requestId` de sesión
   aleatoria y secuencia. Una respuesta atrasada o duplicada no confirma
   otro pedido. No hay cola ilimitada de respuestas no solicitadas.
3. **Reintentos peligrosos.** El firmware conserva la última respuesta y
   devuelve esa misma confirmación para un pedido repetido. Un CHUNK no
   vuelve a anexarse, COMMIT no vuelve a escribir flash y RUN no arranca
   dos veces. No se conservan contraseñas en esa caché.
4. **Fragmentos fuera de orden/COMMIT prematuro.** Se exige BEGIN válido,
   secuencia exacta, límite de tamaño, CRC y VERIFY previo. Un nuevo
   fragmento invalida VERIFY. Los errores no sustituyen el banco válido.
5. **Mensajes mezclados entre tareas.** Se protege la línea JSON completa
   y se completan escrituras parciales. La telemetría se suspende durante
   una transferencia; un evento tardío no cambia el estado a listo en
   mitad del envío. El parser se resincroniza después de líneas de arranque
   o líneas dañadas; los pedidos identificados pueden reintentarse.
6. **Puertos ocupados y esperas sin fin.** Grabador, monitor y CapiLink
   comparten exclusión local y Web Locks entre pestañas del mismo origen.
   Hay un solo comando en curso; el doble clic no mezcla transferencias.
   Fin del stream y desconexión rechazan inmediatamente la espera pendiente.
   Hay límites para descarga, apertura, escritura, señales, detección,
   grabación y cierre. Un sistema que no confirma el cierre NO libera
   artificialmente la exclusión: informa recuperar cable/pestaña. El relevo
   grabador→CapiLink espera también la liberación asíncrona de Web Locks,
   no sólo el resolver local; su carrera se reprodujo y corrigió en el
   asistente real con Serial simulado. Un
   `port.open` tardío se cierra y no se reutiliza para escribir.
7. **Recorrido que terminaba después de grabar.** El asistente espera el
   cierre real del grabador y continúa automáticamente con el puerto ya
   autorizado, identificación y pantalla de envío. Tolera la reaparición
   del puerto y el arranque lento; no exige recargar el menú. Si Windows
   entrega otro puerto que no puede recuperarse, permite elegirlo otra vez.
8. **Recuperación de UI.** Se puede cancelar la conexión, reconectar tras
   un error y reenviar desde una ejecución pausada o activa (STOP
   confirmado antes de BEGIN). Los fallos de cierre se presentan sin
   promesas rechazadas sin atender ni mensajes falsos de éxito. Cambiar
   la placa del proyecto cierra el enlace anterior; enviar verifica que
   proyecto y placa conectada coincidan. No se permite ejecutar durante
   la transferencia ni reemplazar reglas mientras quedan tareas activas.

## Contrato y compatibilidad

- Intérprete **1.14.1**, ABI 1 y capacidad `reliable-transfer`.
- La web identifica un firmware anterior, pero exige actualizarlo antes
  de enviar reglas. No intenta reintentos de CHUNK sobre firmware antiguo.
- Cada pedido tiene hasta tres intentos con el mismo ID; HELLO tiene su
  ventana de arranque. COMMIT admite 12 segundos por intento para flash.
- Cancelar o perder la conexión no implica que se haya detenido un
  programa autónomo. Un firmware parcialmente grabado requiere grabación
  completa. Perder la última confirmación de COMMIT no permite afirmar
  que se conservaron necesariamente las reglas anteriores: puede estar
  guardada la nueva versión completa. No se ejecuta RUN sin confirmación.
- Se conservan los dos bancos de reglas, CRC, lectura posterior a la
  escritura y publicación del banco mediante NVS. No se borra toda la
  flash, la configuración Wi-Fi, los datos del servidor ni las cachés SDK.
- Los cambios son de transporte/fiabilidad. No cambian el formato portable
  de proyectos ni la semántica del algoritmo.

## Evidencia del 30/10/2026

**Wemos D1 R32 física:** chip ESP32 y 4 MB verificados; compilación local
completa ESP-IDF 5.4.1. El primer ensayo reprodujo: segmentos verificados,
pero sin HELLO después de grabar. Con el pulso de reset corregido, el
mismo cargador JavaScript de producción verificó/grabó los segmentos,
reinició y conectó sin RESET manual. Luego completó **20 ciclos seguidos**
de conectar → enviar → verificar → guardar → RUN/PAUSE/RESUME/STOP → cerrar.
También se hicieron 10 ciclos previos y 3 de recuperación posteriores,
otra tanda de 20 ciclos y una carga de **27.089 bytes en 36 fragmentos**.

Se probaron en la placa real: repetición de fragmentos y COMMIT, secuencia
incorrecta, COMMIT sin VERIFY, CRC dañado y reset durante transferencia
parcial. Tras el reset ejecutó las últimas reglas válidas, no el candidato
incompleto. El programa sintético no usa GPIO y queda detenido al finalizar.

**Pruebas automáticas:** `test:usb` cubre el adaptador real y fallos
inyectados: ACK perdido en cada fase, duplicados, errores de otra sesión,
ruido, cable cortado, timeout, secuencia incorrecta, doble clic, cancelación
del selector, cierre tardío y exclusión de USB. La suite smoke completa,
TypeScript, lint y build estático pasan. Los tests de interfaz en Chromium,
Chrome y Edge verifican reenviar, recuperación y continuación automática
después de instalar (nueve casos aprobados); usan un doble de Serial,
no son evidencia de los drivers USB nativos de esos navegadores.

La prueba física usa ESPLoader y CapiLink de producción sobre un adaptador
Web Serial de pruebas que transporta bytes hacia pySerial. No reemplaza
una aceptación manual del USB nativo en Chrome/Edge, ni demuestra aún el
reset de todos los adaptadores USB/S3/Waveshare. Estos últimos quedan
pendientes de contar con esas placas. No se promete inmunidad a cable,
alimentación o controladores defectuosos.

## Repetir sin intervención del asistente

Pruebas de fallos, sin hardware ni servidor:

```sh
npm run test:usb
```

Interfaz (Playwright levanta el editor local):

```sh
npx playwright test tests/usb-reliability.spec.ts --project chromium --workers 1
```

Placa real: **reemplaza las reglas**. Desconectar actuadores y usar sólo
el puerto correcto. Python debe tener pySerial (incluido en el entorno
ESP-IDF). No descubre ni toca otros puertos.

```sh
node --experimental-strip-types scripts/usb-hardware.test.mjs --port COMxx --python RUTA_AL_PYTHON_IDF --cycles 20
```

Para probar además la grabación con esptool-js, compilar previamente el
intérprete Wemos con el SDK del proyecto, conservando su directorio de build:

```sh
node --experimental-strip-types scripts/usb-hardware.test.mjs --port COMxx --python RUTA_AL_PYTHON_IDF --build RUTA_BUILD_ESP32 --flash --cycles 20
```

`--flash` requiere autorización para sustituir el firmware. El test verifica
ESP32/4 MB antes de escribir. Para S3/Waveshare se necesita adaptar la
selección del perfil del runner; no pasarles el build de Wemos.

## Actualizar únicamente dev1

Después de publicar la rama y con el commit exacto de esta entrega:

```sh
~/.local/bin/capi-dev --env dev1 --branch codex/dev1-carga-placa-robusta --commit SHA40
```

No promover a main ni actualizar dev2. El script generará una vez el
intérprete 1.14.1 y conservará la compilación incremental. Después de
actualizar la web, instalar ese intérprete en cada placa antes de enviar
reglas. Producción continúa postergada.
