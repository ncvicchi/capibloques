# Fase 12 — Mesa de trabajo, cámara y sesión

Estado: **entregada y verificada en DEV**. Fecha: 8 de septiembre de 2026. Código funcional y DEV: **`668be43`**. Autorización: fases 11 y 12 completas y consecutivas. No incluye ninguna fase posterior ni producción. La documentación viva de la 11 está actualizada en [CONTEXTO_PARA_CONTINUAR](CONTEXTO_PARA_CONTINUAR.md).

Los commits y resultados de esta guía corresponden al cierre del 8 de septiembre. La fase 13 entregó el runtime HTTPS persistente el 12 de septiembre; para operar la web/API actuales usar su [operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente).

## Alcance implementado

- Dos filas globales: proyecto/guardado/biblioteca/exportación/cuenta y controles de ejecución/código/conexiones. El contexto de escena, su edición y la ejecución detallada viven junto al simulador. Guardar, estado de guardado, Deshacer/Rehacer, Ejecutar y Detener siguen visibles. La cuenta/sonidos/salida se agrupan bajo «Opciones de mi cuenta»; el avatar conserva acceso directo. Errores de guardado siguen visibles, no se esconden en un menú.
- En móvil, las acciones se redistribuyen en líneas según su texto. Al bajar a la escena sólo queda fija la barra de ejecución: la cabecera de proyecto se desplaza normalmente, sin superponerse con Ejecutar/Detener. No se fuerza en móvil la meta de dos filas medida para escritorio.
- Catálogo de bloques con fondo opaco, borde y separación; botón «Cerrar catálogo», Escape y cierre al terminar el arrastre. No cambia la semántica ni la orientación de «Al mismo tiempo».
- Cámara compartida por editor de escena, simulador y revisión docente: botones +/−, Ajustar, Mano, arrastre de fondo/botón central, flechas, +/−/0/Home. En táctil, Mano permite desplazamiento y pinza con dos dedos; fuera de Mano se conserva desplazamiento/zoom de la página. No se captura la rueda ni los atajos Ctrl/Cmd de zoom del navegador.
- Ajustar = 100 % del encuadre completo, no un píxel físico por unidad lógica. Zoom relativo de 25–400 %. Mantiene parte del lienzo recuperable y reajusta al cambiar tamaño. El cambio de escena/dimensiones reinicia la cámara; la ejecución y cambiar entre pestañas Escena/Estado/Consola la conservan.
- Cámara local, fuera del JSON, favoritos, recuperación, autoguardado y Deshacer. Las posiciones de dispositivos se calculan con el rectángulo transformado: mover objetos sigue respetando coordenadas lógicas, cuadrícula y límites. Las etiquetas se dibujan legibles al encuadrar, sin empequeñecerlas por la resolución lógica de la escena.
- Dibujo Wemos propio, con USB/orientación, contactos físicos y alias separados; selección por GPIO o por componente vinculada a las mismas filas del listado. Un componente puede resaltar varios pines a la vez. No dibuja motores o cargas directamente al GPIO. Fuentes, límites y variantes en [REFERENCIA_WEMOS](REFERENCIA_WEMOS.md). No agrega perfiles S3.

## Sesión y permisos

`lib/session-polling.ts` coordina un reloj por pestaña de **60 segundos**, con exclusión de solicitudes periódicas superpuestas y limpieza al desmontar. No escucha focus, blur ni visibilitychange para consultar. Oculta: omite el ciclo; visible de nuevo: espera el ciclo, sin ráfaga acumulada. Recuperar conexión (`online`) o restaurar desde BFCache sí permite comprobar; una apertura normal hace su comprobación inicial.

El editor no se desmonta ni se pausa si la verificación periódica confirma la misma sesión. Cambios explícitos de cuenta/salida, 401/403, errores de conexión y expiración conservan sus protecciones y recuperación. El vencimiento conocido se aplica también al recuperar visibilidad **sin hacer una petición por foco**, e invalida respuestas anteriores. Nunca habilita autenticación offline. Las operaciones remotas, permisos por proyecto/curso, CSRF, propiedad, descargas y prevalidación USB siguen en el servidor; la reducción de consultas no los sustituye.

Se aplica a editor, biblioteca, preferencias, cuentas, gestión, colegio, cursos, revisión y salida. La salida conserva su aviso de operación en curso cada diez segundos para impedir escrituras de otra pestaña mientras se revisan copias; ese aviso no es una consulta de sesión por foco.

## Correcciones encontradas al verificar

