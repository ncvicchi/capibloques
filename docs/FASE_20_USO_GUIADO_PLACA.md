# Fase 20 — Uso guiado de la placa

Estado al 25 de septiembre de 2026: **asistente, selección visual y modelo de dos placas implementados en software; aceptación física y escena remota Waveshare pendientes**. El propietario redefinió la fase para que el recorrido cotidiano sea instalar el firmware intérprete precompilado y enviar reglas localmente. La compilación Arduino/ESP-IDF por proyecto se conserva como herramienta avanzada, pero deja de competir con la acción principal.

La primera implementación se publicó en `main` como `6dece1e`. La corrección `9914ae8` del 25 de septiembre reemplaza el panel acumulativo por un asistente de pantallas. DEV todavía permanece en `8103b14` hasta que el propietario ejecute la actualización rápida.

## Decisión de producto

El recorrido infantil se presenta como **una pantalla por decisión**:

1. revisar que el proyecto esté listo; una futura aprobación docente obligatoria debe ocupar esta pantalla cuando exista una política real, no mezclarse con USB;
2. conectar y comprobar la placa;
3. si está vacía, tiene otro programa o una versión incompatible, preparar el firmware CapiBloques en una pantalla propia;
4. configurar Wi-Fi sólo cuando el proyecto lo requiera;
5. enviar las reglas y ejecutarlas mediante una única acción;
6. controlar la ejecución; la telemetría queda plegada hasta que se solicite.

Las reglas se generan en el navegador. No usan la cola de compilación, no envían el proyecto al servidor y una transferencia incompleta no reemplaza las últimas reglas válidas. Antes de transferir se comprueban placa, versión mínima, ABI, capacidades, tamaño y recursos. Un firmware incompatible no ofrece continuar de todos modos.

## Interfaz entregada

- **Usar en placa** es una acción visible junto a los controles del simulador. Ya no hace falta cambiar un selector global que inutilizaba Paso, Detener y Reiniciar.
- El diálogo es un asistente con progreso, botón Atrás seguro y una acción dominante por pantalla. No muestra conexión, instalación, Wi-Fi, envío y telemetría al mismo tiempo.
- Una placa sin intérprete puede prepararse directamente, sin provocar primero un error obligatorio.
- **Enviar reglas y ejecutar** sustituye la secuencia manual de dos botones. Pausar, continuar y detener aparecen en la pantalla final; la telemetría y los datos técnicos están bajo detalles plegables.
- Wi-Fi es una pantalla condicional y permite conservar la red existente sin obligar a volver a escribir la clave.
- La instalación explica que reemplaza el programa actual y conserva las tres confirmaciones físicas previas. Al terminar vuelve al recorrido de conexión y reglas.
- Exportar JSON y guardar una copia local siguen a la vista. Fuentes Arduino/ESP-IDF, compilación específica y monitor Serial viven en **Herramientas avanzadas para adultos**. No se borraron sus APIs, permisos, cola, artefactos ni pruebas.

## Compatibilidad y límites

- El firmware intérprete requerido es 1.5.4, ABI 1, para Wemos D1 R32, DIYmall ESP32-S3 DevKitC N16R8 y Waveshare SKU 28117. La revisión 1.5.1 corrigió el watchdog; 1.5.2 agregó CapiLink por USB Serial/JTAG, 1.5.3 reutiliza ese driver cuando la consola ya lo instaló y 1.5.4 agrega el renderer RGB local.
- El intérprete Waveshare 1.5.4 permite identificar, preparar y levantar su AP persistente y, como placa principal, dibuja la escena virtual y sus estados principales. El touch y la escena recibida desde otra placa continúan en fases 18/34.
- Al comenzar desde `Usar mi placa`, la simulación web carga el mismo programa a
  velocidad real y arranca después del `RUN` confirmado. El asistente se
  minimiza sin cerrar Web Serial; un control flotante mantiene pausa,
  continuación, detención y regreso al detalle. Así la escena de la PC sigue
  visible mientras la placa ejecuta. No sustituye realimentación eléctrica:
  sensores físicos todavía requieren telemetría tipada para reflejar su medida.
- El registro traduce cada bloque a una frase de resultado y usa el nombre de
  escena: por ejemplo `Semáforo 1: cambió a rojo`; nunca presenta `blockId`.
- Si un proyecto usa una capacidad que el intérprete no declara, se bloquea antes de enviar reglas y se explica la actualización necesaria.
- Web Serial requiere Chrome o Edge de escritorio y HTTPS o localhost. USB pertenece a la PC del navegador, no al servidor.
- Arduino/ESP-IDF específicos siguen siendo una salida válida para diagnóstico, estudio o componentes todavía no cubiertos. Ocultarlos no autoriza retirar compatibilidad.

## Selección y cambio de placa

La placa forma parte del proyecto, pero no es una decisión irreversible. Puede cambiarse desde la escena o desde el propio asistente **Usar en placa**, incluso después de haber programado parte del proyecto.

Hay dos recorridos explícitos. Si Waveshare es el destino principal, todos los
componentes se simulan en su pantalla y no se piden GPIO. Si el proyecto usa
hardware físico, el modelo de Pantalla central amplía la selección a dos
lugares con nombres funcionales, no a un selector único ambiguo:

- **Placa del proyecto** es obligatoria en el recorrido físico y ejecuta reglas,
  sensores y actuadores.
- **Pantalla central** es opcional y admite una Waveshare compatible. Al
  activarla, el asistente muestra siempre las dos placas; nunca sustituye la
  primera por la Waveshare.
