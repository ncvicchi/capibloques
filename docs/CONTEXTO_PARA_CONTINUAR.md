# CapiBloques — contexto para continuar

**DEV3 local vigente30/10:** VMcapi-dev3 preparada, checkout `/home/capi/capibloques`; [guía completa](DEV3_VM_LOCAL.md). Rama establedev3, origenrepo habitual; editorhttp://localhost:3003 portúnelWindows y servicioHMR conlinger, API/DBDocker independientes. Copia30usuarios/13proyectos/53revisiones+colegio/cursos/auditoría verificada (sin sesiones/colas/loginbuckets). SDK5.5.5pinned conobjetos/ccachepersistentes,3firmwares1.14.3 válidos; repeticiónsin cambios3,3s. WebSerialdisponible como localhost, cambiosCSSHMRprobados; códigoactivo dentroVM, no espejoWindows. scripts/dev3.sh yconnect-dev3.ps1 operanesteambiente; no usarupdate-dev.sh/capi-devservidor. Cola antiguaespecífica porproyecto pendiente, principalintérprete/reglaslisto. Claves/SSHconfig/snapshots enusuario fueraGit, GitpushVM autenticausuario. Servidororiginal no modificado. Últimafijaciónsemáforo tiene rama `codex/dev1-semaforo-salidas`; Wemos1.14.3 quedócon programadobleoriginal corriendo y usuario confirmó ambosLEDs bien.

**Vigente30/10 — LEDs reales del semáforo:** `codex/dev1-semaforo-salidas` desde dev1 312f94d, runtime1.14.3 ABI1. Ver [guía](SEMAFORO_SALIDAS_1_14_3.md). Leídos bancos reales: RGB0 inicial y GPIO26/25/27 +17/16/23; intérprete usaba ese0 al activar colores. Ahora seleccionado100%, otros0. Compilación IDF5.5.5 en nueva VMdev3 conservando objetos, grabación real, restauración exacta de reglas originales y RUN; usuario confirmó ambos funcionando. Puerto cerrado, placa autónoma activa. Botón Desconectar USB nuevo, STOP conserva enlace. No desplegado remoto; comando fresco sólodev1. Bootstrapdev3 se desarrolla aparte, no confundir las dos entregas ni publicar datos/snapshots privados.

**Vigente30/10 — STOP real durante waits:** `codex/dev1-stop-caminos`, desde dev1 b43c43a con40497f9 por avance rápido; [guía/evidencia](CARGA_PLACA_ROBUSTA.md). Reproducido error literal en Wemos1.14.1: wait60s→STOP ERROR a1,015s. Runtime1.14.2/ABI1 con helper cancelable/pausable10ms, barrera de creación inicial y flags atómicos. Wemos grabada/probada: reemplazos341–388ms, pausa/paralelo/join/iniciales/autoarranque,20+3ciclos,27KB/CRC/duplicados/reset parcial. Queda detenida con fixture sinGPIO, todos los puertos liberados. Suites USB/smoke/typecheck/lint/SDK/build. No confundir puente real pySerial con USB nativo navegador. Main/dev2/servidores no actualizados; entregar comando fresco único de esta rama conSHA, ya incluye arregloCLI anterior. No borrar cachés SDK.

**Seguimiento30/10, tras reporte de primer intento fallido:** rama `codex/dev1-instalar-firmware-diagnostico` desde dev1 b43c43a. Ver sección nueva de [carga robusta](CARGA_PLACA_ROBUSTA.md). ERROR sin ID ya no se acepta durante HELLO; regresión en tests con primererror desconocido→éxito automático. Manifiesto HTTP realdev1 devolvió1.9.0 porque capi-dev instalado invocaba manager viejo; fuenteeditor activa síera b43c43a. Nuevo gestor exige manifiestos publicados correctos y actualizador renueva comando local atómicamente; primer comando debe ejecutar git show de rama nueva, NO el instalado viejo. No cambió intérprete1.14.1 ni hay motivo de reflashear placa que ya saluda1.14.1. Sólo lecturas remotas; la actualización la hace el propietario. Main/dev2 y datos intactos.

**Entrega vigente30/10: carga de placa robusta.** Rama `codex/dev1-carga-placa-robusta` desde origin/dev1 0c71577. Ver [guía y evidencia reproducible](CARGA_PLACA_ROBUSTA.md). Runtime1.14.1/ABI1, reliable-transfer, reset esptool-js0.6.1 corregido con flancos EN reales. Wemos real pasó grabación y20ciclos consecutivos sin reset manual, duplicados/CRC/orden/reset parcial; suites USB/smoke y UI. No afirmar USB nativo de navegador ni S3/Waveshare probados físicamente. No se actualizó el servidor; entregar comando del manager sólo dev1 con SHA exacto. Mantener cachés SDK y main/dev2. Fases61/62 existen como otras ramas; no están incorporadas a esta base de dev1.

### Entrega vigente19/10 — Fase60: marcha coordinada y pista

Rama `codex/fase-60-gorillabot-marcha`, desde origin/dev1
`7b65ae1bd28520801620aa21b0c1ba0161a42b32`. [Reglas completas](FASE_60_GORILLABOT_MARCHA_PISTA.md).
Propietario confirmó fase59 instalada en dev1. No se operó ningún servidor,
main ni dev2; entregar comando instalado fijado al SHA de esta rama.

- Nuevo planGorillaGait TS y CapiGorilla::gait común C++: entrada y cuatro etapas
  por pata, orden TI/DI/TD/DD, up4mm de referencia, elevar/recuperar/bajar/empujar.
  Validación íntegra incluida entrada, rama IK59, tasa30°/s +5% y duración común;
  no usar cuatro trayectorias independientes en paralelo. Detener mantiene PWM,
  referencia explícita no preempta; pausa congela reloj. No certifica equilibrio.
- Config.gait opcional stride/height/phaseMs/turnsVerified, escena960×540
  gorillaTrack/straight|maneuvers, arenaEnvironment compartido estructuralmente
  pero validación propia sin estaciones de la pista diferencial. Cuerpo idealizado,
  huella42, 4unidades/mm didácticas, yaw virtual no medición; visitas al parar500ms,
  contactos por episodio y marcha puede seguir patinando, retroceder sale.
  Controles usan borrador y guardar/cancelar/undo existentes; cambiar parámetros,
  geometría o calibración invalida verificación de giro.
- Nuevos bloques gait/settle, op gorilla action=gait, index0avance/1retroceso/
  2izquierda/3derecha/4apoyo; a=stride, b=height, durationMs=phaseMs.
  1–20 ciclos como repeat común. Dos ejemplos nuevos completos: gorillaTrack y
  gorillaTrackProcedures, preparar/8ciclosadelante/esperar/8atrás/esperar.
  Modular3tareas2tabs; Main tres llamadas. Ejemplos anteriores intactos.
- Runtime1.14.0 ABI1/cap gorilla-gait, firmware/packaging/deploy/testcontratos
  actualizados. Giro físico bloqueado hasta confirmación adulta en escena,
  tanto en exportaciones/reglas como en intérprete. Sin migraciones/deps.
- Evidencia: tipos/lint, smoke completo (incluye mundos previos y Gorilla60),
  build10páginas estáticas (aviso previo chunk>500KB), seis tests backendGorilla
  y packaging. Core C++ bajo -Wall/-Wextra/-Werror, paridad TS, HAL intérprete y
  ambas salidas; cinco modos y dos ejemplos worker a1×/4×, STOP/RESET/pausa.
  Navegador: ambos ejemplos nuevos, configuración guardar/cancelar/undo/redo/
  reabrir; regresión previa58/59. La primera corrida conjunta dio11/12:
  el test antiguo de pausa leyó un snapshot anterior al ACK; se añadió espera
  explícita de Reanudar antes de tomar posición estable (sin cambiar runtime).
  Rerun final dirigido: 3/3 aprobados (dos nuevos + trayectoria modular), tras
  11/12 iniciales; toda la cobertura ejecutada quedó aprobada. SDK completo,
  robot físico y renderer Waveshare pendientes; no confundir C++/HAL con ellos.
  Actualización dev1 corre por propietario. No comenzar61 ni mandos62–64.

### Entrega vigente19/10 — Resto59: cinemática v3 y trayectorias

Rama `codex/fase-59-gorillabot-trayectorias` desde origin/dev1
`6909d040497f6a4a2083d1a2992dd4a68a080e05`.
[Guía completa](FASE_59_GORILLABOT_CINEMATICA.md). Propietario aportó carpeta
GorillaBot4577379 y confirmó THIGH_SERVO_MG90S_v3 del3MFx8. Fase59 por ángulos
está integrada en origin/dev1; esto no prueba su aceptación física.

- Medidas nominales STL: muslos50mm, ambas pantorrillas100mm, separación de
  ejes46mm en ambas bases. Herramienta propia scripts/measure-gorilla-v3.py,
  lectura/círculos/hashes/unidades/8instancias3MF sin escala, sin dependencias.
  No copiar el visor de armado: usa46,1/98,9 aproximados. Fuentes originales
  quedan en Downloads del propietario, no se importan assets/código CC BY-NC-SA.
  Guía conserva identificación/hashes/método para continuar desde otra cuenta.
- kinematics opcional: perfil gorilla-v3-50-100-46,zeroAngles[8],pulseMinUs,
  pulseMaxUs,verified. Referencia90° hacia abajo sólo previsualización inicial.
  A delante/CALF_EXT, B detrás/CALF_INT. Inversión de servo resuelve reflejos.
  Pulsos anteriores1000–2000 conservados, no se copia automáticamente544–2400
  ni canales del programa adaptado (DI0/1,DD7/6,TI2/3,TD5/4).
- FK/IK con rama fija inferior/A−acos/B+acos, límites de servo y márgenes
  numéricos/singularidad, sin clipping ni conmutación. Eje L4, no apoyo en suelo.
  Se valida camino entero incluida entrada desde posición ordenada actual;
  paso≤0,25mm,16–256subdivisiones, IK cada tick y duración ampliada30°/s+5%
  sobre tasa muestreada. No certifica colisiones/holguras/equilibrio.
- trajectories opcional:8bibliotecas,16puntos cada una,IDs/nombres estables,
  leg0..3,forward±50/up±30mm/ms200–10000,120s pedidos/180s efectivos máx.
  Presets levantar/apoyar, rectángulo y arco como polilínea; editor amplio con
  lista/arrastre/reordenado,undo/redo60,guardar/cancelar y preview sin USB.
  Guarda al borrador; después Guardar cambios y Guardar escena.
- Bloques mover pie y recorrer1–20veces (bucle común), nuevos ejemplos completos
  trayectorias directo/modular3tareas2tabs. Ejemplos58/59anteriores intactos.
  Simulador conserva posiciones internas fraccionales y j0..7 enteros como
  contrato previo, no sensores. Banco usa geometría medida al habilitar perfil.
- Runtime1.13.0/ABI1/cap gorilla-kinematics-v3, acciones gorilla/foot,path.
  Sharedcore C++ exports Arduino/IDF e intérprete, controlador/PCA sin cambios
  de pines automáticos. Transferencias acotadas, dueño único, pausa/STEP/STOP.
  Comprobar dos confirmaciones adultas (general y geométrica) antes de hardware.
  Cambios de calibración invalidan la segunda; cambios de pulsos también general.
  Preparar no centra servos; tras encender/reiniciar no conoce posición real.
- Pruebas locales:220posiciones TS↔C++,3presets/límites/tasa/rechazo íntegro/
  parada/rollover/falloI2C, funciones reales del intérprete con dobles HAL,
  5testsDjango y workspaces en worker1×/4×. Smoke completo y build10páginas
  aprobados (aviso habitual chunk>500kB). Chromium:3nuevos recorridos aprobados,
  regresión de los6anteriores también aprobada:9/9 Chromium. Arrastre de punto
  y undo de gesto comprobados en repetición del editor. Tipos/lint aprobados.
  Entrada FK→IK debe coincidir con ángulos actuales para impedir un salto de rama;
  prueba específica TS/C++ tras ángulos20/−20. deviceSignature del workspace
  incluye config de gorilla para refrescar bibliotecas/calibración sin recargar;
  no mantener un weakmap con puntos antiguos después de guardar la escena.
  Décimo recorrido Chromium aprobado: modificar Levantar, guardar y ejecutar
  inmediatamente sin recargar, sin diagnóstico de referencias obsoletas. CAPI_G_PI evita macro PI de Arduino.
- No dependencias/migraciones; conservar SDK/cache incremental. SDK ESP-IDF
  completo, actualización/aceptación dev1 y prueba física NO ejecutados aquí.
  No se operaron servidores/main/dev2. No iniciar60 ni teleoperación por inferencia.
- Entrega commit/push sólo rama; usar capi-dev --env dev1 --branch
  codex/fase-59-gorillabot-trayectorias --commit SHA40 publicado.

Los apartados inferiores son históricos y no revocan esta ampliación autorizada.


### Entrega vigente19/10 — Fase59: posturas por ángulos

Rama `codex/fase-59-gorillabot-posturas` desde origin/dev1
`d8f33ed9ac36da7a4ea67db5cd67479f369110a3`.
[Guía59](FASE_59_GORILLABOT_POSTURAS.md), [plan58–64](PLAN_GORILLABOT_EVOLUTIVO.md).
El propietario confirmó58 instalada en dev1. No se operaron servidores/main/dev2.

- Alcance explícito: posturas por ángulos. Trayectorias físicas XY/IK59 pendientes
  hasta medidas/CAD reales; no inventar geometría ni iniciar60.
- config.postures opcional del gorilla, hasta16, ID estable/nombre único/8ángulos
  enteros −20..20 y dentro de límites calibrados. Legacy58 sin biblioteca ofrece
  Referencia; [] explícito conserva biblioteca vacía. Modelo/JSON/backend estrictos.
- Modal Editar posturas desde inspector: alta/duplicación/nombre/baja confirmada,
  8campos por pata, preview local sin USB, pausa/continuación/progreso,60undo/redo,
  Guardar/Cancelar y confirmación de cierre. Guardar sólo aplica al borrador:
  después Guardar cambios y Guardar escena. No convierte preview en estado inicial.
- Bloque ir a postura por ID; rename conserva referencia y baja produce error,
  sin sustitución silenciosa. Ocho motores con tiempo común,200–10000ms y30°/s,
  sin dos movimientos compitiendo. No FIFO prometido entre procesos.
- Intérprete1.12.0/ABI1/cap gorilla-postures; sharedcore idéntico Arduino/IDF/
  intérprete, límites revalidados y arrays estrictos. Se conservan acciones58.
  Guardas de hardware/pines/verified y bloqueo Waveshare vigentes.
- Ejemplos completos nuevos explorar posturas y posturas con procedimientos:
  Referencia/A+8°/B−8°, tres ciclos; modular4tareas/3tabs. No son de pie/agachado
  certificados ni marcha. Dos ejemplos58 intactos.
- Sin dependencias/migraciones. Conservar SDK/cache incremental; sólo recompilar
  aplicación al actualizar. La primera posición física sigue desconocida:
  sostener montaje/calibración adulta. Órdenes y postura mostrada no son sensores.
- Pruebas locales: smoke completo, tipos/lint/build10páginas,4tests backend,
  modelo/JSON/reglas/generadores y worker1×/4×, driver C++ HAL con warnings como
  errores y validación real del intérprete. Navegador:6recorridos Chromium aprobados
  (4ejecuciones58/59 y2editores; dos regresiones corregidas y repetidas).
  SDK completo y robot físico NO probados; aceptación dev1 pendiente del propietario.
- Entrega: commit/push sólo rama. Actualizar con capi-dev --env dev1 --branch
  codex/fase-59-gorillabot-posturas --commit SHA40 publicado. Telemetría de placa
  describe preparar/motor/par/postura por nombre; editor mantiene acciones visibles. No promover main.

Los apartados inferiores son históricos; no revocan el alcance59 acordado.


### Entrega vigente19/10 — Fase58: GorillaBot, banco y una pata

Rama `codex/fase-58-gorillabot-banco` desde origin/dev1
`481854cf239f3cc41fc247be8ffc1804646743f1`. [Plan evolutivo58–64](PLAN_GORILLABOT_EVOLUTIVO.md)
y [alcance58](FASE_58_GORILLABOT_BANCO.md). Sólo58 autorizada/implementada.
Fase57 confirmada por el propietario en dev1; pidió comando de promoción, pero
no confirmó ejecutarlo. No se operaron servidores, main ni dev2.

- Componente gorilla/perfil GORILLA_PCA9685: 8servos, patas DI/DD/TI/TD y motores
  A/B. Wemos o DevKitS3, bus I2C1 dedicado/PCA9685; ningún LEDC para esos8canales.
  Preparar sin centrar ocho motores, movimientos relativos −20..20°, límites
  calibrados, máximo30°/s,200–10000ms; espera del camino y otros siguen.
- Banco nuevo gorillaBench, robot/pares articulados y vista ampliada seleccionable.
  Ilustración propia de mecanismo5barras, no geometría real/IK ni equilibrio.
  Una pata aquí es un par A/B explícito. Coordenadas/posturas medidas en59;
  marcha60, autonomía61, web/celular62, mandoESP3263 y Waveshare64 pendientes.
- Inspector dedicado: canales únicos, centros/inversión/límites, dirección I2C,
  preview local sin USB, guardar/cancelar objeto/escena, undo/redo existentes.
  Calibración nace sin verificar; una persona adulta revisa antes de reglas o
  fuentes para hardware. Esa confirmación no es un certificado/permiso de rol
  ni enlaza automáticamente la calibración con el hardwareID de otra unidad.
- Estados j0..7 ordenados (enteros, no realimentación), ready/moving/error
  consultables. Dos ejemplos completos: conocer un motor y una pata con
  procedimientos (3tareas/2tabs). Simulación1×/4×, pausa/Paso/reset/STOP, sin
  sensores manuales competidores ni ocho servo-componentes sueltos.
- Intérprete **1.11.0**, ABI1/capacidad gorilla-bench. Rechazo de perfil/calibración/
  pines/órdenes inválidos también en firmware. Núcleo C++ idéntico entre exports
  Arduino/IDF e intérprete; I2C acotado5ms. Mantener último pulso al detener, no
  desenergizar y hacer caer. Actualizar firmware al probar esta capacidad.
- Sin dependencias ni migraciones. Hay cambios de aplicación de firmware y
  generador; usar caché incremental existente, no borrar outputs/SDK.
  Banco Waveshare no implementado y capacidad no se anuncia en esa placa.

Evidencia local: smoke completo aprobado (incluye pruebas GorillaBot); ambos
workspaces reales con JSON portable, pestañas normalizadas y valores/capacidades,
reglas y generadores; preparación necesaria, sólo motores elegidos, límite/
inversión, movimiento cooperativo, pausa/Paso/reset/STOP. C++Arduino/IDF compilado/
ejecutado con HAL y -Wall/-Wextra/-Werror, núcleo idéntico al header de intérprete;
funciones reales nuevas de intérprete extraídas/compiladas y ejecutadas con HAL,
validación/calibración/pines, I2C, pausa y parada. No equivale a compilar todo SDK.
6pruebas Django(58/57), los2proyectos reales frontend→Django,26contratos de
empaquetado/entornos/reanudación/caché aprobados. Chromium3recorridos (dos ejemplos
y calibración preview/guardar/cancelar), repetición del modular tras ajuste
visual y capturas inspeccionadas. Tipos/lint, lint de nuevos componentes y build
10páginas aprobados; warning existente de chunk grande, no error.

Pendientes: integrar/actualizar sólo dev1 por propietario; SDK completo en la
actualización y prueba mecánica/eléctrica de robot/PCA9685 reales. No hubo acceso
a un GorillaBot físico. Banco no simula equilibrio ni autoriza caminar.
No iniciar59 sin validar medidas, montaje/rama y recorridos reales.
La incidencia HAL previa de56 sigue documentada; no se afirma suite HAL antigua
completa aprobada ni se modificó para ocultarla.


### Entrega vigente 19/10: fase57 — Laguna, depósito y bombeo

