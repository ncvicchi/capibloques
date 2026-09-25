# Fase 20 — Uso guiado de la placa

Estado al 25 de septiembre de 2026: **asistente base terminado en software; selección visual de placa pendiente y aceptación física pendiente**. El propietario redefinió la fase para que el recorrido cotidiano sea instalar el firmware intérprete precompilado y enviar reglas localmente. La compilación Arduino/ESP-IDF por proyecto se conserva como herramienta avanzada, pero deja de competir con la acción principal.

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

- El firmware intérprete publicado es 1.4.0, ABI 1, para Wemos D1 R32 y DIYmall ESP32-S3 DevKitC N16R8.
- La Waveshare SKU 28117 no se presenta como destino del intérprete mientras su pantalla/controladores no estén cubiertos de manera real.
- Si un proyecto usa una capacidad que el intérprete no declara, se bloquea antes de enviar reglas y se explica la actualización necesaria.
- Web Serial requiere Chrome o Edge de escritorio y HTTPS o localhost. USB pertenece a la PC del navegador, no al servidor.
- Arduino/ESP-IDF específicos siguen siendo una salida válida para diagnóstico, estudio o componentes todavía no cubiertos. Ocultarlos no autoriza retirar compatibilidad.

## Selección y cambio de placa — pendiente de esta fase

La placa forma parte del proyecto, pero no es una decisión irreversible. Puede cambiarse desde la escena o desde el propio asistente **Usar en placa**, incluso después de haber programado parte del proyecto.

- La primera pantalla debe decir **Placa actual**, nunca «Elegiste», cuando el perfil provenga del valor predeterminado o de una importación.
- Debe mostrar nombre completo y una fotografía clara de la placa actual, con texto alternativo. Los diagramas vectoriales existentes se conservan para cableado, pero no sustituyen la foto de reconocimiento.
- **Cambiar placa** abre una pantalla propia dentro del asistente. Sólo ofrece perfiles que puedan recibir el proyecto o explica qué impide cada alternativa; no muestra un selector técnico indiscriminado.
- Para proyectos con GPIO/componentes externos, los candidatos habituales son Wemos D1 R32 y DIYmall ESP32-S3 DevKitC. La Waveshare de 5″ se trata como una familia separada cuando el proyecto depende de pantalla/touch integrados. La lista final se calcula por capacidades reales, no sólo por nombre de familia.
- Antes de confirmar, se hace una prueba sin modificar el proyecto: capacidades, memoria, cantidad/tipo de pines, PWM, buses y dependencias integradas. Se presenta el resultado en lenguaje cotidiano.
- Un cambio compatible conserva bloques, escena y configuración. Las reasignaciones automáticas seguras se muestran antes de aplicarse. Conflictos restantes ofrecen volver o abrir la escena para resolverlos; nunca se borran componentes ni se cambian conexiones silenciosamente.
- El cambio se persiste sólo después de confirmar y participa de Guardar/Cancelar, Deshacer/Rehacer, autoguardado e historial.
- Al conectar por USB, si la placa detectada no coincide con la placa actual, se bloquea el envío y se ofrecen dos salidas explícitas: conectar la placa esperada o volver a la selección compatible. Detectar hardware no autoriza cambiar el proyecto automáticamente.

Actualmente el repositorio tiene ilustraciones técnicas propias para Wemos, DIYmall S3 y Waveshare SKU 28117, pero no fotografías. Antes de cerrar esta extensión se incorporarán imágenes exactas aportadas por el propietario o con procedencia/licencia documentada; no se usará una foto genérica de otra revisión.

## Verificación

- `npm run typecheck` y `npm run lint` correctos.
- 22/22 recorridos Chromium afectados correctos: entrada principal a placa, compilación avanzada, USB/monitor, permisos, hash, interrupciones, revocación y diseño móvil.
- Suite smoke completa correcta, incluido `CapiRules`, protocolo `CapiLink`, contrato fuente del intérprete, perfiles, componentes y generadores.
- Build estático correcto con sus diez rutas verificadas; permanece únicamente el aviso conocido de tamaño de chunks.
- Regresión final de experiencia: 7/7 recorridos Chromium correctos, incluido que las herramientas nativas no aparezcan en el menú principal y sí dentro del panel avanzado.
- Corrección de asistente: typecheck, lint, suite smoke completa, build estático y 7/7 recorridos Chromium correctos. La prueba comprueba que revisión y conexión no aparezcan juntas.

## Aceptación física pendiente

Para cerrar hardware hace falta, en cada placa autorizada: instalar el intérprete desde una placa con otro programa, reconectar, enviar reglas, ejecutar, pausar/detener, reiniciar sin PC, actualizar desde una versión anterior y provocar una transferencia interrumpida. Compilar y empaquetar los artefactos no sustituye esa prueba.