- Los proyectos físicos existentes migran como Placa del proyecto + «Sin
  pantalla central». Un proyecto Waveshare existente conserva el modo de
  simulación en pantalla. Cada lugar puede cambiarse con comprobación y
  confirmación.
- Para preparar una pareja, CapiBloques conecta ambas por Web Serial, lee la MAC
  Wi-Fi de la Waveshare, forma `WS` más sus últimos seis dígitos hexadecimales y
  configura automáticamente ese SSID, una contraseña única y la identidad de
  emparejamiento en las dos placas. El alumno no elige un AP ni escribe claves.
- La contraseña queda en almacenamiento local de las placas, no en el JSON, el
  servidor, Git ni el historial. Cambiar Pantalla central vuelve a preparar la
  Placa del proyecto; cambiar la Placa del proyecto no borra el AP persistente
  de la Waveshare.
- El asistente muestra fotos, firmware, estado y pertenencia de ambas placas.
  Las reglas se envían a la Placa del proyecto; la Waveshare recibe la escena y
  telemetría según el contrato de fase 34.

- La primera pantalla debe decir **Placa actual**, nunca «Elegiste», cuando el perfil provenga del valor predeterminado o de una importación.
- Debe mostrar nombre completo y una fotografía clara de la placa actual, con texto alternativo. Los diagramas vectoriales existentes se conservan para cableado, pero no sustituyen la foto de reconocimiento.
- **Cambiar placa** abre una pantalla propia dentro del asistente. Sólo ofrece perfiles que puedan recibir el proyecto o explica qué impide cada alternativa; no muestra un selector técnico indiscriminado.
- Para proyectos con GPIO/componentes externos, los candidatos habituales son Wemos D1 R32 y DIYmall ESP32-S3 DevKitC. La Waveshare de 5″ se trata como una familia separada cuando el proyecto depende de pantalla/touch integrados. La lista final se calcula por capacidades reales, no sólo por nombre de familia.
- Antes de confirmar, se hace una prueba sin modificar el proyecto: capacidades, memoria, cantidad/tipo de pines, PWM, buses y dependencias integradas. Se presenta el resultado en lenguaje cotidiano.
- Un cambio compatible conserva bloques, escena y configuración. Las reasignaciones automáticas seguras se muestran antes de aplicarse. Conflictos restantes ofrecen volver o abrir la escena para resolverlos; nunca se borran componentes ni se cambian conexiones silenciosamente.
- El cambio se persiste sólo después de confirmar y participa de Guardar/Cancelar, Deshacer/Rehacer, autoguardado e historial.
- Al conectar por USB, si la placa detectada no coincide con la placa actual, se bloquea el envío y se ofrecen dos salidas explícitas: conectar la placa esperada o volver a la selección compatible. Detectar hardware no autoriza cambiar el proyecto automáticamente.

**Entregado en software en `1904e76`:** el asistente muestra «Placa actual» con las fotografías aportadas por el propietario, permite revisar un cambio Wemos ↔ DIYmall, conserva pines todavía válidos, enumera las conexiones que cambiarán y sólo aplica la nueva escena/perfil después de confirmar. La foto compuesta de Waveshare alterna frente y dorso cada dos segundos; con reducción de movimiento permanece estable. Se mantienen los diagramas técnicos propios para cableado. Los activos originales, sin regenerar, viven en `public/boards/`.

**Entregado en software para emparejamiento:** el modelo portable conserva Placa del proyecto y Pantalla central por separado, sin secretos. El asistente instala el intérprete 1.5.4 en cualquiera de las dos, obtiene la identidad de la Waveshare, genera `WSMMMMMM` y una clave aleatoria local, guarda el rol/AP en NVS y luego prepara la placa ejecutora como cliente. No presenta selector de red ni campo de contraseña al alumno.

**Pendiente:** reflejar y controlar la escena real en el panel RGB/touch, usar la clave de pareja para autenticar telemetría/comandos, integrar el cambio con un punto explícito del historial global más allá de la confirmación y el autoguardado actuales, y completar la aceptación física con ambas placas.

## Verificación

- `npm run typecheck` y `npm run lint` correctos.
- 22/22 recorridos Chromium afectados correctos: entrada principal a placa, compilación avanzada, USB/monitor, permisos, hash, interrupciones, revocación y diseño móvil.
- Suite smoke completa correcta, incluido `CapiRules`, protocolo `CapiLink`, contrato fuente del intérprete, perfiles, componentes y generadores.
- Build estático correcto con sus diez rutas verificadas; permanece únicamente el aviso conocido de tamaño de chunks.
- Regresión final de experiencia: 7/7 recorridos Chromium correctos, incluido que las herramientas nativas no aparezcan en el menú principal y sí dentro del panel avanzado.
- Corrección de asistente: typecheck, lint, suite smoke completa, build estático y 7/7 recorridos Chromium correctos. La prueba comprueba que revisión y conexión no aparezcan juntas.
- Selección visual: typecheck, lint, smoke y build correctos; el recorrido Chromium comprueba foto actual, cambio confirmado Wemos → DIYmall y alternancia frontal/trasera de Waveshare.

## Aceptación física pendiente

Para cerrar hardware hace falta, en cada placa autorizada: instalar el intérprete desde una placa con otro programa, reconectar, enviar reglas, ejecutar, pausar/detener, reiniciar sin PC, actualizar desde una versión anterior y provocar una transferencia interrumpida. Compilar y empaquetar los artefactos no sustituye esa prueba.