Rama `codex/fase-57-laguna-bombeo` desde origin/dev1 `86e6cfe`.
[Reglas aprobadas y guía](FASE_57_LAGUNA_DEPOSITO_BOMBEO.md). Fase56 actualizada
en dev1 según confirmación del propietario; Git remoto contiene su integración.
No es aceptación de SDK, hardware o renderer Waveshare.

- Nuevo pondLab, independiente de pond/counter históricos. Reserva300L/laguna100L,
  bomba2L/s, servo/desagüe3L/s/1,2s; balance explícito, lluvia/fuga/evaporación,
  derrame acumulado y humedad residual con secado15s. No apagar órdenes ni
  proteger automáticamente por el alumno. Integración worker determinista20ms.
- Dos distancias automáticas inversas120–20cm, bandeja con threshold del sensor.
  Lugares y cantidades fijos, falta/quitar/reponer sin inventar lecturas;
  control de potencia MOSFET proporcional y relé binario. Nombres configurados.
- Condiciones guardables y ensayos transitorios lluvia/fuga/recarga, sin sliders
  competidores para sensores. Recarga acotada al avanzar reloj; LOAD previo a
  Simular/Paso preserva ensayos del mismo mundo; Reiniciar borra todo estado.
  Mismo mundo en editor, simulación y revisión; espejo físico no controla ensayos.
- Dos ejemplos completos en catálogo: Laguna con nivel automático (40–70%, directo)
  y Laguna protegida con procedimientos (6tareas/4pestañas/3procesos). Protección
  de reserva, timeout25s de bombeo enclavado hasta reset, desagüe90–80%,
  luz/buzzer por episodio e informe. Responsables únicos por actuador.
- Sin migraciones, dependencias, ABI, nuevo firmware ni SDK; capacidades existentes.
  Actualizador debe reutilizar firmware1.10.0/caché, no borrar outputs.
  No se operaron servidores, main ni dev2. Propietario integra/actualiza sólo dev1.

Pruebas: balance/conservación, límites, reserva seca sin autoapagado, humedad,
slots, frontend/backend, JSON portable, CapiRules y fuentes Arduino/IDF; ambos
workspaces reales a1×/4×, regulación, reserva/recarga, desagüe, timeout, pausa/reset
y bloqueo de controles competidores. Smoke completo y7 pruebas Django(57/53)
aprobados; los dos JSON reales frontend→Django aceptados. Chromium3 recorridos
(ambos ejemplos/pausa/reset y edición guardar/cancelar/undo/redo), capturas
inspeccionadas, build10páginas, tipos/lint y lint de componentes nuevos aprobados.
Advertencia existente de chunk grande conservada; no es un error de build.
La revisión de navegador detectó IDs de pestaña sin prefijo y nombre de variable
>32caracteres; corregidos y agregadas aserciones de normalización/límite.

Pendientes: actualización/aceptación dev1 por propietario, uso infantil/docente,
maqueta física. Mundo específico Waveshare no implementado (no confundir con
simple prueba de pantalla pendiente). SDK/hardware del runtime1.10.0 anterior
siguen pendientes; no reconstruidos por este mundo. Fixture HAL previo de56
sigue documentado, no se altera ni se declara suite HAL completa aprobada.


### Entrega vigente19/10: fase56 — Vehículo seguidor de línea

Rama `codex/fase-56-seguidor-linea` creada desde origin/dev1
`e9158e1949e8739a63c6e16418a7d30d83bebd38`. Incluye por avance rápido42ff720
(documentación55 todavía no integrada); no pierde ese análisis ni lo implementa.
[Reglas aprobadas y guía](FASE_56_SEGUIDOR_LINEA.md).

- Mundo nuevo lineTrack: robot diferencial, barra lineSensors genérica DIGITAL_3,
  sensores frontales izquierdo/central/derecho, geometría común con polilínea.
  Motor izquierdo/derecho −100..100, sin corrección oculta, contacto recuperable.
  Un reloj, pausa/Paso/velocidad/reset; métricas y traza acotadas.
- Recta, óvalo, curvas y S. Modal de circuito con lápiz/recta/curva de3clics,
  seleccionar/mover/borrar, ancho12–24,64 trazos/256 puntos por trazo/512 totales;
  undo/redo60, guardar al borrador, guardar/cancelar escena, JSON frontend/backend.
  Abrir el armador detiene ejecución; sin edición concurrente.
- Dos ejemplos completos: Seguidor de línea básico y Seguidor con búsqueda y
  procedimientos. Cinco tareas/tres pestañas, memoria del último lado y máximo
  2s de búsqueda; si vence, aviso y motores detenidos hasta reinicio. Probado
  recuperar salida a90°; no garantía universal para todo dibujo/cruce.
- Nuevo op robotWheels y capacidades robot-wheels/line-sensors; intérprete
  **1.10.0**, ABI/formato1. Arduino/IDF y firmware leen salidas digitales con
  polaridad configurable. Pines de Wemos34/35/36 sin pull-up interno supuesto.
  Nuevos bloque/valores/configuración/ayuda, sin dependencias ni migraciones.
- Se corrigió la allowlist portable que omitía capi_timer_compare ya existente,
  necesario para importar/guardar el ejemplo. No cambiar código del alumno.
- Actualizador de la revisión lee versión por release y conserva objetos SDK.
  Sin promoción, operación remota ni cambios en main/dev2.

Evidencia local: ambos workspaces reales a1×/4× en óvalo prolongado y los otros
3predefinidos; pérdida con parada/búsqueda limitada, recuperación de salida
girada, posiciones coincidentes mundo/componente, pausa/Paso/reset y entradas
competidoras bloqueadas. JSON/generadores/reglas y8 contratos Django (56/54),
los2 JSON reales frontend→Django y26 contratos de empaquetado/entornos/
reanudación/caché aprobados. Chromium3 recorridos (ambos ejemplos y dibujo/
mover/borrar/undo/redo/guardar/cancelar), capturas inspeccionadas. Casos C++ HAL
nuevos line-true/line-false compilados y ejecutados con warnings como errores.
Tipos/lint, smoke completo y build con10 páginas estáticas aprobados.
Advertencia existente de chunk grande, sin fallo. El dibujo y recorrido nuevos
se inspeccionaron en capturas; esquema de escena y ejecución comparten geometría.

Límite de prueba encontrado: corrida integral scripts/idf-driver.test.mjs se
detiene en su fixture runtime con salida3, antes de casos nuevos. Comparación
de fuentes generadas para ese fixture contra origin/dev1: idénticas byte por
byte; no generado por esta fase. Queda diagnóstico separado, NO afirmar toda
esa suite aprobada. Se añadió filtro CAPI_IDF_CASE para correr casos concretos;
sin filtro conserva la corrida completa y sus fallos, no se ocultaron.

Pendientes: actualización por propietario en dev1, SDK completo1.10.0 y placa
real con módulos digitales exactos/chasis/driver. Mundo y sensores dinámicos en
renderer Waveshare requieren trabajo/aceptación aparte, no inferirlo de la web.
No afirmar aceptación física ni SDK por aprobar g++ con HAL de escritorio.
Ampliaciones PID/ruido/competición/bifurcaciones/obstáculos conservadas como
posibilidades del plan original, no autorizadas. No iniciar otra fase.

Comando como capi en capi-dev, reemplazando SHA40 por la entrega:

```bash
cd /home/capi/capibloques &&
git fetch --quiet origin codex/fase-56-seguidor-linea &&
git show origin/codex/fase-56-seguidor-linea:scripts/update-dev.sh |
bash -s -- --env dev1 --branch codex/fase-56-seguidor-linea --commit SHA40
```

Primera actualización construye intérprete incremental1.10.0 una vez; no
espera Actions ni requiere borrar cachés. Sin --promote. Servidor no inspeccionado.


### Entrega vigente19/10: fase55 — análisis de variantes, sin código

Rama `codex/fase-55-analisis-escenas`, desde origin/dev1
`e9158e1949e8739a63c6e16418a7d30d83bebd38`.
[Informe y candidatos retenidos](FASE_55_ANALISIS_VARIANTES_ESCENAS.md).
Fase55 autorizada para analizar/documentar y cerrada en ese alcance, no como
mundos construidos. No se tocó código ejecutable ni se operó el servidor.

- Parque de luces/riego repite casa/huerta: reutilizar actividades, no duplicar
  motores. Fuente coreografiada retenida para definir aporte propio.
- Laguna con depósito: principal candidato, balance de agua, distancia inversa
  al nivel, bombeo, reserva y derrame. Agua/lluvia mide superficie, no nivel
  omnisciente del tanque. Sin química/oxígeno ni hardware certificado inventado.
- Aeropuerto: sólo justificar si enseña solicitudes/turnos de recurso único;
  variante distribuida depende del canal de fase34. Señales/barreras solas repiten
  tren/tránsito. Puente/barcos también postergado por solapamiento.
- Todas las alternativas, incluidas las postergadas, quedan trazadas dentro de
  fase55; no se crean números nuevos ni se autoriza implementar por documentarlas.
- Siguiente recomendada56: acordar disposición, sensores y reglas del seguidor
  de línea antes de implementar. No empezar código sin autorización explícita.

Verificación proporcional: fuentes de catálogo/modelo/render y guías49–54,
enlaces relativos del informe y diff. Sin build, SDK ni pruebas largas por
documentación. Commit/push sólo a la rama de tarea; integración por propietario.
No hace falta actualizar el sitio para leer el análisis en GitHub.

Confirmación de fase54: propietario dijo «ya quedó en dev» después de recibir
`--promote dev1`. Git remoto leído19/10: origin/dev1=e9158e1 y
origin/main=fe230bb, ambos contienen 7ac3585 (entrega54). Se registra DEV original
actualizado por confirmación operativa, **no** por inspección remota independiente.
No afirmar SDK completo1.9.1, hardware, aceptación infantil o paridad Waveshare
aprobados por esa promoción. Las secciones inferiores conservan el historial.


### Entrega vigente: fase 54 — Teatro interactivo de Otto, sólo dev1

Rama `codex/fase-54-teatro-otto`, desde origin/dev1 `6c9a985`.
[Reglas, dos ejemplos, firmware y guía](FASE_54_TEATRO_OTTO.md).
Software implementado; propietario integra/actualiza sólo dev1. Sin operación
remota ni merge a main/dev2. Las secciones inferiores son historial.

- Mundo `ottoTheater`: escenario fijo, un Otto y petición, grupo de 1–4
  espectadores, distancia frontal por perfil, pulso de 2 s y retirada aunque
  nadie actúe. Automático reproducible o pruebas manuales; sin coreografía oculta.
- Condiciones iniciales con guardar/cancelar/undo/redo; ensayos transitorios
  conservados al LOAD de Simular/Paso. Un reloj, pausa/paso/velocidad/reset.
  Cambios de cercanía/permanencia afectan al próximo grupo, no al actual.
- Ejemplos: Otto: saludar y actuar; Teatro de Otto con procedimientos.
  Seis tareas/cuatro pestañas, atención y una luz en paralelo. Una actuación
  por grupo por lógica del programa, no por el renderer. Wemos tiene conexiones
  válidas con una luz PWM y botón en GPIO4, sin inventar pines para otra luz.
- FIFO corporal también para HOME/brazos, sin preempción; cara/sonido independientes.
  Header C++ acotado a32 compartido exports/intérprete y cola equivalente worker.
  Runtime mínimo **1.9.1**, ABI1; actualizar firmware antes de enviar reglas.
  Empaquetado/orquestadores versionados juntos, sin borrar cachés/objetos del SDK.
- No hay migraciones/dependencias nuevas. Backend acepta JSON opcional estricto.

Evidencia local: smoke completo, tipos/lint y tres recorridos Chromium aprobados;
ambos workspaces reales a1×/4× con automático/manual, una actuación por grupo,
luces, pausa/reset y FIFO sin preempción. Cola compilada/ejecutada en g++ host
con warnings como errores. Doce contratos Django (teatro/clima/pista), los dos
JSON reales frontend→Django y26
contratos de entornos/empaquetado/reanudación/caché incremental aprobados.
Capturas inspeccionadas: se separó el nombre de Otto del estado de su cuerpo.
Build aprobado con10 páginas estáticas; advertencia existente de chunk grande,
sin fallo. Sintaxis Bash y contratos de versión por release aprobados. No se
inició compilación SDK completa ni operación remota.

Pendientes explícitos: actualización por propietario, SDK ESP-IDF completo1.9.1,
servos/sonar/matriz reales, aceptación humana y renderer/dinámica del público en
Waveshare. La ausencia de eco física puede ser0cm, frente a400cm del mundo;
adaptación de ese caso pendiente en la aceptación física de los ejemplos.
No confundir cola C++ probada en host/generación con firmware completo compilado.

Orden como capi, con SHA40 de la entrega (también `git rev-parse origin/codex/fase-54-teatro-otto`):

```bash
cd /home/capi/capibloques
git fetch --quiet origin codex/fase-54-teatro-otto &&
git show origin/codex/fase-54-teatro-otto:scripts/update-dev.sh | bash -s -- --env dev1 --branch codex/fase-54-teatro-otto --commit SHA40
```

Usar el script nuevo de la rama: ejecuta el manager exacto de la release, no
la copia instalada que tenía fija1.9.0. No reinstala herramientas compartidas.
Manager lee versión de cada main.cpp para no renombrar firmware viejo de dev2.
No espera Actions; reconstruye incrementalmente intérprete una vez. Sin --promote.
Fases55–56 no autorizadas para implementar. No avanzar sin pedido nuevo.

### Entrega vigente: fase 53 — Estación meteorológica y puesto protegido, sólo dev1

Autorizada tras aprobar disposición/reglas; rama `codex/fase-53-estacion-meteorologica`
desde origin/dev1 `b079ca1` (fase52 integrada). Se incorporó por fast-forward el
commit documental `0017839` de la fase56 ya publicado, aún ausente en dev1:
no perder ese backlog ni implementarlo. [Reglas y guía](FASE_53_ESTACION_METEOROLOGICA.md).
Nuevo fondo weatherLab, sin cambiar antigua weatherStation/weatherYard.
Mástil/clima/luz/detector siempre exteriores; techo0° cerrado/90° abierto y mesa
mojable como consecuencia visual, no variable física inventada. Sin viento
medido ni pronóstico por presión. Lluvia moja detector gradualmente y deja
humedad residual al terminar. Techo no altera medidas ni seca instantáneamente.
Un reloj worker para programa, clima, servo y dibujo; pausa/paso/velocidad/reset.
Cuatro condiciones, día/noche y secuencia automática reproducible cada20s.
Editor guarda condiciones con undo/redo/guardar/cancelar; Estado y revisión
ofrecen ensayos transitorios conservados al LOAD interno de Simular/Paso.
Sin sliders manuales competidores ni SET_INPUT por IDs de sensores ligados.
Controles transitorios mantienen selección pendiente hasta ACK del worker para
que dos cambios rápidos no se pisen; clave escena/época limpia pendientes al
reiniciar/cambiar. Borrador del armador sigue controlado por su guardado normal.
Dos ejemplos completos: Estación que informa, secuencial y techo abierto;
Puesto protegido con procedimientos, cuatro procesos/ocho procedimientos/cinco
pestañas. Techo cierra>35% y abre<10%; luz enciende<1200 y apaga>1800; buzzer
una vez por episodio y se rearma al secarse<10%, sin bloquear los otros hilos.
Contrato opcional weatherEnvironment estricto frontend/backend, sin migración,
dependencias, firmware, SDK ni ABI. Exportación y reglas con componentes existentes.
Verificado: tipos/lint (también renderer/controles nuevos), smoke completo, modelo
puro y ambos workspaces reales a1×/4×, dos ciclos automáticos y avisos por
episodio; veinticuatro contratos backend de seis mundos y ambos documentos
frontend→Django aceptados. Tres recorridos Chromium aprobados: cambio rápido
de lluvia+noche previo a Simular, sensores, techo, pausa/reset y editor con
undo/redo/guardar/cancelar. Capturas inspeccionadas; luego mejorado contraste
nocturno y techo abierto para que no se recorte. Build con diez páginas
estáticas aprobado; advertencia de chunk grande ya existente. No SDK ni remoto.
Actualizar únicamente dev1 mediante comando instalado con rama/SHA40;
propietario integra y actualiza. Main/dev2 intactos. Aceptación humana, sensores/
servo/pantalla reales y renderer/dinámica Waveshare pendientes.
Fases54–56 sin autorización para implementar; 56 conserva planificación.
Las referencias inferiores a fase52 como entrega vigente son históricas.

### Agregado de planificación: fase 56 — Vehículo seguidor de línea

Pedido posterior a fase 52: documentar una escena con circuitos predefinidos
o dibujados por el usuario y pensar qué actividades agregar. **Sólo backlog/
planificación**, sin implementar ni empezar fase 53. [Propuesta](FASE_56_SEGUIDOR_LINEA.md)
incluye editor modal, sensores reflectivos (no barrera IR/color), control
independiente de ruedas a evaluar, recuperación, vueltas/checkpoints, cruces,
estaciones y variantes avanzadas. Priorizar y acordar reglas antes de autorizar.
No renumerar 53–55; fase 56 puede reordenarse después por pedido del propietario.
Rama documental desde dev1: `codex/plan-fase-56-seguidor-linea`.
Sin operación remota/main/dev2 ni cambios de runtime/firmware.

### Entrega vigente: fase 52 — Pista de exploración y reparto, sólo dev1

Autorizada tras aprobar disposición/reglas; rama `codex/fase-52-pista-robots`
desde origin/dev1 `2d6229f` (fase 51 integrada). [Reglas y guía](FASE_52_PISTA_ROBOTS.md).
Nuevo fondo robotArena: base, A roja, B azul, meta verde y obstáculos editables
antes de ejecutar. Un solo robot diferencial, sensores frontal/suelo montados
(vínculo por tipo único/ID, no nombre), barrera fija de meta y luces/buzzer.
Mundo puro lib/robot-arena.ts alimentado por reloj worker compartido; no usar
además la física/rebote antigua de robot para este fondo. Contacto considera
radio 22, bloquea desplazamiento pero deja girar/retroceder y programa vivo.
No piloto automático, metas/visitas no detienen ni corrigen el programa.
Distancia idealizada desde el frente contra círculos/paredes, color sólo bajo
robot, barrera con cuerpo completo y visita por 0,6 s detenido sin duplicados.
Recorrido limitado a 300 puntos. Pausa/Paso/velocidad/reset compartidos.
Armar escena → Pista al comenzar: preset despejado/con obstáculo, hasta cuatro,
agregar/quitar/mover con controles X/Y y zonas protegidas. Guardar/Cancelar/
Deshacer/Rehacer habituales. Sensores montados se editan desde lista de objetos,
no se arrastran por separado; sin sliders SET_INPUT competidores. Duplicación
de robot/sensores/meta bloqueada sin excepción de teclado. Robot orientable.
Dos ejemplos completos: Reparto por estaciones (secuencial despejado), Explorador
con obstáculos y procedimientos (para obstáculo incluido 260/420/r28, ocho
procedimientos/cinco pestañas y procedimiento global de reparto). Desvío
programado, no solución de laberinto universal. Ambos visitan A/B y llegan a meta
sin contactos a 1×/4×. Plantillas antiguas robotCourse/robotTrack intactas.
JSON opcional arenaEnvironment (guides/obstacles) estricto frontend/backend;
sin migración, dependencias, SDK, firmware ni ABI nuevos. Exportaciones/reglas
con componentes existentes; físico requiere calibración y aceptación propia.
Verificado: tipos/lint, smoke completo, modelo puro, worker con workspaces reales
a 1×/4×, veinte contratos backend de cinco mundos recientes, dos JSON reales
frontend→Django aceptados; tres recorridos Chromium aprobados (ambos ejemplos,
sensores automáticos, pausa/reset y edición con undo/redo/guardar/cancelar).
Captura inspeccionada: frente del robot, sensores montados y trayectoria del
desvío visibles. Build final aprobado, diez páginas estáticas; advertencia de
chunk grande existente no bloqueante. No compilación SDK ni operación remota.
Actualizar/integrar únicamente dev1 mediante comando instalado con rama/SHA40;
propietario lo ejecuta. Main/dev2 intactos. Aceptación humana, robot físico y
renderer/dinámica Waveshare pendientes. Fases 53–55 no iniciadas.
Las referencias inferiores a fase 51 como entrega vigente son históricas.