- Si falla el almacenamiento, el aviso no debe tapar Exportar. Se agrupan esos avisos fuera de los controles superiores; una prueba impone un límite de cinco segundos para poder iniciar la exportación, sin esperar al chequeo periódico.
- Con texto al 200 %, la cabecera de bloques podía desbordar en móvil según la fuente del sistema. Las acciones ahora pueden pasar a otra línea, sin ocultarlas ni reducir tipografía. Además, Conectar y otros botones con texto heredaban un ancho fijo pensado para íconos: el texto sobresalía aunque su caja quedara dentro de la pantalla. Se retiró esa limitación y se comprueba también que las etiquetas quepan dentro de cada botón, incluidas Guardar/Mis proyectos/Exportar/Armar escena.
- Deshacer de escena: una primera muestra sin movimiento efectivo, por ajuste a cuadrícula, abría antes un grupo sin conservar estado inicial. `commitSnapshot` ahora abre un grupo sólo al cambiar el documento. Regresión unitaria y caso real de arrastre ampliado.
- CI detectó `sharp@0.35.2` transitivo de Miniflare. Override acotado a **0.35.4**, con precompilados/libvips correspondientes; no se utilizó `audit fix --force` ni se actualizaron Wrangler, Vite, Blockly o toolchains de placas. [Aviso del mantenedor](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c). `npm audit` local volvió a cero vulnerabilidades conocidas. Revisar/retirar el override cuando Miniflare incorpore una versión corregida equivalente.

## Verificación y despliegue

Medición comparable con Chrome, viewport 1366 × 768, mismo ejemplo/fixture y sin paneles expandidos:

| Versión | Inicio del área de trabajo | Altura de bloques/escena | Porcentaje de altura |
| --- | --- | --- | --- |
| Antes, `14c4dcc` | 346,4 px | 421,6 px | 54,9 % |
| Después, `f9afdd5` | 121 px | 619 px | 80,6 % |

Ganancia: 197,4 px y 25,7 puntos porcentuales, sin reducir el zoom de Blockly para obtener la cifra. La versión anterior se midió en un checkout histórico local y servidor temporal separado, ya detenido; **no se presentó como prueba de DEV**. La versión posterior se midió sobre DEV por su túnel. Reproducible con `CAPIBLOQUES_MEASURE_LAYOUT=1`, `PLAYWRIGHT_BASE_URL` explícito y `tests/layout-measurement.spec.ts`.

[Captura anterior](assets/phase12-before.png) · [Captura posterior](assets/phase12-after.png). Sólo fixtures sintéticos; no son cuentas ni proyectos reales de alumnos.

Las capturas y pruebas de interfaz usan cuentas/proyectos **sintéticos interceptados por Playwright**, no datos reales. La salud de API se consulta aparte sin mocks; CI prueba Django/PostgreSQL en entorno separado. No atribuir estos ensayos a una placa física.

Evidencia durante el cierre:

