# Actualizaciones incrementales y cachés compartidas

Trabajo del 03/11/2026 en `codex/dev3-actualizaciones-incrementales`, creada
desde `origin/dev3`. Sólo código, documentación y pruebas aisladas en DEV3.
No se integró ni instaló en main, DEV1 ni DEV2. No cambia firmware, ABI,
reglas, datos, credenciales, DNS ni los comandos habituales del operador.

## Problema observado

La limpieza de main ejecutaba `docker builder prune --all --force` en cada
actualización. Eso eliminaba las dependencias y capas recién construidas.
Además, cada ambiente construía sus imágenes por commit y conservaba paquetes
de firmware en distintas carpetas. La actualización siguiente podía volver
a instalar npm/pip, compilar la web y preparar el mismo intérprete.

## Qué se reutiliza

`scripts/dev-build-cache.py` prepara imágenes identificadas por contenido:

| Cambio | Editor web | API | Generador/compilador | Intérprete |
|---|---|---|---|---|
| Documentación/commit/ambiente | Reutiliza | Reutiliza | Reutiliza | Reutiliza |
| TSX/CSS del editor | Construye con capas previas | Reutiliza | Reutiliza | Reutiliza |
| Backend | Reutiliza salvo catálogo compartido | Construye con capas previas | Reutiliza | Reutiliza |
| `lib/` compartida | Construye | Reutiliza | Construye overlay | Reutiliza |
| C++/configuración del intérprete | Construye al cambiar su paquete público | Reutiliza | Reutiliza | Compila incrementalmente |
| Dependencias/receta/base SDK | Sólo servicios afectados | Sólo servicios afectados | Invalida base/overlay correspondiente | Invalida si cambia su toolchain/receta |

El helper lee las entradas `COPY` de los Dockerfile actuales y los archivos
versionados correspondientes. Rechaza sintaxis nueva que no comprenda, archivos
faltantes y enlaces; no supone que una dependencia nueva sea irrelevante.
La web incluye sólo los tres manifiestos actuales y sus ZIP, verificados por
SHA-256; los ZIP históricos sueltos no invalidan su construcción.

Los contextos temporales normalizan permisos y fechas para reutilizar capas
entre checkouts/releases. No incluyen Git, dependencias descargadas ni archivos
locales ajenos a las entradas de construcción. El archivo Compose temporal está
fuera del contexto: no entra accidentalmente en el `COPY .` del backend.

Las imágenes `capibloques-cache-{editor,api,compiler}:<hash>` son compartidas por
los tres ambientes del mismo Docker. Si no cambió su contenido, sólo se genera
una capa pequeña con la revisión Git solicitada. La imagen final sigue teniendo
la etiqueta del ambiente/commit y el actualizador sigue verificando su revisión
real, su salud y los manifiestos HTTP. El overlay incorpora la identidad real
de la imagen SDK a su clave; no se reutiliza sobre una base diferente.

`ops/environments/manage.py` usa el helper para editor/API/overlay. El runtime
de main lo usa después de detener su frontend y dentro del mantenimiento ya
protegido por los bloqueos existentes; conserva la recuperación del frontend
anterior ante errores. No cambia los permisos Git del usuario `capi`.
Al cambiar la semántica del helper, revisar/incrementar su formato de clave.

## Paquetes de firmware

`scripts/interpreter-artifact-cache.py` conserva paquetes en
`/home/capi/capibloques-envs/firmware-cache/<clave>` y los comparte entre main,
DEV1 y DEV2 del servidor. La clave incluye versión, árbol fuente del intérprete,
imagen toolchain y scripts de construcción, caché y empaquetado. Los manifiestos
incluyen `recipeKey`, además de los campos existentes. No cambia el protocolo USB.

Antes de reutilizar se valida el conjunto completo: tres placas, ABI, versión,
revisión, receta, tamaños y hashes. Se publican los ZIP antes de sus manifiestos.
Un paquete faltante o corrupto es un fallo de caché: se conservan los archivos
actuales y se usa la construcción incremental. No se renombra un binario de
otra versión ni se modifica su fuente declarada para hacerlo pasar por vigente.