### Entrega vigente: fase 51 — Taller y cinta transportadora, sólo dev1

Autorizada tras aprobar disposición/reglas; rama `codex/fase-51-taller-cinta`
desde origin/dev1 `4976e14` (fase 50 integrada).
[Reglas completas, ejemplos y límites](FASE_51_TALLER_CINTA.md).
Una cinta hacia delante, lectura RGB/peso con presencia y estabilización,
desviador gradual 0° A/90° B, dos infrarrojos de confirmación y bandejas.
Paquetes acotados, llegadas reproducibles automáticas o envío manual preparado.
Si llegan mientras gira el desviador, atasco visible hasta Reiniciar; el programa
y servo no se congelan. El mundo nunca decide ni corrige la clasificación.
Mundo puro en lib/conveyor-world.ts, alimentado por el reloj worker compartido;
sensores automáticos sin SET_INPUT competidor ni mandos manuales. Lectura de
peso inválida se distingue en UI; bloques comprueban presencia, detienen y
esperan 0,7 s antes de leer (estabilización 0,6 s). Valor numérico inválido cero,
sin inventar capacidad/propiedad física nueva. Ensayos y petición manual se
conservan al LOAD interno de Simular/Paso, no al reset/cambio de proyecto.
Editor guarda condiciones iniciales por borrador con undo/redo/guardar/cancelar.
Dos ejemplos completos en Proyecto → Ejemplos: color secuencial, peso modular
con variable Peso límite, cinco procedimientos y cuatro pestañas. Llegadas
automáticas espaciadas 20–30 s; entradas manuales muy juntas requieren ampliar
coordinación, no se corrigen ocultamente. Fondo antiguo workshop intacto.
Contrato opcional conveyorEnvironment estricto frontend/backend; sin migración,
SDK, firmware, ABI ni dependencias. Exportaciones/reglas usan bloques existentes.
Pruebas locales de tipos/lint/smoke, modelo puro, dos workspaces en worker con
tres colores/pesos (incluido umbral exacto) a 1×/4× y flujos automáticos, dieciséis
contratos backend y ambos documentos frontend→Django aceptados.
Tres recorridos Chromium aprobados: ejemplos directo/modular con envío previo
a Simular, entrega/pausa/reset y editor con condiciones iniciales/undo/redo/
guardar/cancelar. Captura inspeccionada y duplicación de rótulos corregida.
Build final aprobado, diez páginas estáticas; lint/tipos finales aprobados.
Prueba adicional del worker verifica que un programa incorrecto produce atasco,
continúa ejecutándose y se recupera con reset. No equivale a despliegue/hardware.
Actualización por propietario sólo dev1, comando instalado con rama y SHA40;
no integrar ni operar main/dev2/servidor. Aceptación humana, maqueta física y
renderer/dinámica Waveshare de este mundo pendientes. Fases 52–55 no iniciadas.
Las referencias inferiores a fase 50 como entrega vigente son históricas.

### Entrega vigente: fase 50 — Casa inteligente y entrada segura, sólo dev1

Autorizada tras aprobar reglas; rama `codex/fase-50-casa-entrada-segura` desde
origin/dev1 `73ac1b7` (fase 49 integrada). [Reglas y guía](FASE_50_CASA_ENTRADA_SEGURA.md).
Un acceso compartido, visitantes acotados, timbre/tarjetas/paso/presencia/salida
automáticos; puerta sólo obedece al programa y permite terminar a quien cruza.
Comparación de tarjeta es del alumno, no permiso oculto del mundo. Luces PWM
según presencia/oscuridad con luminosidad interior realimentada. Botones/luces
pueden moverse sin cambiar función, mediante canvas.houseAssignments validado.
Sensores/lector/puerta anclados. Estado y revisión: condiciones virtuales y envío
manual predefinido, sin controles manuales competidores; prueba transitoria.
Armador guarda condiciones iniciales con undo/redo/guardar/cancelar. Un reloj
worker para algoritmo/mundo, pausa/paso/velocidad/reset, sin temporizador React.
Dos ejemplos completos: directo atiende cualquier timbre; modular acepta azul,
rechaza roja/sin tarjeta y atiende salidas sin tarjeta. Seis procedimientos y
cuatro pestañas. JSON opcional houseEnvironment/houseAssignments; sin migración,
SDK, dependencias, firmware ni ABI nuevos. Versiones antiguas Casa/Entrada intactas.
Verificado localmente: tipos/lint, smoke completo, ambos workspaces con tres
tipos de visitante a 1×/4×, diecisiete contratos backend, ambos JSON frontend→Django
y tres recorridos Chromium (envío antes de Simular, luz, acceso, pausa/reset,
condiciones iniciales con undo/redo/guardar/cancelar), capturas inspeccionadas.
Build con diez páginas estáticas. Arranque Simular/Paso conserva ensayos y
visitante pendiente en el worker, sin depender de snapshots React ni preservar
actores al cargar. Reset/otro proyecto no heredan ensayo; huerta conserva también
sus condiciones de prueba al iniciar. Es sólo protocolo interno web, no firmware.
El propietario integra/actualiza sólo dev1 con comando instalado; no se opera
servidor/main/dev2. Waveshare, maqueta y aceptación humana pendientes. Fases
51–55 no iniciadas. Las referencias inferiores a 49 como última entrega son históricas.

### Entrega vigente: fase 49 — Huerta e invernadero, sólo dev1

Autorización explícita tras acordar disposición/reglas. Rama
`codex/fase-49-huerta-invernadero` desde origin/dev1 `821cc1c` (fase 48 integrada).
[Guía completa](FASE_49_HUERTA_INVERNADERO.md). Dos canteros con riegos independientes,
sensores automáticos de suelo/clima/luz, ventana servo; estrés y recuperación,
sin riego automático oculto. Condiciones ambientales iniciales guardables y
controles de prueba transitorios. Un reloj worker, pausa/paso/velocidad/reset.
Dos ejemplos completos: riego directo de ambos canteros con ventana fija abierta,
y control con seis procedimientos/cuatro pestañas que regula ventana por temperatura.
La antigua smartGarden se conserva. JSON aditivo gardenEnvironment opcional y
validadores alineados; sin migraciones, toolchain, firmware ni ABI. Se arregló
allowlist de capi_power_switch y selección de datos de módulos educativos.
Verificado localmente: tipos/lint, smoke completo, ambos workspaces a 1×/4×,
modelo de agua/clima/plantas, JSON real frontend→Django, trece contratos backend
y tres recorridos Chromium, con capturas inspeccionadas; build con diez rutas
estáticas. Rótulos separados y lecturas de tierra a 1%/clima a 0,1. Sin espera CI.
Commit/push y comando instalado sólo dev1; el propietario integra/actualiza.
No se opera servidor/main/dev2. Maqueta física, Waveshare y aceptación humana
pendientes; fases 50–55 no iniciadas. Las menciones inferiores a fase 48 como
última entrega o a 49 sin autorización son históricas.

### Entrega vigente: fase 48 — Estacionamiento, sólo dev1

Autorizada e implementada en rama `codex/fase-48-estacionamiento` desde
`origin/dev1` (`73dc00f890c82de4094680c2dbae3daa810d6f1f`). Reglas, arquitectura,
pruebas y límites: [FASE_48_ESTACIONAMIENTO.md](FASE_48_ESTACIONAMIENTO.md).
Dos barreras, cuatro infrarrojos, capacidad 4/8/12, autos automáticos y atasco
recuperable si se admite sin plaza. El contador es del programa, no del mundo.
Dos ejemplos completos de 8 plazas: directo y cinco procedimientos/cuatro tabs.
Cambiar capacidad física no reescribe bloques: ajustar también variable Capacidad.
Un reloj worker para autos/sensores/programa. Guardar/Cancelar/undo/redo del armador.
JSON aditivo con parkingCapacity opcional; validación frontend/Django alineada.
Verificado localmente: tipos/lint, build y diez rutas estáticas, smoke completo, ejecución real de ambos
workspaces 4/8/12 a 1×/4×, nueve contratos backend, ambos JSON frontend→Django y
tres recorridos Chromium (simulación, pausa/reinicio, capacidad/undo/redo/guardar/
cancelar confirmado). Captura inspeccionada. Sin esperas de GitHub Actions.
Sin SDK, firmware/ABI, migraciones ni nuevas dependencias. Renderer Waveshare,
maqueta física y aceptación humana siguen pendientes; fases 49–55 no iniciadas.
Integración/actualización dev1 a cargo del propietario con `~/.local/bin/capi-dev
--env dev1 --branch codex/fase-48-estacionamiento --commit SHA40`. No se opera
el servidor en esta entrega, no se integra main ni dev2 ni se promociona nada.

Documento vivo iniciado en **fase 11**. Actualización: **17 de octubre de 2026**. Leerlo desde el checkout vigente; no hace falta el historial del chat. Al terminar **cada fase solicitada**, actualizar aquí estado, pruebas, despliegue, pendientes y próxima autorización, junto con el plan y su guía de entrega.

### Activación real dev1/dev2 y copia inicial — 17/18 de octubre

El propietario creó los DNS y autorizó explícitamente instalar/configurar todo
remotamente sin tocar el endpoint actual; después pidió «copia todo tal cual».
Los comandos anteriores NO los había ejecutado. Se instaló el bootstrap y los
dos ambientes, HTTP/HTTPS y certificados independientes en el edge, sin operar
gateway/Proxmox/router/PRD ni cambiar vhost/certificado del endpoint original.

URLs activas: https://capibloques.dev1.nvicchi.com y
https://capibloques.dev2.nvicchi.com. Mismo alias/contraseña que en el original:
copiados 542 registros desde un único snapshot consistente, incluyendo 30 usuarios,
13 proyectos y 53 versiones, colegio/logo, curso y auditorías. Comparación completa
de contenido y claves hash sin imprimirlas; se acepta equivalencia ISO Z/.000Z
en timestamps de Django, nunca se normaliza texto de programas. Datos propios
de cada ambiente desde esa copia; NO sincronización posterior. Secretos, sesiones,
colas/recetas/artefactos privados NO se copiaron. Colas nuevas siguen pausadas.

Snapshot y marcadores fuera de Git, root 0600 en
/var/lib/capibloques-environments/seeds/ y
/etc/capibloques/environments/<env>/seeded-from-main.json. `seed.py` es explícito,
rechaza destinos con datos y comprueba modelos/migraciones/dependencias; cambios
de validación de escenas sin cambio de esquema no impiden la copia. Si importó
y falló sólo su verificación, --verify-existing con snapshot original no reimporta
ni sobrescribe: valida y marca. No usar bootstrap_admin después de esta copia.

Main sigue en HEAD servidor 44608549494130784df8fa57b610eec07f946547, contenedores
editor 0433b3d3cd8d / API 42d9432cab71 / DB 6200aed63c86 intactos. SHA de config
main 206d6264478a9bae9f801297716bc6e51b110022e8f9471cadc30d1af850fcf9 y vhost
7a270a96c3248c8757ce2bf1b203072acc55458b23fc883296b126d1a12a3c14 iguales antes/después.
Sólo cambió runner compartido compatible, drenado y con admisión restaurada.
Se agregó exclusión LOCAL /.worktrees/ en .git/info/exclude: contiene worktree
registrado de la otra persona; no se alteró ni borró ese trabajo.

Edge real 192.168.1.38, ACME /var/www/certbot, HTTP 80 / HTTPS interno 8443.
Certificados nuevos válidos hasta 15/01/2027, renovación webroot y hook global
reload-nginx existente. Sólo dos archivos nuevos sites-enabled/zz-capibloques-dev1.conf
y zz-capibloques-dev2.conf; nginx -t correcto. Se movieron de la posición inicial
en conf.d para conservar el servidor TLS por defecto y orden de protocolos original;
ningún vhost ajeno cambiado. Migración validada contra contenido idéntico, con
respaldos propios /var/backups/capibloques-edge/. Advertencias previas de opciones
de protocolo compartidas no se corrigieron: fuera del alcance, no errores.

La primera imagen de generador usó accidentalmente Docker legacy (minutos por
COPY de una base enorme). Corregido y probado en DEV con Compose/BuildKit:
exportación del overlay dev2 0,4 segundos, sin SDK nuevo ni recompilación ESP32.
Gestor raíz actualizado atómicamente bajo el bloqueo; código en la rama de tarea.
Los tres sitios dieron login 200, health ok y sesión anónima independiente;
configuración pública de colegio idéntica. Servicios nuevos activos y habilitados
para arranque; imágenes/revisiones verificadas por el actualizador. Sin CI ni
compilación de programa/SDK, sin reboot ni prueba física ni contraseña humana
introducida. No atribuir esas aceptaciones al smoke HTTP o la copia de hashes.

Operación diaria: ~/.local/bin/capi-dev --env dev1|dev2; tarea nueva con --branch
y SHA de entrega, sólo --promote pasa a main cuando lo pida el propietario.
Guía FLUJO_RAMA_INTEGRACION_DEV.md vigente; referencias inferiores a «sin instalar»
son históricas. No hay promoción de main ni copia continua de bases.

### Tres endpoints aislados — acuerdo vigente (17 de octubre)

Rama `codex/ambientes-dev1-dev2`, parte de origin/main 094c846 e incorpora
3d060c1 (bloqueo previo). Usuario autorizó main/dev1/dev2 en la misma VM;
crea él los DNS. Main conserva capibloques.dev.nvicchi.com; nuevos dominios
capibloques.dev1.nvicchi.com y capibloques.dev2.nvicchi.com. Guía completa y
bootstrap: `FLUJO_RAMA_INTEGRACION_DEV.md`, obligatoria para ambos desarrolladores.

`setup-environments.sh` instala comando `~/.local/bin/capi-dev` y gestor raíz,
servicios persistentes e inicializa ramas dev1/dev2 sólo si no existen. No
publica main ni cambia web/API/base actuales; drena y reemplaza sólo runner
compatible, restaura admisión original. Actualizar dev1/dev2 crea API/PG/editor,
volúmenes, secretos/sesiones/redes/artefactos independientes, sin copiar main.
Release inmutable por SHA y API sin bind de código cambiante. PG 128 MiB por
ambiente, API 256, editor 64; medir consumo real y swap en esta VM limitada.

Tareas desde origin/dev1 (nosotros) u origin/dev2 (otro), ramas codex únicas y
clones separados. `capi-dev --env dev1 --branch codex/tarea --commit SHA40` NO
toca main. Sólo `--promote dev1`/dev2 integra punta instalada y saludable a
main y actualiza endpoint actual. Rechaza avance remoto no instalado, conflicto,
push rechazado, revisión incorrecta, mantenimiento pendiente o imagen vieja.
Promoción sólo de código; no mueve usuarios/proyectos/bases. El acuerdo humano
de pruebas no se inventa como aprobación automática de UI.

El flock de operaciones sigue común (ocupado 75). Otro flock raíz serializa
builders/compilaciones de las tres colas. Runner etiqueta/reconcilia sólo sus
propios intentos; main legacy sin etiqueta sigue siendo main. SDK/base compartidos
con generador por revisión; firmware sin cambios reutiliza bundles verificados;
caché de intérprete nueva separada de outputs de main. Pines de imágenes
protegen recetas dev1/dev2 frente al script de limpieza viejo; limpieza nueva
conserva también imágenes de recuperación. No se borra caché ESP-IDF ni volúmenes.

Gestor conserva respaldo PG verificado y pending.json ante fallo; reintentar
mismo objetivo, no borrar marcadores ni regenerar secretos faltantes. Cuentas
administradoras se crean interactivamente por ambiente; colas nacen pausadas.
Vhosts edge propios con instalador HTTP/HTTPS, certificados propios y rollback
acotado. No cambia gateway, Proxmox, PRD ni certificados/vhosts ajenos.

Verificación local: 7 escenarios Git reales/concurrencia, 9 contratos de ambientes,
5 aislamiento del compilador, 11 contratos public-dev, sintaxis Bash/Python y
PowerShell. Sin CI ni SDK/build Docker ni SSH. **Pendientes:** instalar en Linux,
DNS/Nginx/TLS, cuentas, aceptación UI/datos/compilación/reboot/recursos y promoción
real. No se operó servidor ni se publicó main. Las instrucciones inferiores
de --branch sin ambiente son históricas y quedan sustituidas por este acuerdo.

### Integración y actualización DEV anterior (17 de octubre, sustituida)

Pedido autorizado: reemplazar el bloque largo por script genérico y admitir
una sola operación DEV a la vez. Rama `codex/integracion-dev-bloqueada` desde
origin/main 094c846 (multivía integrada). update-dev.sh recibe --branch RAMA
[--commit SHA40], integra en worktree separado, publica main y actualiza sin
adelantar HEAD operativo. Rama ya integrada se salta para reintentar runtime.
--fast sin CI; --full opcional; --check-only no admite rama. Guardas conservadas.

flock compartido en /home/capi/.local/state/capibloques/dev-operation.lock antes
de Git/sudo; ocupado sale 75 con PID/inicio/rama, sin cola ni cambios del repo.
No borrar el archivo persistente ni desbloquear por PID: manda el descriptor.
No protege comandos manuales/scripts antiguos/pushes fuera de DEV; todos deben
adoptar el flujo nuevo. Windows invoca el script instalado sin chown/fetch
remoto previo. Primera instalación mediante bootstrap concreto de la entrega.
Guía FLUJO_RAMA_INTEGRACION_DEV.md actualizada para todas las personas/IA.

Pruebas con Git real temporal y procesos concurrentes, sin SSH/sudo/Docker ni
servidor. No se operó DEV ni se publicó main; el propietario integra e instala.
Sin cambios de infraestructura, firmware, compilador ni dependencias.

Verificación: seis pruebas operativas con Git y concurrencia, once contratos
de public-dev y sintaxis Bash/PowerShell aprobados. No se ejecutó CI, build SDK
ni despliegue remoto. La primera instalación y aceptación en Linux/DEV siguen
a cargo del propietario; las pruebas locales se ejecutaron con Bash/flock MSYS.

### Paso a nivel multivía — ampliación autorizada (17 de octubre)

Rama `codex/paso-nivel-multivia`, desde origin/main 4460854 (integra el ejemplo
modular previo). Configuración del borrador 1/2/4 vías; JSON opcional
canvas.railTracks (ausente = 1). Ambos ejemplos de una vía se conservan; nuevos
ejemplos 2/4 con procedimientos/pestañas, un monitor por vía y control común de
la variable Trenes pendientes. Dos detectores por vía y dos servos comunes.
Un tren máximo por vía, simultáneos entre vías; sentidos fijos alternados para
2/4. Geometría, sensores y colisiones por vía en worker y SVG; 45 unidades/s
en multivía permite despejar el cruce más ancho. Sin protección oculta.

Cambiar cantidad agrega/retira sensores en borrador, conserva IDs existentes y
retirados y admite undo/guardar/cancelar; reducción pide confirmación. No adapta
el programa automáticamente: revisar bloques o abrir el ejemplo correspondiente.
Validadores frontend/backend aceptan sólo 1/2/4 y posiciones de cada disposición.
Reglas completas en FASE_47_PASO_A_NIVEL.md. No cambia firmware/ABI ni DB.
Integración/DEV y aceptación humana/física pendientes; mundo Waveshare pendiente.

Cierre local multivía: tipos/lint, smoke completo, build/10 rutas estáticas,
cinco pruebas backend y JSON real frontend→backend aprobados. Cuatro ejemplos
en worker, 192 s a 1× y a 4× cada uno; dos/cuatro simultáneos, salida parcial
sin abrir, conteo acotado y sin colisiones. Siete recorridos Chromium cubiertos
entre corridas; se corrigió el clic de barrera interceptado por una luz usando
anclas compactas/prioritarias. Repetición aislada aprobada sin forzar clics ni
ampliar timeout; hubo además una carga inicial lenta de Blockly en otra corrida.
Selector reduce con confirmación, preserva undo y cancelar. Captura de 4 vías
inspeccionada y rótulos de detectores ajustados. No se operó DEV ni SDK.

### Corrección del ejemplo Paso a nivel (17 de octubre)