- Tipos, lint, siete grupos smoke y build correctos en `f72b820`; 10 páginas estáticas verificadas y cero vulnerabilidades conocidas en `npm audit`. El aviso de chunks grandes permanece como advertencia, no se elevó el umbral para ocultarlo.
- Regresión amplia Chrome/Edge sobre `f9afdd5`: 174 correctas y dos fallos del mismo caso de autoguardado, cuya prueba aún esperaba la cadencia anterior. Tras adaptar el reloj de la prueba a 60 segundos y corregir Exportar, **54/54 correctas sobre `f72b820`**, sin reintentos: acceso, autoguardado y mesa de trabajo.
- CI `34288613908` sobre `f72b820`: backend, siete Arduino y siete ESP-IDF correctos; UI 167 correctas y cinco fallos. Tres eran selectores antiguos (dos recorridos del botón Conectar y un visor ahora con dos lienzos accesibles); dos detectaron desborde móvil. `05fc446` corrige selectores y cabecera sin quitar pruebas ni relajar timeouts/reintentos. Estos CI fallidos no se presentan como aprobación global.
- Sobre **`05fc446`: 84/84 correctas en Chrome/Edge** contra DEV, sin reintentos. Sin embargo, CI Linux `34289878161` conservaba dos fallos móviles (171 correctas). El diagnóstico rápido `d3d1fcd` identificó texto sobresaliendo de botones de ancho fijo; `0c75ca9` y `63c96b2` lo corrigen. Por eso los resultados Windows no se usan como sustituto de CI Linux.
- Regresión amplia sobre **`63c96b2`: 124/124 correctas en Chrome/Edge**, sin reintentos: acceso, autoguardado, mesa de trabajo, móvil/fuentes, programación, compilación/Wi-Fi, revisión docente y salida.
- La prueba de scroll móvil detectó además superposición de las dos barras fijas; `668be43` deja fija sólo la barra de ejecución al bajar a la escena. No interrumpir pruebas para desplegar; el mantenimiento actual sigue la operación de fase 13 y después se comprueba la nueva versión.
- Sobre **`668be43`: 46/46 correctas en Chrome/Edge**, sin reintentos, contra DEV: desplazamiento móvil con Ejecutar/Detener alcanzables, cámara/catálogo/Wemos/sesiones, tipografía, programación y salida segura.
- **CI final completo correcto:** [34291829169](https://github.com/ncvicchi/capibloques/actions/runs/34291829169), commit `668be43832c99b23f09295f8356d44d1c495503b`, cuatro jobs aprobados. Dos regresiones rápidas y **174/174 pruebas Chromium**; **179 pruebas backend**, preparación de secretos y persistencia tras recreación en CI; siete Arduino y siete ESP-IDF nativos. Tipos/lint, núcleo, drivers, USB, aislamiento, auditoría y build correctos; 10 páginas estáticas verificadas. No hubo casos flaky en el reporte final.

CI comprueba primero las dos regresiones de texto ampliado, sin reintentos, y luego mantiene la batería completa original. Si falla conserva `test-results/` como artefacto `ui-diagnostics` durante tres días: capturas/trazas de fixtures sintéticos, nunca datos reales de usuarios. Los mensajes de fallo incluyen geometría de viewport para distinguir caja y texto desbordado.

Implementación inicial `6143bbe`, refinamiento visual `4955c59`, cuadrícula/dependencia `0aae1b7`, conexiones/pruebas `f9afdd5`, Exportar `f72b820`, móvil/selectores `05fc446`, diagnóstico `d3d1fcd`, anchos de botones `0c75ca9`/`63c96b2` y scroll móvil `668be43`. La operación de ese cierre detenía el editor Node y actualizaba dependencias dentro de su contenedor limitado; API/DB y compilador no se recrearon para esta fase. **Esa receta fue sustituida por fase 13**: el Nginx actual no contiene Node y su arranque se coordina con systemd/firewall. Seguir la [operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente), sin iniciar `editor` manualmente.

Despliegue de aplicación únicamente en DEV, checkout limpio en `668be43`; editor/API/DB saludables, planificador activo y salud `ok` por VM y túnel. PRD, gateway, Proxmox, router y Nginx no se modificaron. Sesión administrativa cerrada; se conserva sólo el túnel de navegación normal. GitHub Pages/Sites siguen sin usarse. El commit documental de cierre no cambia el código verificado ni requiere otro despliegue.

## Qué queda fuera

La aceptación física de fase 10 continúa abierta. El acceso externo persistente a DEV se entregó después en [fase 13](FASE_13_ACCESO_EXTERNO_DEV.md). Paralelo vertical, programa estático y progreso dentro de bloques pasaron a fase 14; TX/RX, S3/Waveshare y display interactivo siguen en fases 15–18. Las fases 14–18 requieren autorización de ejecución. Fase final de producción postergada.

## Recorrido breve para el propietario

1. Ingresar en [DEV por HTTPS](https://capibloques.dev.nvicchi.com/); el túnel habitual queda para recuperación. Comprobar las dos filas superiores y abrir/cerrar una categoría con «Cerrar catálogo» o Escape; arrastrar un bloque al programa.
2. En Escena, probar +/−, Mano y Ajustar; ejecutar, pausar y volver desde Estado sin perder el encuadre. Para zoom accesible de toda la página siguen funcionando los controles del navegador.
3. En Armar escena, ampliar, mover un componente, Deshacer/Rehacer y Guardar o Cancelar. Navegar sin mover componentes no agrega cambios pendientes.
4. Abrir Conectar, elegir un componente en «Resaltar conexiones de» y comparar sus pines con el listado. Esto no confirma automáticamente los requisitos eléctricos ni habilita grabar un circuito no revisado.
5. Cambiar varias veces de ventana y volver: no debe aparecer una validación por cada regreso. La sesión se sigue comprobando periódicamente y cada acción remota conserva sus permisos.

No hace falta una placa para este recorrido. Usar una copia de un proyecto si se desean ensayar cambios de escena; no borrar proyectos reales como prueba.
