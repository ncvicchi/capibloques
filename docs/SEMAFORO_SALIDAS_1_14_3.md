# Semáforo físico y desconexión USB — 30/10/2026

Rama `codex/dev1-semaforo-salidas` desde dev1 312f94d. Firmware **1.14.3**,
ABI1; mismo contrato de reglas y mismas asignaciones de pines.

El propietario informó que el programa se cargaba y la visualización web
seguía los bloques, pero los dos semáforos físicos no encendían.

Se leyeron los bancos reales de reglas de la Wemos y se confirmó:

- semáforo1: rojo26, amarillo25, verde27;
- semáforo2: rojo17, amarillo16, verde23;
- instrucciones GREEN/YELLOW/RED presentes y CRC correcto;
- estado inicial de las tres luces en0 en ambos componentes.

El intérprete confundía esos valores iniciales con límites de potencia:
al elegir RED, escribía `config.redBrightness`, que seguía en0. Los cambios
de estado y la telemetría podían funcionar sin que ninguna salida encendiera.
Ahora el color elegido recibe100% y los demás0%, igual que el simulador y
las fuentes nativas. OFF apaga las tres luces. No se cambian los JSON ni se
inventan pines o nuevos ajustes de potencia.

Prueba C++ de la **rama real del intérprete**, extraída del código fuente:
los dos juegos de GPIO y RED/YELLOW/GREEN/OFF, con configuración inicial0,
producen las seis salidas correctas. Forma parte de `npm run test:usb`.

Se compiló con ESP-IDF5.5.5 en dev3 usando los objetos conservados, se
validó el ZIP servido por la web y se grabó la Wemos con esptool-js. Pasaron
las pruebas de comunicación, STOP y transferencia; después se restauraron
las reglas originales de los dos semáforos y se confirmó RUN. El propietario
respondió **«Sí, funcionan los dos»** al comprobar las luces reales.

La placa queda ejecutando ese programa autónomo y el enlace USB queda
cerrado, no con el fixture de pruebas. El respaldo temporal de los bancos
es privado y generado, fuera de Git. No se modificó dev1/main/dev2 remoto.

Además se agrega **Desconectar USB** al asistente conectado. Detener el
programa conserva el enlace; desconectar cierra el enlace sin detener por
sí mismo el programa autónomo. La prueba de interfaz verifica el cierre
real del puerto y que no se envíe un STOP implícito al desconectar.

Para actualizar sólo dev1, usar el script fresco y SHA exacto de esta rama:

```sh
cd /home/capi/capibloques && git fetch --quiet origin codex/dev1-semaforo-salidas && git show origin/codex/dev1-semaforo-salidas:scripts/update-dev.sh | bash -s -- --env dev1 --branch codex/dev1-semaforo-salidas --commit SHA40
```

La Wemos ensayada ya tiene1.14.3. Otras placas requieren instalarlo para
obtener este arreglo. Una compilación S3 no sustituye una prueba física S3.