Ampliación autorizada posterior: segundo ejemplo «Paso a nivel con
procedimientos», conservando el original. Rama `codex/paso-nivel-procedimientos`
desde `origin/main` actualizado (ea9fb95, que integra la corrección anterior).
Nueve tareas sin parámetros y cinco pestañas: Principal, Control del cruce,
Barreras, Avisos y Detectores. Vía ocupada/Vía libre llaman a tareas pequeñas;
Principal decide sentido y llama a ocupada/esperar salida/libre. Guía en fase 47.
No hay nuevo tipo de escena, ABI, migración ni firmware. La prueba de equivalencia
expande llamadas y compara acciones/condiciones/tiempos con el original; el
worker ejecuta ambos 192 s simulados por separado. JSON/generadores/reglas
conservados. Integración/DEV/aceptación humana y limitaciones físicas/Waveshare
siguen pendientes para esta ampliación.

Cierre local de esta ampliación: tipos, lint, suite smoke completa, worker con
192 s a 1× por ejemplo y recorrido Chromium aprobados. El recorrido abre desde
Proyecto, comprueba que ambos ejemplos siguen en catálogo, navega desde la
llamada Vía ocupada a Control del cruce y desde Cerrar barreras a Barreras,
vuelve a Principal y verifica simulación/cierre de ambos servos/pausa. Captura
del Principal inspeccionada. Sin operación remota ni compilación SDK.

El propietario aclaró: ejemplos completos, desafíos a resolver. Se corrige el
workspace del catálogo Paso a nivel, antes vacío: decisión por entrada oeste
o este, ambas luces, cierre de ambos servos, aviso del buzzer, espera hasta
ocupación y liberación del detector opuesto y apertura. Sin automatismo oculto
del mundo ni firmware nuevo. Agregar aventura desde el armador sigue agregando
sólo componentes, sin reemplazar el programa. Regla de producto en AGENTS.

Rama `codex/ejemplo-paso-nivel-completo`, creada desde origin/main que ya
incluye fase 47 (merge 8b44fdd). Verificación: el smoke del worker ahora compila
el workspace real mediante Blockly y lo ejecuta 192 s simulados; confirma
ambas direcciones, cierre/apertura, luces/buzzer y ausencia de choques,
además de pausa/reset/velocidad/Paso. Tipos, lint y mundos verificados.
No se operó DEV; integración/actualización y aceptación humana pendientes.
Las limitaciones físicas/Waveshare de fase 47 no cambian.

### Fase 47 — Paso a nivel, entrega en rama (17 de octubre)

Disposición/reglas aprobadas por el propietario e implementadas en
`codex/fase-47-paso-a-nivel`, desde `origin/main` actualizado. No se operó DEV
ni se publicó directamente a main. Detalle de reglas, detectores, uso, alcance
y pendientes en [FASE_47_PASO_A_NIVEL.md](FASE_47_PASO_A_NIVEL.md).

Nueva plantilla/ejemplo/fondo railCrossing: una vía horizontal, calle doble
mano vertical, un tren con longitud, dos servos en posiciones fijas, dos
barreras infrarrojas digitales, dos luces y buzzer. Trenes de ambos sentidos
y autos con llegadas acotadas/reproducibles. Sensores ocupados hasta el último
vagón; roles entrada/salida dependen del sentido. Luces/buzzer sólo avisan.
Servos 0° cerrado, 90° o más abierto; recorrido virtual 1,2 s sin bloqueo.
Los autos esperan antes de barrera al empezar cierre, quienes pasaron despejan,
y esperan hasta apertura completa para arrancar. Accidente auto–tren marca a
ambos y conserva el mundo congelado hasta Reset; Stop/Run y Paso no lo limpian.

El mundo vive en el worker y alimenta los mismos valores booleanos usados por
condiciones. No es una animación separada ni entrada manual simultánea. Comparte
pausa, velocidad, Paso y Reset con el programa. SVG consume la instantánea;
armador/revisión web usan la misma geometría. No persistir actores/fotogramas.
Backend acepta los nuevos IDs y valida dimensiones/roles; la lista de escenas
de simulación se alineó con las aventuras ya existentes. Sin migraciones, SDK
ni cambio de firmware/ABI. Si el actualizador detecta artefactos de intérprete
faltantes/anteriores puede reconstruirlos; esta fase no cambia su fuente.

Verificación local: tipos/lint, suite smoke completa (incluye mundos previos,
JSON/generadores y worker), build web/10 rutas estáticas, tres pruebas backend
sin DB y JSON real frontend validado por Python. Pruebas navegador cubren
sensor→if→LED, cierre, pausa/reinicio, choque persistente y roles/límites/
cancelación del armador. La prueba de pausa espera confirmación del worker
antes de comparar posiciones, sin ocultar deriva real. Resultados finales y
pendientes se amplían al cerrar la entrega.

Cierre local: nueve recorridos aprobados, tres por Chromium/Chrome/Edge,
incluido el ACK de pausa. Captura inspeccionada. Tipos/lint, suite smoke completa,
build y tres contratos backend aprobados. Agregar la aventura respeta la lista
de IDs retirados del documento y no pisa ni reutiliza componentes anteriores.

Sólo barreras infrarrojas implementadas como detectores del mundo; switch,
ultrasonido y Hall/reed no son perfiles intercambiables. La continuidad real
entre vagones requiere ensayo/filtrado con la maqueta concreta. En hardware
los sensores leen la maqueta, no el tren virtual: el espejo no es telemetría.
Waveshare todavía no dibuja este mundo; portado/aceptación pendientes, al igual
que maqueta y aceptación docente/infantil. No iniciar fases 48–55.

El propietario integra la rama en worktree separado y luego actualiza DEV con
el comando de entrega que verifica SHA. No hacer merge/pull previo en la carpeta
operativa ni descartar trabajo ajeno. DEV sigue pendiente de esa ejecución;
no se afirma actualizado por las pruebas locales.

### Flujo compartido de ramas — acuerdo del 17 de octubre de 2026

Todas las personas/IA trabajan desde ahora en rama `codex/<tarea>` y carpeta
independiente por sesión simultánea. Entregan rama/SHA/pruebas y comando al
propietario para merge + actualización DEV. Procedimiento completo y plantilla:
[FLUJO_RAMA_INTEGRACION_DEV.md](FLUJO_RAMA_INTEGRACION_DEV.md), también enlazado
desde README y obligatorio en AGENTS. No hacer merge/pull previo en la carpeta
operativa: el actualizador necesita su HEAD anterior para auditar mantenimiento.
Integrar en worktree aparte, push sin force a main y luego actualizador habitual.
Conflictos/cambios locales/push rechazado detienen sin pisar ni esconder trabajo.
La documentación se publica en `codex/flujo-compartido-ramas`; no se integró main
ni se operó DEV por esta entrega. Las referencias antiguas a push directo a
main no se aplican a tareas nuevas. El script update-dev actual no se modificó
y no integra ramas por sí solo. No se inició una fase nueva.

### Ajustes de interfaz fase 42 — 17 de octubre de 2026

Se implementaron los ajustes de cuenta/invitado, avatar Capi por
defecto, efectos hover, controles Blockly al frente, escala fija del catálogo
ante cambios de zoom, zoom inicial `0,8`, etiquetas de Deshacer/Rehacer/Centrar,
estilo del menú Proyecto y reubicación de Armar escena junto a sus pestañas. Se
retiró la franja alta de invitado y «Mi escena». Las categorías usaban 13 px; el
propietario indicó reducirlas a 12 px. Lint dirigido, typecheck, workbench,
mundos de escena, build y 10 rutas estáticas pasaron; `git diff --check` también.
La suite smoke se detuvo en `frame-animation.test.mjs` porque falta `g++`
(`status=null`); los casos posteriores de esa secuencia no corrieron. El commit
`d792b69d11c34499d44afd23a2d579b2f28ace6b` se pusheó y desplegó en DEV mediante
`update-dev.sh --fast`; imagen activa `capibloques-editor-dev:d792b69d11c3`, salud
interna/pública correcta, admisión abierta, cola vacía y concurrencia `1/1`.
Quedaron 31 GB libres tras retirar una imagen antigua. La aceptación visual
humana sigue pendiente. Detalle en
[FASE_42_SIMPLIFICACION_UI.md](FASE_42_SIMPLIFICACION_UI.md).

### Mundos interactivos y peatones del cruce — 17 de octubre de 2026

Ajuste posterior por pedido de comportamiento similar: auto–auto y auto–peatón
comparten aviso accesible «Choque … La escena está detenida. Reiniciá programa
y escena para volver a probar», icono de precaución y marcas de involucrados.
El peatón se resalta con un aro sin lesiones ni caída. Ambos mundos quedan
congelados hasta reiniciar; no cambia el algoritmo de detección ni el firmware.
Evidencia añadida al recorrido navegador de peatones: ambos tipos de choque,
marcas, inmovilidad tras avanzar el reloj y limpieza al reiniciar. DEV sigue
pendiente del propietario, no se despliega por esta corrección.

Se documentó la propuesta completa y el inventario contrastado en
[PLAN_MUNDOS_INTERACTIVOS.md](PLAN_MUNDOS_INTERACTIVOS.md), enlazado en backlog,
plan principal y plan numerado. Fases 46–55: peatones, tren/paso a nivel,
estacionamiento, huerta/invernadero, casa/entrada, cinta transportadora,
pista de robots, clima, escenario Otto y análisis parque/laguna/aeropuerto.
Sólo fase 46 autorizada para implementar; no iniciar las siguientes por estar
documentadas. Fase 45 conserva presentación/fidelidad y no se declara cerrada.

Fase 46 implementada en web: cada cartel peatonal activado controla el paso de
su esquina y lo identifica por nombre. Población desde ambas veredas, espera
en OFF/no caminar, inicio en caminar y finalización aunque cambie el cartel.
Sin cartel no aparecen peatones en ese paso. Coincidencia espacial auto–peatón
genera conflicto no gráfico con aviso accesible y reinicio; no hay frenado
mágico ni falsos conflictos con autos en su línea roja. Máximo 16 personas,
cuatro por paso, llegadas variables reproducibles y estado transitorio fuera
del JSON. Comparte reloj/velocidad/pausa/reinicio de los autos; se usan subpasos
acotados para velocidades altas. No modifica firmware, ABI, migraciones ni
opciones serializadas: usa el cartel existente. Guía de uso y pendientes:
[FASE_46_PEATONES.md](FASE_46_PEATONES.md).

Verificación local: tipos y lint; pruebas puras de peatones integradas en
mundos, regresión completa de autos/mundos, worker, carteles y workbench.
Seis recorridos de navegador aprobados: espera/cruce/pausa/reinicio y conflicto
espacial/reinicio en Chromium, Chrome y Edge. Captura inspeccionada; rótulos y
personas ampliados para legibilidad. Build web y rutas estáticas verificados.
No se ejecutó CI/compilación de firmware ni una suite backend por este cambio.

Publicación DEV pendiente del propietario mediante el comando habitual
`git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast`
desde `/home/capi/capibloques`. No se desplegó remotamente esta entrega.
Aceptación docente/infantil pendiente. **Waveshare no incorpora todavía los
peatones ni sus conflictos**: portado y prueba física pendientes, no inferir
paridad por funcionar el espejo web. Botón peatonal sigue siendo la entrada
programable existente, sin asociación/pulsación automática introducida aquí.

### Armador de escenas: simplificación y deploy DEV — 15 de octubre de 2026

Por pedido explícito del propietario se retiró el selector duplicado de placa,
se simplificó el encabezado para dejar estados y cierre, y se amplió la columna
del inspector a costa del tablero. La edición del nombre de escena sigue vigente;
su futura relación con el nombre del proyecto requiere una decisión aparte por
la recuperación e importación de escenas. Commits funcionales separados:
`ec01571`, `d9879f3`, `50c2cad`.

Se publicó `50c2cad` en `main` y se desplegó DEV con el orquestador en modo
`--fast`. Confirmó la imagen `capibloques-editor-dev:50c2cad38513`, editor
saludable, validación final correcta, cola vacía y admisión abierta. La limpieza
Docker no terminó porque quedan menos de 2 GiB libres; la actualización sí se
confirmó como completa. CI completa ejecutada para el mismo commit: `backend`
aprobó; `verify` falló en `scripts/idf-driver.test.mjs` porque la compilación
de `runtime` devolvió `status=null`; el modo rápido se usó tras la reiteración
explícita del propietario. `esp-idf` y `firmware` no quedaron confirmados por el
cierre temprano ante el fallo. No se ejecutó aceptación visual/humana ni física.

### Ajustes visuales del editor y despliegue DEV — 14 de octubre de 2026

Se integró «Mis proyectos» al menú «Proyecto», se llevó el avatar a la esquina
inferior derecha y se retiró el saludo del encabezado. El catálogo quedó en
escala fija `0,72`, independiente del zoom del programa. Se retiró el título
«Programa visual» y Deshacer/Rehacer/Centrar comparten la fila de «Usar en
placa». Durante la ejecución, Pausar es amarillo anaranjado con texto negro y
Detener rojo con texto blanco. Typecheck, lint dirigido y pruebas de workbench y
ergonomía pasaron; el recorrido visual/humano sigue pendiente.

Los cinco cambios de barra y el ajuste de colores tienen commits separados; el
último funcional es `9e3d0b9` (`main`, publicado). DEV quedó actualizado con
`capibloques-editor-dev:9e3d0b9b7be4`; salud interna/pública `ok`, API y DB
saludables, planificador activo, admisión abierta (`pausa=0`) y cola vacía. La
VM mantiene 1,2 GiB libres, por debajo del objetivo de 2 GiB de la limpieza
Docker; no se tocaron imágenes activas ni volúmenes. Aceptación visual humana
pendiente.

### Pulido adicional de la barra del editor — 14 de octubre de 2026

Por autorización del propietario se implementaron ocho ajustes en commits
separados: catálogo más compacto (escala `0,58`, ancho fijo de 148 px), avatar
por encima del estado inferior, retiro de «Wemos» del encabezado, lápiz junto al
nombre del proyecto, Guardar y destino junto a ese nombre, etiquetas del
catálogo con el color de cada categoría, ocultamiento del catálogo en **Probar**
y restauración en **Crear**, y vuelta a **Crear** al detener la ejecución
(Pausa conserva la vista actual). Commits funcionales:
`688f6d0`, `1e023bd`, `c9ef77d`, `f6aa0d8`, `ac2fb2a`, `7f7f365`, `aeaa863` y
`90b2ea8`.

`git diff --check` pasó. No se ejecutaron pruebas ni se hizo despliegue remoto.
El DEV sigue en `9e3d0b9`; los ocho commits están en `main` local y falta
publicarlos. Cuando el propietario quiera desplegar, usar en `capi-dev`
`cd /home/capi/capibloques && ./scripts/update-dev.sh` (o
`scripts/deploy-dev.ps1` desde Windows). Aceptación visual posterior al
despliegue pendiente.

### Recuperación de aventuras sobre la rama del piloto visual — 14 de octubre

Se creó `codex/adventures-pilot-v2` desde `93561ab88f663205a96d14d0828ad08f39fbffa6`,
el último commit anterior a la eliminación. Se reaplicó el piloto visual de
`bfc0673` y los cuatro refinamientos locales, preservados en `92f04e4` y
reaplicados en `73e91b5`. Para que el PR exprese de forma explícita la
restauración, se integró `origin/main` y se creó el commit `646d730`, que revierte
`5731650`. El PR #1 se integró en `main` en `8b9be43`; el checkout y DEV
avanzaron después hasta `9e3d0b9`.

Las aventuras serializables y su selección/composición en «Armar escena» están
presentes en esta rama. `tsc --noEmit`, lint, `scripts/smoke.mjs`,
`scripts/scene-worlds.test.mjs`, `scripts/workbench.test.mjs` y `git diff --check`
pasaron. La smoke suite completa no pudo completarse: `frame-animation` e
`interpreter-source` necesitan `g++`, ausente en `capi-dev`; no se instaló
toolchain. No se ejecutó E2E. El orquestador despliega `origin/main`; esperar el
merge del PR #1 y checks antes de ejecutar DEV. Aceptación visual/humana
pendiente. En el head remoto `e98e0b8`, CI reportó Arduino con prototipos
generados antes de `OttoDevice`, dos avisos `-Werror=misleading-indentation` en
Waveshare y fallo de `idf-driver`: `g++` devolvió `status=null` compilando
`runtime`, y la prueba no registraba señal/stdout/stderr, así que el log no
permite distinguir la causa. Backend y scope pasaron. En el árbol de recuperación,
Arduino exporta un ZIP con `.ino` mínimo y `capibloques_program.h`; interfaz,
revisión docente y compilador servidor comparten este formato. Se corrigieron
sentencias de Waveshare y fixtures. El run 273 mostró fallos históricos de
`idf-driver`; el despliegue del 14 de octubre usó el modo DEV directo, que no
espera GitHub Actions. No se afirma que la CI completa del commit `9e3d0b9` haya
pasado. No hay Arduino CLI ni `g++` localmente.

### Piloto visual CapiBloques — login, favicon y encabezado (8 de octubre)

Implementado localmente con pattern de encastres en movimiento diagonal CSS en
la pantalla de cuenta, isotipo/wordmark bicolor, favicon de marca y un isotipo
pequeño junto a “Proyecto” en el encabezado cuando esa etiqueta es visible.
Respeta movimiento reducido, conserva el panel sólido y no cambia colores de
Blockly, estados o acciones del editor. Nunito Sans no se carga todavía. La
revisión visual inicial a 614 × 614 observó patrón/foco legibles; contraste
calculado pasa para texto principal, logo, botón y foco. `oxlint`, `tsc --noEmit`,
`vinext build`, XML de SVG y `git diff --check` pasaron. El entorno de revisión
devolvió 404 para `/api/auth/session/` y `/api/school/`, no permitió revisar el
formulario normal, logo institucional ni encabezado activo. Faltan viewports
desktop/móvil y emulación dinámica de movimiento reducido; aceptación completa
pendiente. No se ejecutaron pruebas E2E ni se desplegó DEV. Alcance y detalle:
[PILOTO_IDENTIDAD_VISUAL_UI.md](PILOTO_IDENTIDAD_VISUAL_UI.md). Recursos y
manual: [MANUAL_DE_MARCA_CAPIBLOQUES.md](MANUAL_DE_MARCA_CAPIBLOQUES.md).

## 1. Punto de entrada y autorización actual

### Mantenimiento de espacio DEV — 17 de octubre de 2026

Autorizado por el propietario: ampliar `/` con el espacio libre existente de
LVM y limpiar sólo elementos seguros, conservando el compilador y la compilación
incremental. Se confirmó hostname `capi-dev`, raíz ext4 y LV
`/dev/ubuntu-vg/ubuntu-lv`. `vgcfgbackup ubuntu-vg` guardó metadatos LVM
(no es un respaldo de datos) y `lvextend --resizefs --extents +100%FREE`
amplió ese LV de aproximadamente 31 a 62 GiB en línea, sin reiniciar.

Resultado medido: raíz de 61 GiB visibles, 28 GiB usados y 31 GiB disponibles
(49% de uso), frente a 450 MiB libres y 99% antes. Limpieza adicional:
377.032.704 bytes recuperados retirando exclusivamente la imagen anterior del
editor `50c2cad38513`, sin contenedores asociados, y paquetes descargados de
APT (`apt-get clean`). La imagen antigua sólo se recupera reconstruyéndola;
los paquetes se pueden descargar nuevamente. No se tocaron volúmenes,
PostgreSQL, respaldos, documentos, dependencias ni paquetes/runtimes de Codex.

Compilador `capibloques-compiler-dev:phase9` conservado con idéntico ID;
`outputs/interpreter-esp32` conservó 1.017 objetos y `outputs/interpreter-esp32s3`
1.071 objetos. Se conservó además la caché de construcción Docker (1,692 GB).
Los tres contenedores permanecieron saludables; la comprobación pública de
`/api/health/ready/` devolvió HTTP 200. No se desplegó código de aplicación ni
se cambió el script de limpieza existente; ese script todavía elimina la caché
Docker al finalizar actualizaciones, a diferencia de esta limpieza selectiva.

### Última entrega: fase 21 — ergonomía del editor (7 de octubre de 2026)

