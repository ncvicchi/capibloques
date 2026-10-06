# Compilación incremental del intérprete — 5 de octubre de 2026

## Problema y cambio entregado

El builder anterior ejecutaba `rm -rf` antes y después de cada construcción.
Sólo compartía objetos entre los dos perfiles S3 de una misma ejecución; al
actualizar otra vez volvía a construir cientos de componentes ESP-IDF.

Ahora conserva dos directorios generados, fuera de Git:

- `outputs/interpreter-esp32`: Wemos.
- `outputs/interpreter-esp32s3`: DevKit S3 y Waveshare. La selección de placa es
  una definición privada del componente `main`, por lo que los objetos SDK son
  compartidos y sólo cambia la aplicación al alternar estos dos perfiles.

Se mantienen en el checkout montado `/project`, aunque Docker elimine el
contenedor temporal. No se agrega una imagen ni se reinstalan toolchains.
ESP-IDF/Ninja deciden qué fuentes/dependencias modificadas deben recompilar y
enlazar; no se reutiliza una aplicación de otra placa.

## Identidad e invalidación

`prepare-interpreter-cache.py` guarda una identidad por target: target, rutas
estables del proyecto/IDF, revisión IDF, versiones/rutas de compilador,
CMake/Ninja/Python, imagen de construcción suministrada por DEV y contenido de
los defaults aplicables. Los dos perfiles S3 usan actualmente los mismos
defaults. Si en el futuro tienen configuraciones diferentes deben separar las
cachés o incluir esa diferencia en su identidad.

Un cambio de `main.cpp` o headers permite la compilación incremental. Cambiar
defaults/toolchain/ubicación invalida sólo el directorio generado del target;
también se reinicia una caché sin marcador o con marcador corrupto. Se rechazan
targets desconocidos y rutas enlazadas. No se borran fuentes ni todo `outputs`.
El SDKCONFIG generado pertenece al build: configurar en los archivos defaults,
no editar manualmente el archivo de caché. Un build parcial conserva los
objetos válidos para reanudar. No ejecutar builders simultáneos sobre la misma
caché; el recorrido habitual sigue siendo una actualización DEV por vez.

El manifiesto publicado agrega `buildIdentity`, además de versión, revisión,
tamaño y SHA-256. Al invocar el builder, un bundle coincidente íntegro se
reutiliza sin ejecutar `idf.py`; uno incompatible o dañado se reconstruye.
La actualización normal conserva su guardia de fuente del intérprete: los
cambios sólo web/documentación no obligan a compilar firmware. Si se reconstruye
la imagen del compilador, se revisan también los intérpretes.

## ccache y disco

Si `ccache` está disponible en la imagen, se habilita sólo en el builder del
intérprete, con almacenamiento persistente `outputs/interpreter-ccache` y
máximo 256 MB. Si no está instalado, la compilación incremental funciona igual;
se informa y NO se reconstruye la imagen pesada sólo para instalarlo.

La imagen actual no lo instala explícitamente, por lo que no se promete que
esté habilitado en DEV sin comprobarlo allí. La cola avanzada con proyectos y
posibles credenciales Wi-Fi conserva sus contenedores/cachés aislados: no se
comparte esta caché entre proyectos, cuentas o compilaciones privadas.

Se conserva una sola generación de objetos por target, no carpetas por commit.
Esto usa más disco que borrarlos al terminar, a cambio de evitar su recompilación.
La limpieza de imágenes Docker no debe borrar estas cachés. Una limpieza manual
de los directorios generados obliga a una construcción inicial posterior.

## Pruebas y aceptación pendiente

`python3 scripts/test_interpreter_cache.py`: diez pruebas de conservación,
cambio de defaults/toolchain/IDF, separación de targets, marcador corrupto,
rechazo de enlaces/targets y build fallido. Incluye ejecutar el script Bash real
dos veces con revisiones distintas y una tercera con la misma revisión; un
doble de `idf.py` verifica objetos persistentes, empaquetado y omisión de builds
idénticos, además de fallo/reanudación. El doble NO compila ESP-IDF.

También se probaron empaquetado, sintaxis Bash y las regresiones de reanudación
del orquestador. No se ejecutó ni midió una compilación real en la VM desde esta
entrega. La primera construcción seguirá siendo completa si el builder anterior
ya borró los objetos. Para aceptar la mejora hay que comparar un build inicial
con otro tras modificar sólo la aplicación, sin cambios de configuración:
el segundo no debería volver a construir cientos de drivers SDK.

Actualizar DEV como `capi`, sin sudo:

```bash
cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast
```

Si hay una actualización previa ejecutándose, esperar que termine antes de
lanzar otra. No cambiar el checkout mientras otro builder lo está utilizando.