La primera adopción puede requerir construir/reempaquetar y crear las nuevas
entradas. No hay un tiempo prometido para esa pasada inicial. Después, cambiar
sólo documentación/UI o promover el mismo contenido no vuelve a compilar el
intérprete. Los objetos ESP-IDF de `outputs` y ccache siguen persistentes;
una toolchain/configuración realmente diferente mantiene la invalidación segura.

## Limpieza limitada

- Mantiene SDK, imágenes activas, recuperación de ambientes y bases exactas
  fijadas por digest, aunque no tengan una etiqueta corta local.
- Mantiene dos imágenes de contenido usadas recientemente por cada tipo.
- Poda normalmente sólo capas sin uso de más de siete días, con objetivo de
  conservar `4GB` de caché Docker. Con menos de 4 GiB libres puede retirar capas
  recientes sin uso, conservando ese presupuesto.
- `CAPI_DOCKER_CACHE_BUDGET` permite otro valor, por ejemplo `6GB`, en el entorno
  root que ejecuta la limpieza. El objetivo depende de lo que Docker pueda
  liberar: las capas referenciadas no desaparecen para forzar un límite exacto.
- No ejecuta `docker system prune`, no borra volúmenes, SDK, objetos ESP-IDF,
  ccache, datos, secretos ni carpetas de fuentes. La insuficiencia final de disco
  se informa; no se intenta resolver borrando esos recursos.

La limpieza conserva su carácter posterior a una actualización ya saludable.
Los bloqueos de integración y construcción siguen siendo los actuales; no se
introduce paralelismo de builders en el servidor pequeño.

## Verificación y adopción

Las pruebas reproducen invalidaciones por código, independencia de rutas/fechas,
documentación y ZIP históricos, cambio de SDK, corrupción de paquetes, espera
exclusiva del actualizador y reanudación de mantenimiento. La limpieza se ejecuta
con Docker/df simulados, verificando que conserva SDK e imágenes de caché y usa
poda limitada tanto con espacio normal como bajo presión.

DEV3 también ejecuta una prueba Docker real con imágenes pequeñas: primera
construcción, revisión documental que sólo crea metadatos y cambio de código que
construye de nuevo. No instala ni reinicia la aplicación. Los tiempos de esta
prueba no son una estimación del servidor pequeño.

También se construyó la web real de DEV3 en una imagen aislada, sin usarla para
servir la aplicación: **103,3 s** la primera vez y **0,4 s** al reutilizar el
mismo contenido con otra revisión de metadatos. Las diez páginas estáticas
pasaron su verificación. Esto mide el helper/editor en DEV3, no el mantenimiento,
respaldos, API, reinicio o duración total de una actualización del servidor.
El checkout vivo de DEV3 y sus servicios conservaron su estado anterior.

Pruebas rápidas:

```sh
python3 -m unittest discover -s scripts -p test_dev_build_cache.py
python3 -m unittest discover -s scripts -p test_cleanup_cache.py
python3 -m unittest discover -s scripts -p test_environments.py
python3 -m unittest discover -s scripts -p test_interpreter_cache.py
python3 -m unittest discover -s scripts -p test_update_dev.py
python3 -m unittest discover -s scripts -p test_deploy_resume.py
python3 -m unittest discover -s scripts -p test_package_interpreter.py
python3 -m unittest discover -s ops/public-dev -p test_contracts.py
```

La prueba Docker real es optativa con `CAPI_TEST_DOCKER=1` en la primera orden;
crea y retira sólo sus propias imágenes sintéticas. Los dobles de shell se
ejecutan en Linux, preferentemente DEV3. No se necesita CI, USB ni compilación
SDK completa para estos cambios operativos.

Pendiente de autorización: integrar la rama y adoptar los scripts en el servidor.
No ejecutar `update-dev.sh` en la VM DEV3: allí siguen vigentes HMR y `dev3.sh`.
La primera actualización de main usará su guardia del runtime auditado actualizada;
DEV1/DEV2 seguirán usando el manager de su revisión exacta. No es necesario
reinstalar la infraestructura ni regenerar secretos para adoptar esta entrega.