Software implementado por autorización «Vamos con la 21»: separación de grupos
al soltarlos, sin reordenar importaciones ni conexiones; grupos fuera del
programa con texto/borde/advertencia; comparadores con palabras y campos
diferenciados; título editable en tablet/móvil; saludo sin alias en cabecera;
colores españoles; mover inspector pendiente y Auto-conectar sobre el borrador
con Cancelar/Deshacer/Rehacer. Conexiones ofrece estados simulados opcionales
sobre Wemos/DIYmall y en tabla, nunca mediciones físicas. Detalle de todos los
pedidos, decisiones y pruebas: [FASE_21_ERGONOMIA_EDITOR.md](FASE_21_ERGONOMIA_EDITOR.md).

Tipos/estilo/smoke aprobados y 26 pruebas Chromium de editor/mesa/recuperación,
incluidas móvil 390×844/568×320, teclado, zoom, sólo lectura y texto ampliado.
Contratos específicos de fase 21 verificados en Chromium/Chrome/Edge.
Aceptación humana/docente/infantil/lector real y publicación DEV pendientes.
No hay migraciones ni cambios de firmware; mínimo intérprete sigue 1.9.0.
El propietario actualiza con el comando habitual --fast que aparece debajo.
No iniciar fase 22 ni operar DEV sin autorización.

### Modo invitado — ampliación USB autorizada el 14 de octubre de 2026

El login ofrece **Ingresar como invitado** y abre el editor sin sesión; un
espacio anónimo separado en IndexedDB conserva el proyecto entre
recargas/cierres. La ampliación autorizada permite abrir **Usar en placa**,
instalar el firmware intérprete publicado y enviar/ejecutar las reglas locales
por USB. No consulta sesión de cuenta ni envía el proyecto/reglas a la API.
Biblioteca de cuenta, desafíos, compilación específica, monitor Serial y
migración/oferta de guardado en cuenta siguen fuera de alcance. Typecheck y
oxlint dirigido pasaron; E2E invitado no pudo lanzar Chromium porque falta el
ejecutable local. No se instaló ni se probó placa física ni se desplegó DEV.
Detalle y pendientes: [MODO_INVITADO.md](MODO_INVITADO.md).

### Registro histórico de ajustes de escena y bloqueo DEV — octubre de 2026

El 8 de octubre se publicó en `main` el commit `5731650`, que retiraba las
aventuras prearmadas y simplificaba «Armar escena». La rama de recuperación
incluye ahora `646d730`, que revierte explícitamente ese retiro sobre
`origin/main`. El piloto visual sigue aplicado. El PR #1 está abierto; el merge
y el despliegue DEV quedan pendientes. No copiar claves ni contraseñas al
repositorio o al chat.
### Corrección de aceptación DEV — 6 de octubre de 2026

El propietario informó 230 pruebas backend con una falla: recibo vacío de baja
de cuenta devolvía 409 en vez de 400. Se restaura la validación de entrada antes
de verificar la firma: vacío/mal formado devuelve 400; recibo inválido, vencido
o de otro actor devuelve 409. Se mantiene respaldo obligatorio para proyectos
o progreso de desafíos. Prueba original fallida y 16 contratos locales pasan
con SQLite sintético (no prueban bloqueo PostgreSQL). El ensayo ampliado local
de baja no es concluyente: faltan cryptography y rutas en el URLConf reducido.
Suite completa PostgreSQL y actualización DEV pendientes del propietario.
Sin migraciones ni cambios de firmware; usar el comando habitual --fast.

### Última entrega: fase 19 — desafíos y herramientas pedagógicas (5 de octubre)

Autorizada por «Dale con todo» y entregada en software: 17 retos propios, paleta
por actividad, Según tipado y Mientras/Hasta que cooperativo, comprobador
multicaso en worker, pistas, avance personal y creador docente por curso con
borradores, historial undo/redo, versiones publicadas inmutables y asignación.
Guía exacta/evidencia/límites: [FASE_19_HERRAMIENTAS_PEDAGOGICAS.md](FASE_19_HERRAMIENTAS_PEDAGOGICAS.md#14-entrega-implementada-y-evidencia--5-de-octubre-de-2026).
Autoevaluación no equivale a nota. Casos reservados sólo llegan al docente y
se comprueban durante su revisión; no hay validador secreto servidor.

Runtime mínimo vigente **1.9.0**, con `switch` y `conditional-loop`; 1.8.0 debajo
describe la entrega anterior. Migraciones aditivas `accounts.0005` y
`courses.0002`, blobs exactos autorizados por el actualizador, respaldo antes
de migrar. Progreso incluido en baja/respaldo. Se conserva caché incremental.
Pruebas: 17 retos con alternativas/errores, smoke previo, 16 contratos backend
sintéticos SQLite, 3 recorridos Chromium, tipos/estilo, empaquetado, reanudación
y 10 casos del builder. Sin acceso remoto, sin SDK completo y sin hardware.
Quedan aceptación PostgreSQL/DEV, Edge/accesibilidad/docente/infantil. No marcar
esos ensayos como aprobados ni iniciar otra fase sin autorización.

Para actualizar DEV (lo opera el propietario):

```bash
cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast
```

Primera actualización aplica respaldo/migraciones y construye los binarios
1.9.0. Después se instala firmware en cada placa sólo si se usará el código
nuevo. El simulador y el catálogo no requieren una placa. No afirmar que DEV
está actualizado hasta confirmación operativa del propietario.

### Última mejora operativa: compilación incremental (5 de octubre)

El propietario autorizó corregir la recompilación completa del SDK en cada
actualización. Causa confirmada: `build-interpreter-firmware.sh` borraba sus
directorios antes/después. Ahora conserva dos cachés por target en `outputs`,
comparte SDK entre los S3 e invalida ante cambios de defaults/toolchain/rutas.
ccache persistente de 256 MB sólo si ya está disponible, sin reconstruir la
imagen para instalarlo. Bundle reutilizable validado también por `buildIdentity`.
Diez pruebas locales cubren caché y builder Bash con `idf.py` sintético, más
empaquetado/sintaxis y reanudación operativa. No hay medición ni despliegue remoto
de esta mejora; primera construcción sin objetos sigue siendo completa.
Guía: [COMPILACION_INCREMENTAL_INTERPRETE.md](COMPILACION_INCREMENTAL_INTERPRETE.md).
El propietario actualiza con el comando habitual que figura debajo. No iniciar
actualizaciones simultáneas ni modificar el checkout durante una construcción.

### Última entrega: animaciones por cuadros (fase 43, 5 de octubre)

El propietario autorizó crear animaciones con dibujos/imágenes. Implementado:
editor de secuencias (crear/duplicar/quitar/reordenar/dibujar/importar), cuatro
animaciones de hasta 16 cuadros, velocidad 40–2000 ms, bloque una/N/sin parar,
worker y Arduino/ESP-IDF/intérprete, JSON retrocompatible. Sólo matriz 32×8 y
dibujos gráficos monocromáticos 16×8; no LCD ni imágenes full-screen/color.
Runtime mínimo vigente **1.8.0** y capacidad `frame-animation`; las menciones
posteriores a 1.7.0 describen la entrega previa. Ver guía de fase 43.
Pruebas locales: smoke completo, tipos/lint, C++ playback/servicios generados
Arduino/nativo con warnings como errores y dos recorridos Chromium 16/32.
No se ejecutó compilación completa ESP-IDF ni prueba física de 1.8.0.
DEV no fue actualizado por el asistente: lo opera el propietario con:

```bash
cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast
```

Esta actualización reconstruye una vez el intérprete por el cambio de firmware;
después hace falta instalar 1.8.0 en la placa desde el asistente. No afirmar que
DEV o hardware estén probados hasta confirmación del propietario.

- Repositorio: [ncvicchi/capibloques](https://github.com/ncvicchi/capibloques). Rama de trabajo actual: `main`. Nuevas ramas, si hacen falta: prefijo `codex/`. Respetar el árbol existente, sin reset/force ni descartar cambios ajenos.
- El propietario autorizó y se implementaron en software las fases **17, 18, 35, 38, 39, 40 y 41**. Las fases de hardware conservan aceptación física pendiente; no convertir esa ausencia de módulos en una prueba aprobada.
- **Fases 11–17, 19–20, 27–33 y 35–41 entregadas en software; fases 18, 23, 34 y 45 en curso.** La fase 45 ya tiene fondos/aventuras y una segunda entrega con selección múltiple, alineación/distribución, grilla configurable, guías magnéticas, orden visual persistente, cajas/anclas, avisos de solapamiento y el mismo orden/anclas en Waveshare. Le faltan capturas de referencia, mediciones y aceptación física. Las entregas que involucran hardware conservan sus aceptaciones físicas explícitas.
- Fase 10: software entregado, **aceptación física pendiente**. El propietario no tiene Wemos disponible; no dar por probada la placa ni conectar/programar otro puerto como sustituto.
- Producción es **Fase final, postergada**, no «fase 11». Los documentos históricos con letras son evidencias antiguas, no fases nuevas ni puntos para pedir OK.
- Este contexto no transfiere automáticamente credenciales, chats, sesiones ni permisos. Otra cuenta debe tener su propio acceso verificado y la solicitud del propietario antes de operar.

Orden de lectura: [AGENTS](../AGENTS.md) → este documento → [plan de fases pendientes](PLAN_FASES_BACKLOG.md) → [backlog](BACKLOG.md) → guía específica de la fase. El [plan principal](PLAN_MULTIUSUARIO_PROXMOX.md) conserva arquitectura y criterios transversales. Las guías antiguas describen su fecha, no necesariamente la operación vigente.

## 2. Producto y decisiones que no se deben perder

CapiBloques enseña programación visual a chicos de **8–12 años**. Se arma una escena con dispositivos, se programan bloques inspirados en Scratch, se simula el comportamiento en el navegador y se ejecuta autónomamente en una placa. No emula el ESP32 instrucción por instrucción.

- Una institución por instalación. Logo/nombre del colegio visibles antes del login. Cuentas creadas por administrador; alias y contraseña, sin correo obligatorio ni registro público. Roles administrador, docente y alumno. El modo invitado abre el editor con guardado local anónimo; en su primera entrega no habilita proyectos de cuenta, desafíos, compilación ni placa.
- Proyectos personales con biblioteca, guardar/autoguardar, recuperación local, JSON portable, papelera e historial. Compartir con un curso es explícito. El docente revisa versiones guardadas y comenta sin editar el original; ser administrador no abre por sí solo trabajos privados ajenos.
- Escenas componibles: por ejemplo dos semáforos o semáforo y robot. LEDs/PWM, motores mediante driver, servos, buzzers activo/pasivo, botón, sensores, Wi-Fi y pantalla de mensajes. Potencia/velocidad son conceptos visibles para los chicos, no configuración técnica PWM obligatoria.
- Un único «al comenzar» obligatorio, fuera del catálogo; concurrencia mediante «al mismo tiempo». Favoritos por cuenta, avatares divertidos y ejecución normal/guiada sin alterar el algoritmo.
- **Una pantalla por proyecto.** LCD PCF8574 16×2/20×4, OLED SSD1306 I2C y TFT SPI ILI9341/ILI9488, con zonas de texto cuando corresponde. Consola/Serial y pantalla son destinos independientes.
- Conservar **Arduino y ESP-IDF nativo**, ambos. No introducir Arduino ocultamente en IDF. Fuentes y firmware son exportaciones diferentes; el JSON es el proyecto editable.
- El compilador del servidor sólo acepta proyectos de bloques validados, no C/C++/CMake arbitrario. Recursos limitados; concurrencia administrativa con techo operativo DEV **1**, sin aumentarlo por suposición.
- Wi-Fi: el propietario autorizó enviar SSID/clave para compilación privada temporal. Nunca entran en JSON/historial/Git/logs; el binario sí contiene la clave y debe seguir siendo privado. No prometer borrado forense de backups/RAM/flash.
- USB está conectado a la **PC del navegador**, no al servidor. Chrome/Edge, localhost/HTTPS, elección y confirmación explícitas. Monitor real sólo lectura; distinto de consola simulada. El control remoto/telemetría entre placas de fase 34 está planificado pero no implementado: será mediante servicios publicados, nunca GPIO/código arbitrario. OTA continúa fuera del alcance.
- Placas implementadas en software: Wemos D1 R32, DIYmall ESP32-S3-DevKitC V1.0 N16R8 y, desde fase 17, Waveshare ESP32-S3-Touch-LCD-5 **SKU 28117, 800 × 480**. Esta última conserva aceptación física pendiente; no extrapolar a 5B/5C ni a otra revisión.

## 3. Evidencia y versiones

### Pulido visual complementario de fase 42 — 5 de octubre de 2026

- Se agrandaron y renombraron las acciones de avatar; los dos bloques Wi-Fi expresan «segundos» completo; el catálogo conserva la escala 0,9 al cambiar el zoom del programa; la papelera se colorea en rojo al recibir un bloque arrastrado.
- Lint dirigido de los componentes modificados, pruebas smoke y `scripts/wifi-messages.test.mjs` correctos. `git diff --check` correcto. El `tsc` del runtime disponible no pudo certificar el proyecto: reportó múltiples `@ts-expect-error` preexistentes como no utilizados, incluso con imports `.ts` habilitados.
- No desplegado en DEV; versión remota sin verificar/cambiar. La aceptación visual y de uso de fase 42 sigue pendiente. Evidencia y límites en [FASE_42_SIMPLIFICACION_UI.md](FASE_42_SIMPLIFICACION_UI.md).

### Corte histórico al iniciar el traspaso

| Evidencia | Estado y fecha |
| --- | --- |
| Código funcional anterior | `c1e469b`: límite UTF-8 del monitor Serial, verificado con pruebas dirigidas. |
| Documentación de cierre USB | `a289136`: entrega software fase 10; prueba física abierta. |
| Checkout local al iniciar fase 11 | `1c66362`, `main`, árbol limpio; incluye planificación y pedidos 1–10 del backlog. |
| DEV consultado por SSH, 8 septiembre | Host `capi-dev`, checkout limpio en `a289136`; editor/API/DB saludables, compilador `active`. Los commits posteriores de planificación todavía no estaban desplegados. |
| Recursos observados en esa consulta | 1967 MiB RAM, 2047 MiB swap, unos 10 GiB libres en filesystem de 31 GiB. Muestra puntual, no capacidad de un aula ni pico de consumo. |
| PRD | No se consultó durante este traspaso. Última evidencia de preparación en fase 0; no afirmar estado remoto actual. No desplegar allí. |
| CI general anterior | [34189286101](https://github.com/ncvicchi/capibloques/actions/runs/34189286101), commit `8dd4676`: cuatro jobs correctos según registro de fase 10. No atribuirlo al cambio posterior `c1e469b`. |

El estado remoto puede cambiar. Revalidar identidad, commit y salud antes de operar. Los hashes de arriba son un corte histórico, no una orden de volver atrás. Usar `git log` para encontrar entregas posteriores y actualizar esta sección al cerrarlas.

### Entrega de fases 11 y 12 — 8 de septiembre de 2026

| Evidencia | Resultado |
| --- | --- |
| Fase 11 inicial | `14c4dcc`: contexto, reglas y planes publicados. Clone limpio desde GitHub y 55 destinos de enlaces locales del contexto comprobados; no depende del chat ni transfiere credenciales. |
| Código de fase 12 | Implementación desde `6143bbe`, corregida y verificada hasta **`668be43`**. Mesa de trabajo, cámara, Wemos, sesiones y correcciones de Deshacer/Exportar/botones/scroll móvil. Secuencia y evidencia en la [guía de entrega](FASE_12_MESA_DE_TRABAJO.md). |
| DEV verificado al cierre | `capi-dev`, checkout limpio en `668be43832c99b23f09295f8356d44d1c495503b`. Editor/API/DB saludables y planificador `active`; salud VM/túnel `ok`. Sólo editor reiniciado; API/base/compilador no recreados, concurrencia 1. |
| Tipos, lint, unidad y build | Correctos sobre `668be43` en CI; siete grupos smoke, drivers, USB, aislamiento y 10 páginas estáticas verificadas. Permanece aviso de chunks grandes, no error de build. `npm audit`: cero vulnerabilidades conocidas tras parche acotado sharp 0.35.4. |
| Altura útil comparable | 54,9 % → 80,6 % a 1366 × 768; capturas y método en la guía. No confundir esta proporción de pantalla con avance del proyecto. |
| Navegadores | **124/124 Chrome/Edge sobre `63c96b2`**, más **46/46 sobre `668be43`**, sin reintentos. Acceso/autoguardado, mesa de trabajo, móvil/fuentes/scroll, programación, compilación/Wi-Fi, revisión docente y salida. Fixtures UI sintéticos, salud sin interceptar y backend separado; no es aceptación física. Historial de pruebas en la guía de entrega. |
| CI final | [34291829169](https://github.com/ncvicchi/capibloques/actions/runs/34291829169), commit `668be43`: cuatro jobs correctos. 174 pruebas Chromium más dos regresiones rápidas, 179 backend/persistencia, siete Arduino y siete ESP-IDF. Reporte sin flaky. |
| Documentación y entornos | Los commits de documentación posteriores no cambian la versión funcional DEV. PRD/gateway/Proxmox/router/Nginx sin cambios; Pages/Sites sin publicación. |

Este corte sustituye al histórico para continuar, sin borrar su trazabilidad. Consultar nuevamente estado remoto si se retoma en otra fecha. El mantenimiento del contexto acompaña cada fase futura autorizada.

### Entrega de fase 13 — 12 de septiembre de 2026

| Evidencia | Resultado |
| --- | --- |
| Código y runtime | `f1944f3`, correcciones operativas `c49f13f` y `1ee0df9`; editor estático Nginx no-root, proxy seguro, firewall y systemd. |
| DEV | `capi-dev` limpio en `2597284` (runtime funcional `1ee0df9`); editor/API/DB saludables, compilador activo, túnel `localhost:3000` conservado y listener LAN `3080` limitado al edge. Reinicio completo verificado. |
| Público | `https://capibloques.dev.nvicchi.com/` y `/api/health/ready/` HTTP 200; certificado válido hasta 2026-12-11 y ensayo de renovación correcto. Producción continúa sin vhost/certificado CapiBloques. |
| Pruebas | 197 backend PostgreSQL, 8 contratos, build de 10 páginas y 18/18 Chrome/Edge externos. PRD no pudo acceder directamente al puerto 3080. |
| Acceso DEV | Login de CapiBloques sin segunda Basic Auth, decisión documentada; datos sintéticos, rate-limit, cookies Secure, allowlists y proxy confiable acotados. El 12 de septiembre se verificó el ingreso real por HTTPS de la cuenta `administrador` después de restablecer su clave; la clave no se documenta ni se transfiere. |

La fase 15 fue implementada en software y su [guía](FASE_15_MENSAJES.md) registra el contrato. La matriz de fase 23 también está implementada en software; ambas conservan aceptación física pendiente. No iniciar 16–22, 24–26, completar el resto de 23 ni avanzar a la Fase final por inferencia.

Validación documental de cierre: **130 destinos locales en ocho documentos**, sin archivos faltantes ni diferencias de mayúsculas/minúsculas; las anclas operativas del túnel y compilador también se contrastaron. Los únicos recursos gráficos publicados son las dos capturas de fixtures sintéticos enlazadas desde la guía.

Al terminar esta entrega se cerró la sesión SSH administrativa y finalizaron las pruebas locales. Se conserva el túnel habitual para navegar DEV; apagar la PC sólo corta ese acceso local, no detiene los servicios de la VM. Los archivos de diagnóstico quedan ignorados en `work/`/`test-results/`; no son parte necesaria del traspaso ni deben publicarse indiscriminadamente.

### Corrección documental — 12 de septiembre de 2026

Autorización del propietario: **«Corregi la documentacion, luego dame una lista de las fases pendiente»**. Se corrigen el estado de fase 13, la disponibilidad de USB y las recetas de operación anteriores al runtime público. La [operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) se contrasta con el código del runtime; las guías antiguas conservan su evidencia histórica y remiten a ella.

Esta entrega sólo cambia documentación. El punto de partida local es `a74b427`, rama `main`, árbol limpio; el commit de corrección queda identificado en Git. La validación documental abarca diff y coherencia, más **189 enlaces locales y 37 anclas en 28 documentos**, con comprobación de nombres exactos y repetición desde un checkout limpio antes de publicar. No se repiten pruebas de aplicación ni consultas a las VMs: el último registro remoto sigue siendo `2597284`, runtime funcional `1ee0df9`, observado al cierre de fase 13. No corresponde desplegar por estos cambios.

En ese corte documental del 12 de septiembre seguían pendientes la aceptación física de fase 10 y las fases 14–18; la entrega posterior de fase 14 se registra debajo. El script de pruebas backend conserva una limitación operativa: `--restart` no carga la configuración pública; su uso directo queda excluido de la receta DEV vigente, sin afirmar que el script se haya corregido.

### Entrega de fase 14 — 13 de septiembre de 2026

| Evidencia | Resultado |
| --- | --- |
| Código y recursos | Funcional `897c6e0`; documentación y conceptos de avatar incorporados hasta `c681af2`. El detalle funcional está en la [guía de fase 14](FASE_14_EJECUCION_VISUAL.md). |
| Comportamiento | «Al mismo tiempo» presenta caminos verticales; la ejecución conserva la cámara de Blockly y muestra progreso independiente en el bloque y el dispositivo. El estado visual no entra al JSON, autoguardado, historial ni firmware. |
| Pruebas locales | Typecheck, lint, smoke y build correctos. Playwright afectado 4/4 en Chrome/Edge; la corrida Chromium completa detectó una lectura anticipada de pausa, se estabilizó la espera y el caso pasó. |
| CI | [34735466824](https://github.com/ncvicchi/capibloques/actions/runs/34735466824), commit `c681af2`: cuatro jobs correctos, incluidos backend, firmware y ESP-IDF. |
| DEV desplegado | `capi-dev` actualizado por avance rápido a `c681af2c527b90eeb602f37f3a289235dc6e3317`; editor `capibloques-editor-dev:c681af2c527b`, API y DB saludables. API/base no fueron recreados. |
| Verificación posterior | Salud local y pública `ok`; Compose/firewall válidos; 4/4 Playwright externo Chrome/Edge. Admisión restaurada con cero trabajos activos y planificador `active`. |
| Límites operativos | No se modificaron PRD, gateway, Proxmox, router ni Nginx. La Fase 14 no demuestra funcionamiento físico ni agrega seguimiento del firmware. |

Los recursos 2D de avatar se conservaron en versiones [detalladas](../public/avatars/full-body/README.md) y [simples](../public/avatars/full-body-simple/README.md). Son conceptos de cuerpo completo para una futura adaptación a impresión 3D; no son STL ni quedaron integrados como animaciones. Las reacciones de avatar siguen como pedido separado del backlog.

### Corrección de la barra del catálogo — 13 de septiembre de 2026

El propietario autorizó «corrijamo la barra residual del catalogo». La revisión funcional `d096fd9` oculta la barra propia de Blockly junto con el catálogo y conserva las barras del programa. La regresión cubre botón, Escape, arrastre, categorías cortas y largas, escritorio de altura limitada y móvil; pasó en Chrome y Edge localmente y 2/2 contra DEV público. Typecheck, lint, smoke y build fueron correctos. El CI completo [34737668650](https://github.com/ncvicchi/capibloques/actions/runs/34737668650) pasó sus cuatro trabajos, incluidos backend, firmware, ESP-IDF y runtime público.

`capi-dev` avanzó de `c681af2` a `d096fd9f5410bd35ee880cbc94870ee7d9c12aa2` mediante `capibloques-dev-runtime deploy`; el editor `capibloques-editor-dev:d096fd9f5410`, API y PostgreSQL quedaron saludables sin recrear API/base. Las comprobaciones local y pública respondieron `ok`, Compose/firewall fueron válidos y la admisión se restauró con `paused=False`, cero trabajos activos y planificador `active`. No se modificaron PRD, gateway, Proxmox, router ni Nginx. Esta entrega es mantenimiento posterior a la Fase 14: no altera la numeración ni autoriza la Fase 15.

### Corrección del arrastre individual y grupal — 13 de septiembre de 2026

El propietario decidió invertir el gesto de Blockly: arrastrar sin modificadores mueve sólo el bloque señalado y recompone la cadena; `Control` + arrastre mueve también los bloques siguientes, con `Comando` como equivalente en macOS. La revisión funcional `d818093` implementó el comportamiento, la ayuda accesible y Deshacer; `0fc9ff2` difirió la instalación de la estrategia durante el arrastre para conservar la creación desde el catálogo.

La regresión construye tres bloques, comprueba ambas estructuras y restaura cada una con Deshacer. Pasó localmente en Chromium y en Chrome/Edge junto con el caso de arrastre desde el catálogo; también pasaron typecheck, lint, smoke, build y el archivo completo de experiencia de programación. El CI completo [34740573404](https://github.com/ncvicchi/capibloques/actions/runs/34740573404) pasó interfaz, runtime público, backend, firmware Arduino y los siete proyectos ESP-IDF.

`capi-dev` avanzó de `d096fd9` a `0fc9ff2d2eee681a14cc22e276db371e34712e03` mediante `capibloques-dev-runtime deploy`. El editor `capibloques-editor-dev:0fc9ff2d2eee`, API y PostgreSQL quedaron saludables sin recrear API/base; salud local y pública, Compose y firewall fueron válidos. La admisión volvió a `paused=False` con cero trabajos activos y el planificador quedó `active`. Los dos recorridos afectados pasaron **4/4** sobre DEV público en Chrome/Edge. No se modificaron PRD, gateway, Proxmox, router ni Nginx; la Fase 15 sigue sin autorización.

### Corrección del guardado durante el arrastre — 15 de septiembre de 2026

El error «Una conexión del bloque … apunta a un bloque vacío» se reprodujo manteniendo un bloque sobre un punto de inserción más allá de los temporizadores de cambio y autoguardado. Blockly serializaba su marcador transitorio como `block: null`; el estado inválido alcanzaba el guardado local y podía desmontar React. La revisión `2b97af9` conserva la última instantánea estable durante el gesto y publica el resultado al soltar, sin aceptar conexiones vacías en archivos importados.

Pasaron typecheck, lint, smoke, build, 6/6 del archivo de experiencia en Chromium y la regresión específica en Chromium/Chrome/Edge. El CI completo [34974885825](https://github.com/ncvicchi/capibloques/actions/runs/34974885825) pasó backend, interfaz/runtime, Arduino y ESP-IDF. `capi-dev` avanzó de `0fc9ff2` a `2b97af95051e47566167bcbfb2117757d37a192b`; editor, API y PostgreSQL quedaron saludables, Compose/firewall válidos y salud local/pública `ok`. La admisión se restauró con `paused=False`, cero trabajos activos y planificador `active`; el caso pasó 2/2 sobre DEV público en Chrome/Edge. API/base no fueron recreados y no se modificaron PRD, gateway, Proxmox, router ni Nginx.

### Fase 15 — Mensajes — 19 de septiembre de 2026

Los commits funcionales `036fe61` y `b2ebd05` incorporan el componente **Mensajes**, sus modos Enviar/Recibir/Ambos, lista predefinida, velocidad y pines configurados en escena, bloques de envío y recepción condicional cooperativa, simulación por botones y trama protegida común a Arduino/ESP-IDF. Los ejemplos Robot y Semáforo por mensajes están incluidos. El contrato y los límites se conservan en [FASE_15_MENSAJES.md](FASE_15_MENSAJES.md).

El CI completo [35444477812](https://github.com/ncvicchi/capibloques/actions/runs/35444477812) pasó interfaz/runtime, 200 pruebas de backend, Wemos Arduino 3.3.11 con los cinco perfiles de pantalla y siete proyectos ESP-IDF 5.5. DEV avanzó a `b2ebd05bf91f9a8e94267155c21da5f532b9f99c`; editor, API y PostgreSQL quedaron saludables, Compose/firewall válidos y salud pública `ok`. La admisión se restauró con `paused=False`, concurrencia 1 y cola vacía; la prueba específica pasó **4/4** en Chrome/Edge contra DEV público. No se modificaron PRD, gateway, Proxmox, router ni Nginx. La prueba eléctrica con Wemos sigue pendiente y no se confunde con compilación.

### Consolidación de Pantalla de texto — 19 de septiembre de 2026

Al retomar el componente LCD se comprobó que los perfiles PCF8574 16 × 2 y 20 × 4 ya estaban implementados junto con OLED/TFT. El commit `2c1f564` corrige el nombre visible de **Pantalla de mensajes** a **Pantalla de texto**, sin cambiar el tipo JSON `display` ni duplicar el componente. Typecheck, lint, smoke, driver C++, build, **12/12 pruebas de pantalla** y **4/4 de matriz** pasaron localmente en Chrome/Edge. El [CI completo 35451594869](https://github.com/ncvicchi/capibloques/actions/runs/35451594869) finalizó correctamente.

DEV avanzó por fast-forward desde `fa9ec15` hasta `2c1f56455ea33d87df3ebe4324cf4b1a4d214a7c`; la imagen declara la misma revisión. Runtime, Compose, firewall y salud local/pública quedaron correctos, y la suite afectada pasó nuevamente **12/12** contra `https://capibloques.dev.nvicchi.com/` en Chrome y Edge. El planificador quedó `active`, admisión `paused=False`, concurrencia/techo 1 y cola vacía, revisión administrativa 20. API y base no fueron recreadas; no se modificaron PRD, gateway, Proxmox, router ni Nginx. La aceptación física de LCD/OLED/TFT continúa pendiente.

### Dibujos y animaciones de Pantalla de texto — 19 de septiembre de 2026

El commit funcional `5158e1f` amplió el mismo componente `display`, sin crear otro dispositivo: LCD anima texto; OLED/TFT también muestran figuras predeterminadas o hasta 12 dibujos propios de 16 × 8. La escena conserva la velocidad y los dibujos; los bloques eligen efecto y contenido. Simulador, Arduino y ESP-IDF usan avance cooperativo y el backend acepta tanto JSON histórico como el contrato ampliado. Figuras incluidas: corazón, estrella, sonrisa, capibara, robot, gato y flor.

La semántica posterior es no bloqueante también dentro del mismo camino: texto, dibujos y Matriz LED arrancan en segundo plano y continúan con el bloque siguiente. Cada animación permite una vez, 2–100 repeticiones o `sin parar`. `Esperar a que termine [pantalla]` sincroniza explícitamente; escribir, borrar, mostrar otra figura o iniciar otra animación cancela la vigente. Una espera combinada con `sin parar` produce una advertencia, porque necesita que otro camino la reemplace. El contrato histórico sin campos de repetición se interpreta como una sola vez.

El [CI completo 35471186348](https://github.com/ncvicchi/capibloques/actions/runs/35471186348) pasó sus cuatro trabajos: 204 pruebas backend, 182 de interfaz Chromium, los cinco perfiles Arduino y ocho proyectos ESP-IDF. DEV avanzó a `5158e1f84f6bd7a16c2036e049e3034103bbbf8f`; imagen y checkout coinciden, 204 pruebas backend y el recorrido nuevo **2/2** en Chrome/Edge pasaron, salud interna/pública quedó `ok`, planificador activo, admisión `paused=False`, concurrencia/techo 1 y cola vacía (revisión 22). No se modificaron PRD, gateway, Proxmox, router ni Nginx. No declarar prueba física.

### Fase 23 en curso — Matriz LED — 19 de septiembre de 2026

El commit funcional `fa9ec15` incorpora una unidad **Matriz LED** 32 × 8 de cuatro MAX7219: configuración de brillo/orden/giro, editor de hasta 12 dibujos, cuatro bloques, simulación cooperativa, ejemplo Cartel luminoso, cableado y generación común para Arduino/ESP-IDF. El alcance y lo que sigue abierto están en [FASE_23_MATRIZ_LED.md](FASE_23_MATRIZ_LED.md); no se declara terminada toda la fase 23.

El CI completo [35449365576](https://github.com/ncvicchi/capibloques/actions/runs/35449365576) pasó sus cuatro trabajos, incluida la compilación nativa de ocho proyectos Arduino y ocho ESP-IDF. En DEV pasaron 202 pruebas Django y el recorrido específico **4/4** en Chrome/Edge. `capi-dev` avanzó a `fa9ec1534571e7afc194ecda5e28dc827cb237b8`; editor `capibloques-editor-dev:fa9ec1534571`, API y PostgreSQL quedaron saludables, Compose/firewall válidos y salud interna/pública `ok`. La admisión quedó `paused=False`, concurrencia/techo 1, cola vacía y planificador activo. No se modificaron PRD, gateway, Proxmox, router ni Nginx. Falta probar la matriz física y los displays LCD/OLED/TFT.

La exclusividad Matriz LED/Pantalla de texto es deliberada. Tras una observación de UX, el catálogo pasó a explicar en un aviso visible qué salida visual existente bloquea las tarjetas grises, cómo reemplazarla y a mostrar el motivo dentro de cada tarjeta; no se amplió la cantidad permitida.

La escena también expone un tachito en la cabecera para el objeto seleccionado. `Supr/Delete` o `Backspace`, fuera de campos de texto, abren la misma confirmación. Quitar sigue siendo reversible desde deshacer y deja los bloques huérfanos visibles para elegir otro destino; no los elimina a escondidas.

Esta mejora quedó en `7afdf2a` y su ajuste E2E en `94f2112`. La CI completa 35473606856 pasó los cuatro trabajos. DEV fue desplegado en `94f21129f577ddc64fd55f0ff1fac3920a895f7d`, con salud interna/pública correcta y E2E específico **8/8** en Chrome/Edge públicos. El compilador quedó activo, admisión abierta en revisión 24 y cola vacía.

El 20 de septiembre de 2026 se confirmó el hardware disponible para continuar la aceptación: LCD Keypad Shield 16 × 2 paralelo con cinco botones por ADC, LCD 20 × 4 con mochila I2C, TFT ILI9341 SPI y matriz 32 × 8 con cuatro MAX7219. El Keypad Shield necesita un perfil combinado nuevo —pantalla más cinco botones lógicos— y no corresponde al `lcd1602` I2C vigente. El propietario confirmó que la pantalla 16 × 2 y sus botones funcionan correctamente; queda integrarlos y probar el firmware de CapiBloques. El orden acordado está en [FASE_23_MATRIZ_LED.md](FASE_23_MATRIZ_LED.md).

La prueba física de la matriz del 23 de septiembre mostró los cuatro módulos en orden inverso respecto de la simulación: 4‑3‑2‑1. El hardware disponible recibe DIN por el extremo derecho visto de frente. El perfil pasa a usar ese montaje como predeterminado y el selector nombra explícitamente el lado de DIN; proyectos de matriz ya guardados deben elegir una vez «DIN junto al módulo derecho». Falta recompilar/grabar y confirmar físicamente 1‑2‑3‑4 antes de cerrar la aceptación.

### Animaciones no bloqueantes y despliegue reanudable — 19 de septiembre de 2026

La implementación funcional de animaciones cooperativas quedó en `6999242` y el ajuste de prueba en `08b67e3`. Texto, dibujos y desplazamiento de Matriz LED continúan en segundo plano; cada bloque permite una vez, N veces o sin parar, y el bloque `esperar a que termine` es la sincronización explícita. La CI completa [35476496407](https://github.com/ncvicchi/capibloques/actions/runs/35476496407) pasó backend, interfaz/runtime, ocho Arduino y ocho ESP-IDF. La aceptación física continúa pendiente.

Una corrección posterior de robustez limita el texto desplazable desde el propio campo: el bloque muestra `N/32`, señala cuándo llegó al máximo y no conserva caracteres adicionales. El compilador vuelve a acotarlo como defensa. Esto evita que un proyecto con más de 32 caracteres sea rechazado por el simulador después de que la interfaz anunciara engañosamente que había comenzado. La regresión importa deliberadamente un proyecto excedido y comprueba recorte, indicador y ejecución.

Un corte eléctrico ocurrió antes de autenticar la ventana de despliegue: no se había pausado, actualizado ni detenido DEV, cuyo último estado observado seguía en `94f2112`, saludable, admisión abierta en revisión 24 y planificador activo. No afirmar un despliegue posterior sin volver a auditarlo al encender.

Para evitar operación manual repetitiva se agregaron `scripts/update-dev.sh`, `scripts/deploy-dev.ps1` y el orquestador remoto reanudable. El modo normal `--fast` actualiza directamente el ambiente de prueba sin consultar ni esperar GitHub Actions; `--full` es optativo y dispara mediante una etiqueta Git temporal la CI completa de backend, web/E2E, Arduino y ESP-IDF para el mismo commit antes de actualizar. La etiqueta se elimina al terminar. Luego el proceso pausa de forma auditada, elige API automáticamente cuando corresponde, prueba, valida y restaura el estado previo. Toda salida termina con un banner inequívoco de actualización completada o fallida. Si el checkout aún contiene un actualizador antiguo, se inicia una vez con `git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast`; después vuelve a servir `./scripts/update-dev.sh --fast`. La actualización acumulada desde `f772026` reconoce específicamente la migración aditiva `compiler.0002` y la nueva receta Wemos/S3: respalda PostgreSQL, reconstruye el compilador, migra y registra su imagen; cualquier otra migración o infraestructura continúa bloqueada y se enumera. Un marcador privado permite repetir la misma orden después de un corte. La guía y límites están en [FASE_13_ACCESO_EXTERNO_DEV.md](FASE_13_ACCESO_EXTERNO_DEV.md).

Se corrigió además una alteración recurrente de permisos: el runtime ejecutado
como `root` consultaba Git directamente y `git status` podía refrescar
`.git/index` con propietario `root`. Runtime e instalador ahora ejecutan toda
consulta Git como `capi`; el actualizador repara sólo `.git` al arrancar si
encuentra residuos antiguos, conserva su propietario al salir e instala de
forma explícita la copia corregida del runtime. Para arrancar desde un checkout
que todavía tiene el índice dañado hay que anteponer una única reparación de
`.git` antes del `git fetch`, según la receta vigente de fase 13.

El 21 de septiembre se comprobó que el checkout podía quedar avanzado mientras
el contenedor web continuaba en una imagen anterior. El cierre del orquestador
ahora exige que la imagen activa y su etiqueta OCI coincidan con el commit
objetivo; sin esa evidencia informa fallo y conserva el mantenimiento
reanudable. Esta corrección no convierte el intento incompleto observado en un
despliegue exitoso: DEV debe completar nuevamente el comando normal.

El diagnóstico posterior encontró la causa del falso positivo: el orquestador
raíz se entregaba a Bash por entrada estándar y el `compose exec` usado para el
respaldo podía consumir el resto del script. El hijo terminaba entonces con
código cero justo después del backup. El actualizador ahora escribe el objeto
Git exacto en un archivo privado temporal, lo ejecuta por nombre y lo retira al
salir; `pg_dump` recibe además `/dev/null`. Así, ninguna herramienta hija puede
truncar el programa que la está coordinando.

La allowlist de mantenimiento distingue además
`ops/public-dev/test_contracts.py`: ese archivo sólo se ejecuta localmente o en
CI y no se instala en la VM, por lo que no exige reinstalar el runtime público.
Los demás cambios bajo `ops/public-dev/` continúan bloqueados hasta contar con
un procedimiento de mantenimiento explícito.

La escena representa ahora los cinco perfiles Otto y, cuando existe boca LED,
muestra la expresión activa de la simulación. Guardar escena mantiene sus
validaciones, pero un rechazo se explica junto al botón y selecciona el objeto
relacionado. Las regresiones cubren alta y guardado, perfil visual, cambio de
cara y rechazo explicado.

El propietario ejecutó la primera actualización mediante `deploy-dev.ps1 -DirectLan` y no informó errores; según el acuerdo operativo vigente, se registra DEV actualizado a `f772026f711782d0c3cd04401d3974ddcba0ea64`. Su [CI completa 35477573114](https://github.com/ncvicchi/capibloques/actions/runs/35477573114) terminó correcta. Esta confirmación procede del operador, no de una nueva inspección remota del asistente. Desde ahora el asistente implementa, prueba, commitea y pushea, pero entrega la orden de despliegue para que la ejecute el propietario; si éste no informa un problema, se considera exitosa. La orden normal dentro de DEV es `cd /home/capi/capibloques && ./scripts/update-dev.sh`.

### Fase 16 — DIYmall ESP32-S3 N16R8 — 19 de septiembre de 2026

La placa conectada se inspeccionó sin escribir: ESP32-S3 revisión 0.2, flash Quad 16 MiB, PSRAM Octal 8 MiB, cristal 40 MHz y puente USB-UART CP210x. El recorrido de software se documenta en [FASE_16_ESP32_S3_DEVKIT.md](FASE_16_ESP32_S3_DEVKIT.md): target JSON cerrado, selector transaccional de placa, pines/capacidades, ilustración propia, Arduino/ESP-IDF, cola/caché/manifiesto y USB ligados al perfil exacto. GPIO35–37 quedan fuera por la PSRAM Octal. Wemos mantiene su JSON y comportamiento histórico.

Las pruebas locales de tipos, lint, smoke/modelo S3, ZIP IDF, USB e aislamiento de compilador pasan; CI compila además un semáforo S3 real con ambas toolchains. Registrar aquí hash y ejecución CI después del push. No se grabó la placa: faltan autorización y ensayo físico de arranque, consola, PWM y TX/RX; no declarar certificación de hardware.

### Inventario para fase 17 — Waveshare de 5 pulgadas — 19 de septiembre de 2026

El propietario identificó la segunda unidad con la [página oficial](https://docs.waveshare.com/ESP32-S3-Touch-LCD-5): **Waveshare ESP32-S3-Touch-LCD-5, SKU 28117**. Es un ESP32-S3-WROOM-1-N16R8 con panel RGB de 5 pulgadas, táctil capacitivo GT911 por I2C y expansor CH422G. La consulta física de `COM12` mediante USB nativo, sin escritura, confirmó ESP32-S3 rev. 0.2, flash Quad 16 MiB, PSRAM 8 MiB, 3,3 V y cristal de 40 MHz. No registrar identificadores únicos del chip.

La fase 17 quedó implementada exclusivamente para la unidad identificada como SKU 28117, 800 × 480, y documentada en [FASE_17_WAVESHARE_5.md](FASE_17_WAVESHARE_5.md). Fase 18 agregó un tablero lógico base y fue reabierta para representar la misma escena, ejecutando físicamente los componentes con interfaz compatible y simulando el resto en pantalla; ver [FASE_18_CONTROLES_LOCALES.md](FASE_18_CONTROLES_LOCALES.md). Ambas conservan aceptación física pendiente.

## 4. Arquitectura y mapa de archivos

| Área | Punto de entrada y responsabilidad |
| --- | --- |
| Rutas y UI | [app](../app), [capiblocks-app](../components/capiblocks-app.tsx), estilos [globals.css](../app/globals.css). React, Vinext/Vite y componentes Base UI existentes; conservar lockfile. |
| Identidad del editor | [editor-access](../components/editor-access.tsx), [account-session](../lib/account-session.ts), [session-polling](../lib/session-polling.ts), [accounts](../backend/accounts). Sesión/CSRF y borrador ligado a UUID, no al alias; reloj periódico sin consultas por foco. |
| Escena | [scene-model](../lib/scene-model.ts), [scene-builder](../components/scene-builder.tsx), [scene-stage](../components/scene-stage.tsx). Modelo lógico, edición pendiente separada y vista/simulación. Cámara transitoria en [scene-viewport](../components/scene-viewport.tsx) y [scene-camera](../lib/scene-camera.ts). |
| Bloques y generación | [blockly-workspace](../components/blockly-workspace.tsx), [blockly-engine](../lib/blockly-engine.ts), [capiblocks](../lib/capiblocks.ts). Workspace → programa/grafo → simulador y generadores. |
| Simulación | [simulator.worker](../lib/simulator.worker.ts), [execution-panel](../components/execution-panel.tsx). Worker cooperativo, tiempos lógicos/trazas separados de presentación. |
| Pantallas, matriz y cableado | [display-model](../lib/display-model.ts), [led-matrix](../lib/led-matrix.ts), [firmware matriz](../lib/led-matrix-firmware.ts), [wiring-guide](../components/wiring-guide.tsx). Validación compartida, simulación y revisión eléctrica explícita. |
| Imagen Wemos | [wemos-board UI](../components/wemos-board.tsx), [mapa físico](../lib/wemos-board.ts), [referencias contrastadas](REFERENCIA_WEMOS.md). Listado/dibujo comparten conexiones; ilustración propia, no certificación eléctrica. |
| Perfiles de placa y S3 | [board-profiles](../lib/board-profiles.ts), [s3-board UI](../components/s3-board.tsx), [mapa físico S3](../lib/s3-board.ts), [guía de fase 16](FASE_16_ESP32_S3_DEVKIT.md). Identidad, memoria, pines, target y manifiestos comparten perfil; no generalizar N16R8. |
| Recuperación | [project-recovery](../lib/project-recovery.ts), [scene-recovery](../lib/scene-recovery.ts), [local-exit](../lib/local-exit.ts), [use-project-autosave](../components/use-project-autosave.ts). IndexedDB/CAS, envíos pendientes y ACK. |
| Backend | [config/urls](../backend/config/urls.py); módulos [projects](../backend/projects), [courses](../backend/courses), [school](../backend/school), [compiler](../backend/compiler). Django/PostgreSQL. |
| Compilación | [ops/compiler](../ops/compiler), [compiler-generate](../scripts/compiler-generate.mjs), [firmware-builds](../components/firmware-builds.tsx). Cola durable, planificador confiable y ejecutor efímero aislado. |
| USB | [usb-board](../components/usb-board.tsx), [usb-firmware](../lib/usb-firmware.ts), [usb-session](../lib/usb-session.ts), [usb-esptool](../lib/usb-esptool.ts). ZIP/hashes, autorización, exclusividad, cancelación y adaptador. |
| Verificación | [scripts](../scripts), [tests](../tests), [backend/tests](../backend/tests), [CI](../.github/workflows/ci.yml), [Playwright](../playwright.config.ts). Pruebas sintéticas separadas de datos reales. |

Versiones fijadas: Node 22.23.2 en la etapa de construcción del frontend, React 19.2.8, Blockly 12.5.1, Vinext 1.0.0-beta.9, Django 5.2.17, PostgreSQL 17.11 observado, Arduino CLI 1.5.1/core ESP32 3.3.11 y ESP-IDF 5.5.5. El contenedor público `editor` sirve archivos estáticos y no ejecuta Node. Confirmar declaraciones en [package.json](../package.json), lockfile, [requirements](../backend/requirements.txt), Compose y Dockerfiles. Node local observado al iniciar: 22.20.0/npm 11.10.0, no idéntico al builder. No actualizar versiones incidentalmente.

## 5. Contratos críticos y riesgos de regresión

- Permisos frescos dentro de `access_lock()`, revisiones optimistas y operaciones idempotentes. No mutar cuentas/membresías/proyectos por SQL o bulk saltando servicios. Conservar último administrador y revocación.
- JSON portable sin identidad remota, credenciales ni estado transitorio. Importar/nuevo/ejemplos desvinculan la biblioteca después de confirmar reemplazo. No resucitar papelera ni sobrescribir cambios concurrentes.
- Guardar pendiente conserva operación/documento ante respuestas perdidas. IndexedDB por cuenta/copia, CAS entre pestañas, ACK y documento posterior atómicos. No limpiar storage global ni una cuenta real para probar.
- Desconexión permite continuar sólo el proyecto ya cargado, con sesión no vencida y consentimiento cuando corresponde. No autenticar offline ni hacer peticiones con permisos conocidos retirados. Desde fase 12, reloj compartido de 60 segundos, sin consultas por foco/visibilidad ni desmontar el editor por una sesión igual. Mantener expiración conocida, señales de salida/cambio de cuenta, BFCache, recuperación de conexión y autorización fresca de cada operación.
- Escena pendiente no es proyecto confirmado. Guardar/Cancelar esperan persistencia; deshacer/rehacer no deben publicar cambios automáticamente. Referencias de dispositivos/zonas retirados se diagnostican, no se reasignan a escondidas.
- Cámara de escena fuera del JSON, guardado e historial; conservar encuadre al ejecutar/pasar de pestaña y coordenadas inversas al arrastrar. Un primer frame sin movimiento efectivo no abre un grupo de Deshacer sin instantánea inicial. El catálogo temporal no debe bloquear el arrastre ni ocultar cómo cerrarlo.
- `ExecutionPanel` debe permanecer montado: confirma cuadros de ejecución guiada. Trasladar su UI no permite retirar ese ACK. Los errores de almacenamiento deben dejar Exportar y salida alcanzables inmediatamente.
- Revisiones comentadas quedan protegidas. Bajas/purgas exigen conteo, confirmaciones y respaldo vigente; no cascadas incidentales. Los ZIP administrativos restauran contenido por importación, no identidad de cuenta/membresías.
- Compilador: límite global compartido, no liberar cupo sólo por lease vencido; confirmar terminación del contenedor. No ampliar red/montajes/socket/privilegios para resolver un build. Wi-Fi no reutiliza caché.
- USB: validar SHA-256/manifiesto/segmentos y chip/capacidad antes de escribir, verificar transferencia, un dueño del puerto, revalidar acceso. Cancelar no garantiza firmware válido; cerrar pestaña no detiene hardware.
- La compilación y los dobles de pruebas no certifican funcionamiento físico ni seguridad eléctrica. Usar drivers/alimentación adecuados y avisos existentes, sin enseñar conexiones directas engañosas.

## 6. Entornos y operación

### Límites de autorización

VM 112 `capi-dev`, desarrollo; VM 113 `capi-prd`, producción. Ambas preparadas con Ubuntu Server 24.04; recursos limitados. **Gateway sólo salto TCP SSH, jamás comandos/configuración/instalación/reinicio ni copia de claves.** La [fase 13 entregada](FASE_13_ACCESO_EXTERNO_DEV.md) modificó de forma acotada la VM Nginx autorizada; nunca el gateway, host Proxmox, router, PRD u otros sitios.

### Acceso de desarrollo desde Windows

El checkout de la VM está en `/home/capi/capibloques`. El propietario configura el archivo SSH privado fuera de Git, alias `capibloques-dev`; [plantilla y túnel](FASE_0B_DESARROLLO.md#conectarse-desde-windows). No incluir aquí hosts del salto, contraseñas ni rutas de claves.

```powershell
.\scripts\connect-dev.ps1
# Sólo estando realmente en LAN:
.\scripts\connect-dev.ps1 -DirectLan
```

La entrada normal de DEV es `https://capibloques.dev.nvicchi.com/`; salud pública: `/api/health/live/` y `/api/health/ready/`. El túnel dedicado a `http://localhost:3000/` se conserva sólo para recuperación y tareas acotadas: reutilizar el existente y no arrancar duplicados. `localhost` es una entrada local al servidor remoto, no evidencia de un servidor en la PC. Ambos son orígenes distintos y no comparten IndexedDB, borradores ni preferencias del navegador.

El 27 de septiembre DEV agotó sus 31 GB por 24 imágenes históricas del editor y caché de build: `live` continuó en 200, `ready` pasó a 503 y la UI lo presentó como imposibilidad de verificar la sesión. No fueron proyectos ni PostgreSQL. `scripts/cleanup-dev-docker.sh` conserva contenedores activos, compilador y bases, elimina imágenes viejas, vacía la caché regenerable y se ejecuta al final de cada actualización exitosa; jamás limpia volúmenes. Las bases Docker son caché opcional: que alguna no exista no hace fallar la limpieza. Además, un problema exclusivamente posterior de limpieza se informa como advertencia y no convierte en fallida una actualización que ya fue activada y validada correctamente.

No hay autenticación SSH desatendida garantizada: durante el traspaso la conexión sin contraseña fue rechazada y se ingresó interactivamente. Que GitHub funcione por SSH en la VM no significa que el acceso a la VM use la misma autenticación. Si faltan credenciales, pedir al propietario que las configure por canal privado; no rotarlas ni crear una cuenta del asistente.

### Consultas seguras en DEV, después de autenticar

```sh
test "$(hostname)" = capi-dev || exit 1
cd /home/capi/capibloques
git status --short --branch
git rev-parse HEAD
sudo capibloques-dev-runtime status
sudo capibloques-dev-runtime validate
systemctl is-active capibloques-compiler
df -h /
free -m
curl --fail --max-time 12 http://127.0.0.1:3000/api/health/ready/
```

No imprimir `.env`, secretos, logs de proyectos/credenciales ni configurar `set -x`. `ps` y comprobaciones de salud no reemplazan pruebas funcionales.

### Cambios de DEV: procedimientos, no ejecutarlos automáticamente

- La fuente operativa es [fase 13: operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). El runtime combina **tres Compose** y la configuración privada: [editor](../compose.dev.yaml), [backend](../compose.backend.dev.yaml) y [compilador](../compose.compiler.dev.yaml). Conserva el montaje privado de firmware, API/DB sin puertos públicos y el origen LAN restringido al edge.
- Antes de actualizar código o construir, confirmar identidad y árbol limpio; pausar admisión, dejar terminar trabajos y detener el planificador. El backend está montado desde el checkout: si cambia, preparar una ventana específica y respaldo antes del pull. El runtime público no usa HMR; el builder Node no se solapa con editor ni con compilaciones de proyectos.
- Para una actualización sólo de frontend, actualizar por avance rápido y usar `sudo capibloques-dev-runtime deploy`. El runtime construye la imagen versionada, gestiona la parada/arranque mediante systemd y espera salud. No ejecutar `npm ci` dentro de `editor` ni levantarlo manualmente con Compose. Tras verificar versión, salud y recorrido funcional, restituir planificador/admisión según la guía.
- Si cambia backend o la configuración de confianza del proxy, revisar respaldo, imagen/dependencias y migraciones antes de `deploy --with-api`. Esa opción recrea API con el entorno privado, pero **no construye su imagen ni ejecuta migraciones**. Las recetas antiguas de fases 1/2/9 no sustituyen el procedimiento público vigente.
- Si cambia receta/compilador, conservar además los contratos de [fase 9](FASE_9_COMPILACION_Y_DESCARGA.md#operación-dev). No invalidar intentos ni liberar reservas a mano. Mantener concurrencia/techo 1.
- `rollback <tag>` sólo revierte la imagen frontend; no revierte backend, checkout ni datos. No usar `down -v`, `docker system prune`, `git reset --hard`, regeneración de secretos ni borrado de checkout para recuperar. No restaurar sobre la base real como prueba.

### Pruebas locales y contra DEV

En la PC, desde el repositorio con dependencias del lockfile instaladas:

```powershell
npm run typecheck
npm run lint
npm run test:smoke
npm run test:usb
npm run test:idf
npm run build
```

Elegir además pruebas de drivers y backend según riesgo. Compiladores completos de Arduino/IDF están en CI/DEV; no instalarlos en Windows sin necesidad. `npm run dev` es el servidor de desarrollo; `npm start` es Wrangler heredado, no el despliegue Proxmox. Un editor local sin API no valida autenticación real. Preservar `.openai/hosting.json` heredado, **no publicar ni registrar Sites/Pages**.

Contra DEV, con túnel activo y Chrome/Edge instalados:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
npm run test:e2e -- --project=chrome --project=edge --workers=1
```

Una URL externa deshabilita el servidor alternativo de Playwright. Las pruebas UI interceptan identidad/API con fixtures: describirlo, no confundirlo con login real o permisos PostgreSQL. `PLAYWRIGHT_API=1` habilita comprobaciones de salud cuando el caso lo requiere. Eliminar las variables de esa terminal al volver a tests locales. No aumentar timeouts/reintentos para ocultar un fallo.

Backend en DEV: `sudo sh scripts/verify-backend-dev.sh`, **sin `--restart`**, usa API/DB ya iniciadas y migradas, con base separada `test_capibloques`; puede crear esa base de pruebas. El script no carga la configuración privada de fase 13: su opción `--restart` recrearía API/DB sin conservar necesariamente hosts, CSRF, proxies y cookies del entorno público. No usarla tal cual en DEV; CI la usa en su entorno aislado. Toda recreación pública debe preservar los tres Compose y el entorno privado, con mantenimiento y verificaciones de [fase 13](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). CI no despliega en Proxmox ni Pages. Los casos de UI nunca deben modificar proyectos o contraseñas de personas reales.

## 7. Datos, respaldo y recuperación de acceso

Datos permanentes: PostgreSQL (cuentas, colegio/logo, cursos, proyectos, historial/devoluciones) y secretos externos al checkout. Volumen persistente no es respaldo. Hay registros de dumps privados en DEV y verificación de catálogo; **no hay ensayo de restauración integral ni backup externo certificado**. Eso permanece en Fase final antes del piloto con datos reales.

Datos locales: IndexedDB y preferencias de cada cuenta/origen/perfil de navegador. Otra cuenta de la herramienta de desarrollo no migra esos datos. Exportar desde CapiBloques si el propietario cambia navegador/equipo; no copiar todo el perfil ni tokens. JSON no restaura cuentas o permisos.

Recuperar acceso mediante [guía de cuentas](FASE_2A_ACCESO.md) y [script del administrador](../scripts/setup-dev-admin.ps1), sólo con nueva petición explícita si implica restablecer contraseña. El alias elegido fue `Administrador`; no existe contraseña pública vigente y el chat no es un almacén de credenciales. No borrar/recrear usuario: cambiaría UUID y propiedad de datos.

Artefactos compilados caducan y pueden contener Wi-Fi; no subirlos como contexto ni respaldarlos rutinariamente. Logs, traces, capturas y `work/outputs` locales tampoco se suben indiscriminadamente. Sólo fixtures sintéticos y documentación saneada en Git.

### Entrega de la base de fase 18 — 24 de septiembre de 2026

La [guía de fase 18](FASE_18_CONTROLES_LOCALES.md) registra el contrato acordado. El selector de la pantalla integrada admite hasta seis semáforos, robots, motores, LEDs o servos como **estados lógicos sin salida física**. Simulador, Arduino y ESP-IDF comparten prioridad manual por objeto: el programa sigue por debajo y `Volver al programa` muestra su último estado. JSON y backend validan las referencias; el firmware no configura GPIO/PWM/ADC ficticios para esos objetos.

La verificación local incluye typecheck, lint, smoke, generación/validación de fixtures Arduino y ESP-IDF, drivers de display/IDF, USB, build y el recorrido Chromium del tablero manual/programa. El test backend específico queda incorporado para CI/DEV porque Windows no tiene el entorno Python del proyecto. Compilación real de toolchain, despliegue DEV y ensayo táctil/físico permanecen pendientes y no se presentan como realizados.

## 8. Qué está pendiente

El [plan detallado](PLAN_FASES_BACKLOG.md) define aceptación y el [backlog](BACKLOG.md) conserva la intención original. Resumen:

- 10: prueba física Wemos de ambos frameworks y recuperación USB.
- 11: entregada y comprobada; mantenimiento obligatorio en futuras fases, no requiere reiniciar el traspaso.
- 12: **entregada y verificada en DEV/CI**; [guía, pruebas y cierre](FASE_12_MESA_DE_TRABAJO.md). Encabezados/catálogo reorganizados, zoom/desplazamiento de escena, imagen técnica Wemos sincronizada y chequeo periódico sin interrupciones por foco.
- 13: **entregada y verificada externamente**; [acceso persistente a DEV](FASE_13_ACCESO_EXTERNO_DEV.md), HTTPS mediante VM Nginx, runtime como servicio y origen restringido. DNS, certificado, reinicio y acceso Chrome/Edge están comprobados.
- 14: **entregada y verificada en DEV/CI**; [paralelo vertical, lienzo estático e indicadores locales](FASE_14_EJECUCION_VISUAL.md).
- 15: **software entregado y verificado en DEV/CI**, componente Mensajes con modos Enviar/Recibir/Ambos, trama protegida, simulación por botones y ambos generadores; falta aceptación física Wemos.
- 16: **entregada en software** para DIYmall ESP32-S3-DevKitC V1.0 N16R8; [perfil, evidencia e integración](FASE_16_ESP32_S3_DEVKIT.md). Chip/flash/PSRAM se identificaron físicamente sin escribir. Falta grabación y ejecución física de consola/PWM/TX-RX, más comparación física Wemos.
- 17: **implementada en software** para Waveshare ESP32-S3 Touch LCD 5 SKU 28117, exclusivamente 800 × 480/N16R8. Incluye perfil exacto, panel RGB integrado, lectura GT911, guía visual, simulación y generación Arduino/ESP-IDF. Pasaron build, validaciones de generación/USB y 8/8 pruebas Chromium; falta compilación real de toolchain en CI, actualización DEV y aceptación física. Ver [FASE_17_WAVESHARE_5.md](FASE_17_WAVESHARE_5.md).
- 18: **reabierta/en curso**; hay dos modos. Waveshare principal ejecuta una simulación virtual sin GPIO: el intérprete 1.6.0 inicializa el RGB 800 × 480, dibuja posiciones/nombres de escena y actualiza semáforo, carteles matriciales, LED, servo, motor, robot/Otto y entradas virtuales mediante una tarea cooperativa. La placa real en `COM12` confirmó comunicación, ejecución, telemetría y escena RGB con 1.5.4; 1.6.0 queda pendiente de DEV y prueba física. Como Pantalla central Wi‑Fi acompaña a una Wemos/NodeMCU/DevKit; esa escena remota continúa pendiente. Ver [FASE_18_CONTROLES_LOCALES.md](FASE_18_CONTROLES_LOCALES.md).
- 19: pendiente; desafíos progresivos ampliados tras revisar a fondo Pilas Bloques 3.0.2, su creador y recursos docentes. Incluye paletas por reto, programas iniciales vacíos/parciales/incorrectos/refactorizables, escenarios y semillas reproducibles, validación funcional/conceptual separada, depuración paso a paso, autoría docente sobre escenas existentes, pistas, actividades abiertas, accesibilidad y bloque infantil `según`. Plan y fuentes en [FASE_19_HERRAMIENTAS_PEDAGOGICAS.md](FASE_19_HERRAMIENTAS_PEDAGOGICAS.md); no copiar contenidos de Pilas Bloques.
- 20: **asistente base, selección y pareja Waveshare implementados en software**. Distingue Waveshare principal virtual y Pantalla central opcional. Con el firmware requerido 1.6.0, `RUN` inicia también el espejo web a 1× y minimiza el asistente sin cerrar Web Serial. La barra principal distingue **Simulador web** de **Placa**, controla Ejecutar/Pausar/Reanudar/Paso/Detener/Reiniciar en ambos destinos y muestra la telemetría física traducida en **Mensajes de placa**; el registro usa nombres de escena y resultados concretos, no IDs internos. Queda pendiente corregir el caso físico informado donde, tras grabar firmware, hay que recargar el apartado y desenchufar/enchufar: debe reabrir CapiLink automáticamente. También queda agregar **Qué tiene esta placa** con título/autor informativos persistidos por fase 36, además de escena/touch remotos e historial global del cambio. Ver [FASE_20_USO_GUIADO_PLACA.md](FASE_20_USO_GUIADO_PLACA.md).
- 21: claridad y ergonomía educativa: superposición de bloques, borrador de escena, fidelidad espacial entre editor y simulación, operadores/menús/emojis, textos, advertencias y nueva auditoría de interfaz.
- 22: avatar acompañante con reacciones accesibles ante desafíos, compilación y grabación.
- 35 y 38–41: software terminado y desplegado en DEV sobre `8103b14`; luces RGB, entradas/control, ambiente/medición, movimiento/identificación y actuación/medición avanzada. Conservan aceptación física; inventario en [COMPONENTES_A_IMPLEMENTAR.md](COMPONENTES_A_IMPLEMENTAR.md).
- 23: **en curso**; matriz 32 × 8 con cuatro MAX7219 implementada en software. El componente existente de LCD/OLED/TFT se presenta como **Pantalla de texto**; se está incorporando el hardware confirmado LCD Keypad Shield 16 × 2 como perfil combinado de pantalla paralela y cinco botones lógicos. El propietario confirmó que esa pantalla y sus botones funcionan; falta validar el firmware generado por CapiBloques y los otros módulos físicos.
- 24: panel web local para un celular emparejado, misma LAN, vistas Escena/Controles e inputs relacionados mediante bloques.
- 25: compartir proyectos por enlace/QR con copia/vista, caducidad y revocación.
- 26: acceso de aula sin contraseña y asistencia con identidad, sesión y revocación explícitas; el logo y nombre del colegio deben ser el centro visual del ingreso normal y supervisado.
- 27: **software genérico entregado; aceptación física pendiente**. Cinco configuraciones cubren bípedo de cuatro servos, sonido, ultrasonido, matriz expresiva y humanoide de seis servos; incluyen 17 movimientos, brazos, expresiones y distancia como dato en simulación, JSON, Arduino y ESP-IDF. Ninja y Wheels siguen pendientes como variantes específicas. Ver [FASE_27_OTTO.md](FASE_27_OTTO.md).
- 28: **implementada en software**; barrera infrarroja digital como sensor «libre / interrumpida», con polaridad configurable en escena, dato sí/no reutilizable, simulación, JSON, validación y generación Arduino/ESP-IDF. Contrato en [FASE_28_BARRERA_INFRARROJA.md](FASE_28_BARRERA_INFRARROJA.md); falta aceptación física del detector exacto.
- 29: **implementada en software**; datos y variables tipados —número, texto y sí/no—, cuentas/comparación, valores de contador, sensores, botones, Wi-Fi y último mensaje recibido, composición reutilizable en consola, pantallas y Mensajes. Contrato en [FASE_29_VARIABLES.md](FASE_29_VARIABLES.md).
- 30: **implementada en software**; hasta 16 temporizadores con nombre, iniciar/reiniciar/pausar/continuar/detener, una vez/repetir, espera cooperativa explícita, valores transcurrido/restante y progreso visible. Los valores aparecen también en **Datos** y existe comparación directa por igual/distinto/menor/mayor en **Temporizadores** y **Condiciones**. Incluye simulador, JSON, Arduino, ESP-IDF y `CapiRules`/intérprete 1.1.0. Despliegue DEV, compilación cruzada publicada y aceptación física pendientes; contrato en [FASE_30_TEMPORIZADORES.md](FASE_30_TEMPORIZADORES.md).
- 31: **implementada en software**; tareas y funciones número/texto/sí-no, hasta tres parámetros locales tipados, 24 definiciones y 8 niveles, sin recursión/ciclos. El editor agrega Principal más pestañas editables; `+`, renombrar, reordenar, borrar y `Enviar a…` desde el botón derecho participan de Deshacer/Rehacer. El envío mueve el grupo raíz conectado completo a cualquiera de las demás pestañas sin alterar su ejecución, y doble clic en una llamada navega a su definición. Es organización visual sobre un único grafo y migra proyectos anteriores automáticamente. Se expanden al grafo común de simulador, Arduino, ESP-IDF e intérprete. Despliegue y aceptación de uso pendientes; ver [FASE_31_PROCEDIMIENTOS_FUNCIONES.md](FASE_31_PROCEDIMIENTOS_FUNCIONES.md).
- 32: **implementada en software**; contrato común tipado para datos medidos, órdenes lógicas y servicios, con selectores por instancia, simulación, JSON, Arduino, ESP-IDF y `CapiRules`/intérprete 1.2.0. El semáforo tiene accesos infantiles directos `color actual` y `¿está apagado/rojo/amarillo/verde?`, además del dato genérico. Despliegue DEV y aceptación física pendientes; ver [FASE_32_ESTADOS_COMPONENTES.md](FASE_32_ESTADOS_COMPONENTES.md).
- 33: **implementada en software**; roles Crear/Conectarse, identidad de placa, pares y textos predefinidos, envío y recepción con ramas igual/distinto/timeout, simulador, Arduino, ESP-IDF y `CapiRules`/intérprete 1.3.0 con protocolo versionado, CRC y deduplicación. Las credenciales permanecen fuera de JSON/Git/logs. Falta actualizar DEV y aceptar físicamente un AP con dos clientes; ver [FASE_33_WIFI_ENTRE_PLACAS.md](FASE_33_WIFI_ENTRE_PLACAS.md).
- 34: **base de pareja implementada en software**; selección dual, `WSMMMMMM`, contraseña/clave generadas localmente, NVS y provisión de AP/cliente están entregados en CapiLink 1.5.3. Faltan canal autenticado, descriptor/telemetría, escena RGB, touch, entradas/servicios, DEV y aceptación física. La placa ejecutora seguirá siendo autoridad única. Ver [FASE_34_PANTALLA_CENTRAL_WIFI.md](FASE_34_PANTALLA_CENTRAL_WIFI.md).
- 42: **entregada en software y desplegada en DEV; aceptación visual pendiente**. La mesa ofrece Crear y Probar con ancho contextual, mantiene Ejecutar/Pausar, Paso y Usar en placa como acciones principales, muestra Detener sólo al ejecutar y reúne Reiniciar/velocidad/código/conexiones en Más. Mis proyectos y opciones de archivo viven en Proyecto; avatar abajo a la derecha; Deshacer/Rehacer/Centrar junto a Usar en placa; catálogo de escala fija 0,72. En ejecución, Pausar es amarillo anaranjado con texto negro y Detener rojo con texto blanco. No se retiraron confirmaciones. Ver [inventario, decisiones, evidencia y despliegue](FASE_42_SIMPLIFICACION_UI.md).
- 44: **en curso; núcleo local implementado en software con runtime 1.6.0**. CapiLink/placa/espejo web admiten `STEP`; la Waveshare ofrece Ejecutar/Pausa, Paso, Detener y Reiniciar en pantalla, inspector de contador/variables/temporizadores/caminos y GT911 para botón, barrera/PIR, valor gradual y joystick como entradas virtuales tipadas. Negocia `step`, `touch-inputs` y `autonomous-controls`. El 4 de octubre el propietario decidió postergar la compilación y las pruebas físicas de 1.6.0 para poder avanzar con otra fase; quedan registradas como pendientes. También faltan escenarios, bloque actual por camino y actividades remotas dependientes de fase 34. Ver [FASE_44_EXPERIENCIA_WAVESHARE.md](FASE_44_EXPERIENCIA_WAVESHARE.md).
- 45: **en curso, segunda entrega funcional**; cinco aventuras nuevas, fondos vectoriales, cruce con flujo variable/filas/choques, pista de robot, encaje de semáforos y renderer compacto Waveshare 1.5.7. En web, los cuatro semáforos forzados quedan sobre el jardín en el lado de destino del flujo que controlan. Flechas de carril y una vista superior orientada junto a las tres luces hacen explícita la relación. Se nombran Semáforo 1–4 reutilizando el primer número libre; sólo existen en Cruce con tránsito, ocupan automáticamente un slot libre, sólo se mueven entre slots libres y nunca superan cuatro. Cada uno admite matrices MAX7219 8×8 opcionales: segundero vehicular sólo 0–9/apagado y cartel peatonal con persona caminando/quieta/apagado, encadenadas sobre DIN/CLK/CS compartidos, con bloques, simulación y soporte físico. Las calles de doble mano admiten tránsito seleccionable hacia derecha, izquierda, abajo y arriba. Dos semáforos conservan control por eje; con cuatro, cada acceso controla su sentido. Amarillo/rojo usan la línea de detención y los actores respetan velocidad/pausa; apagado se comporta como amarillo y nunca reinicia los autos. **Reiniciar** sí restablece programa y mundo completo: autos, filas, choque y azar. Los autos nacen independientemente y se destruyen al salir; el máximo simultáneo es doce. La segunda entrega suma selección múltiple, movimiento grupal acotado, alineación/distribución, grilla 10/20/40, guías magnéticas, orden Adelante/Atrás persistido y validado, cajas lógicas comunes, anclas deterministas de rótulo y avisos no bloqueantes de solapamiento. Waveshare consume el mismo orden y criterio de anclas. Quedan capturas de referencia, mediciones y aceptación física. Ver [FASE_45_ESCENAS_VISUALES.md](FASE_45_ESCENAS_VISUALES.md).
- 43: **terminada en software; DEV/físico pendientes**. Editor modal grande compartido 16×8/32×8 con lápiz, borrador, línea, curva, formas, relleno, transformaciones, historial y vista real; diez efectos de texto, siete de dibujo, una/N/sin parar, detener y esperar cooperativos. Matriz MAX7219 agrega brillo programable 0–100%. CapiRules exige intérprete 1.7.0 para evitar cargar reglas nuevas en firmware viejo. Selección/importación/color y patrones generativos quedan como ampliaciones; ver [FASE_43_EFECTOS_DISPLAY.md](FASE_43_EFECTOS_DISPLAY.md).
- 35: **terminada en software**; Luces RGB inteligentes para WS2812B/WS2812 y SK6812 RGB con tira, aro y matriz, orientación/zigzag, conjunto/píxel/tramo/coordenada/degradado/dibujos, animaciones cooperativas, simulador, JSON, ayuda, Arduino, ESP-IDF y CapiRules/intérprete 1.4.0. Falta DEV y aceptación física; ver [FASE_35_LUCES_RGB.md](FASE_35_LUCES_RGB.md).
- 36: **runtime 1.5.4 probado físicamente; 1.7.0 implementado y pendiente de DEV/placa**. `CapiRules` v1/ABI 1, `CapiLink`, commit A/B, arranque autónomo, telemetría, renderer RGB cooperativo y PSRAM octal están entregados. La Waveshare real en `COM12` completó 1.5.4 hasta `program-done`; 1.6.0 incorporó paso/touch autónomo y 1.7.0 efectos ampliados, detención visual y brillo MAX7219. La UI traduce telemetría a acciones amigables y nombres configurados, sin exponer `blockId`. Queda pendiente ampliar reglas/`HELLO` con título y autor visible acotados: serán legibles por USB, reemplazables y nunca funcionarán como propiedad o bloqueo. Plan/estado en [FASE_36_FIRMWARE_INTERPRETE.md](FASE_36_FIRMWARE_INTERPRETE.md).
- Raspberry Pi quedó registrada sólo **para análisis** en el pedido 44 del backlog. La primera alternativa es usar Pi 4/5 con Raspberry Pi OS como Central CapiBloques para escenas, telemetría y controles de una o varias placas; programar su GPIO mediante un intérprete Linux es una posibilidad posterior y separada. No tiene fase ni implementación autorizada.
- 37: **implementada en software**; registro versionado con 27 fichas base/perfil, capas infantil/docente, conexión derivada de placa y GPIO actuales, accesos desde catálogo/inspector/cableado/bloques/errores, impresión y cobertura automática. Usa ilustraciones locales explícitamente declaradas; no finge fotografías exactas. Falta actualizar DEV y evaluar comprensión/uso con alumnos y docentes; ver [FASE_37_AYUDA_COMPONENTES.md](FASE_37_AYUDA_COMPONENTES.md).
- El [informe externo del 14 de septiembre](BACKLOG.md#pedidos-externos-a-analizar) queda distribuido entre 20–22 y 25–26. El selector angular con reloj está expresamente descartado y no es trabajo pendiente. La barra residual, el arrastre individual/grupal y el guardado estable ya están corregidos en `d096fd9`, `0fc9ff2` y `2b97af9`.
- Final: producción/HTTPS, restauración/backups externos, carga, monitoreo, rollback y piloto; postergada.

La fase 20 está autorizada y terminada en software; la siguiente fase requiere un nuevo OK. Las aceptaciones físicas de fases 10, 15–18, 20, 23, 27, 28, 30, 32, 33 y 35–41 siguen separadas. La fase 16 sólo corresponde a la DIYmall N16R8 inspeccionada y las fases 17–18 sólo a la Waveshare SKU 28117: no extrapolar perfiles a otras revisiones. Exigir modelo/documentación y ensayo físico antes de anunciar soporte de una placa nueva. Los diagramas fueron contrastados con las fuentes enlazadas; una ilustración nunca es fuente única de verdad.

## 9. Mensaje listo para otra conversación

> Continuá CapiBloques desde este repositorio. Primero leé AGENTS.md y docs/CONTEXTO_PARA_CONTINUAR.md, luego el plan y la guía de la entrega vigente. Confirmá rama, cambios locales y versión desplegada antes de operar. La fase 20 simplificó el uso físico alrededor del firmware intérprete y las reglas; compilación nativa quedó avanzada. Trabajá una entrega completa por vez, informá avances y actualizá este contexto al terminar; no inicies otra fase sin el OK del propietario. Producción es la Fase final y está postergada. El gateway es exclusivamente un salto SSH y está prohibido modificarlo; tampoco modifiques Proxmox, router, PRD u otros sitios. No copies secretos, no documentes contraseñas ni borres datos para recuperar acceso. Las aceptaciones físicas siguen pendientes salvo evidencia posterior explícita.

## 10. Lista de cierre y mantenimiento obligatorio

Corrección del editor de dibujos del 5 de octubre de 2026: la captura de puntero
en cada casilla dejaba el punto final igual al inicial y suprimía el recorrido.
El lienzo ahora captura el gesto y calcula coordenadas reales, previsualiza
figuras, interpola lápiz/borrador y restaura el borrador al cancelar el gesto.
Cada apertura inicia un borrador independiente; cada gesto se deshace como una
operación. Verificados línea, curva, rectángulo, rectángulo lleno, círculo y balde,
preview, Deshacer/Rehacer y guardar/reabrir en Chrome y Edge para 16×8 y 32×8
(4/4 E2E), además de TypeScript, lint del componente y prueba de rasterización.
Actualización DEV a ejecutar por el propietario; no exige recompilar firmware.

Corrección de compilación del 5 de octubre de 2026: `is_waveshare()` estaba
definida dentro de `CONFIG_IDF_TARGET_ESP32S3` aunque las expresiones, condiciones
y HELLO comunes la utilizan; ahora se define para todos los destinos. Se corrigió
también el guard de animación ambiguo y la dependencia implícita de `abs` en
el generador de efectos. Verificado con compilación C++ del helper preservando
las condiciones reales para los tres perfiles y con los seis adaptadores de
display compilados/ejecutados por `scripts/display-driver.test.mjs`. Esto no
equivale a compilar todo ESP-IDF ni a aceptación física; la recompilación completa
queda a cargo del actualizador DEV que ejecuta el propietario.

Corrección operativa del 5 de octubre de 2026: el actualizador DEV permite
reanudar un mantenimiento cuyo objetivo guardado es anterior al checkout,
si ambos pertenecen a la misma línea del objetivo actual. Audita desde el
objetivo pendiente para no omitir cambios ya presentes en HEAD, conserva
los pasos pendientes y la pausa original, y mantiene las validaciones finales.
Verificado localmente con seis escenarios de Git real en
`python scripts/test_deploy_resume.py`, los once contratos públicos y sintaxis
Bash. El propietario debe repetir el actualizador; todavía no hay confirmación
de recuperación remota. No borrar el marcador ni abrir admisión manualmente.

1. Registrar autorización exacta y alcance entregado; distinguir pendiente, bloqueado y postergado, sin porcentajes ficticios.
2. Actualizar este corte con commits funcionales, pruebas y resultados reales, límites/mocks, fecha de verificación remota y versión desplegada. No adjudicar a un commit una prueba corrida sobre otro.
3. Enlazar la guía de entrega nueva y actualizar plan, backlog, README/AGENTS cuando cambie su estado. Mantener enlaces históricos sin llamar completas funciones no verificadas.
4. Revisar que no haya credenciales, datos infantiles, artefactos privados o rutas de claves en el diff. Verificar enlaces desde un checkout limpio y comandos de consulta, sin ejecutar operaciones destructivas como prueba.
5. Hacer commit/push de cambios verificados, confirmar árbol limpio y remoto. No desplegar si sólo cambió documentación; cambios de aplicación se verifican en DEV según su alcance.
6. Dejar próximos pasos concretos, procesos/túneles normales retenidos y trabajos temporales terminados o explícitamente pendientes. No dejar una prueba que requiere atención corriendo sin informar.

La documentación de fase 11 **no se congela** al completar su primera entrega: es el punto de continuidad obligatorio para la fase 12 y todas las siguientes que autorice el propietario.
