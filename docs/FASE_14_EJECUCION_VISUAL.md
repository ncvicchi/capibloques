# Fase 14 — Ejecución visual y paralelo vertical

Actualización: **12 de septiembre de 2026**. Autorización del propietario: **«Vams con el 14 pues»**. Código funcional publicado en `897c6e0`; el estado de despliegue y la revisión servida se registran al cerrar la entrega.

## Resultado

«Al mismo tiempo» conserva un solo contenedor y la semántica fork/join existente. Sus caminos aparecen apilados de arriba hacia abajo como **Camino 1, Camino 2…**, cada uno con su conexión de sentencias. Agregar, quitar, importar, deshacer y rehacer conservan `BRANCH0…BRANCH15` y el formato JSON anterior.

Durante la simulación cada tarea expone un estado transitorio con identidad de camino, bloque activo, espera, duración y vuelta de bucle cuando existe. El editor lo muestra junto al bloque mediante borde de color, rótulo, segundos restantes y barra proporcional. Caminos concurrentes usan colores distintos. Una acción sobre un dispositivo muestra también su explicación junto al componente de la escena.

La cabecera compacta informa sólo estado global, reloj y cantidad de caminos activos. El detalle de trazas continúa disponible bajo demanda para accesibilidad y diagnóstico. El seguimiento automático fue retirado: **Centrar el último bloque** y cada entrada de la traza son acciones manuales.

## Contratos conservados

- El resaltado no invoca `centerOnBlock`, `zoomToFit` ni modifica el transform de Blockly. Ejecutar, pausar, avanzar y cambiar velocidad conservan la cámara del programa; sólo una acción manual centra.
- El progreso usa el reloj virtual del worker. Pausa congela número y barra; velocidad cambia el avance real sin alterar orden ni tiempo lógico; normal y guiado producen la misma traza.
- Cada tarea se identifica por su `taskId`. Las esperas y vueltas se calculan dentro de esa ejecución; no se comparte un contador visual global entre caminos.
- Los indicadores son nodos SVG efímeros agregados después de serializar el workspace. No entran al proyecto, autoguardado, historial, favoritos ni firmware. Stop, Reset, fin de programa y cambio de proyecto los retiran.
- Una acción sin duración conocida muestra estado o resultado local, sin porcentaje inventado. La barra sólo existe cuando el worker conoce duración y tiempo restante.
- El doble `requestAnimationFrame` que confirma `FRAME_SHOWN` permanece montado en `ExecutionPanel`; el modo guiado conserva su backpressure.
- Movimiento reducido desactiva transición y animación de los indicadores. Los rótulos se anexan al nombre accesible del bloque sin usar una región viva de alta frecuencia.

## Verificación local

Se usaron proyectos y cuentas sintéticos; no se borraron proyectos ni se usaron claves reales.

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto |
| `npm run lint` | Correcto |
| `npm run test:smoke` | Correcto: contratos generales, worker, fork/join, paridad normal/guiado, displays, historial, autoguardado y mesa |
| `npm run build` | Correcto: build Vinext y 10 páginas estáticas verificadas |
| Playwright completo, Chromium, `--workers=2` | 174/175 en la primera corrida; el único fallo leyó 20 ms de avance antes del ACK de pausa. Se agregó la espera explícita del estado «Programa en pausa» y el caso pasó aislado. El código de aplicación no cambió después de esa corrida. |
| Playwright afectado, Chrome + Edge, un worker | 4/4: paralelo editable y progreso por camino en ambos navegadores |
| Revisión visual | `parallel-desktop.png` y `parallel-progress-reduced-motion.png`: caminos verticales, dos rótulos/colores, número y barra legibles, sin cambio del transform del lienzo |

La prueba nueva cubre dos delays diferentes, un bucle, colores por hilo, pausa estable, exportación sin `remainingMs`, transform de Blockly idéntico y limpieza total después de Stop. La prueba de worker cubre además atribución de bloque, duración por camino, vuelta 1/2 y congelamiento por reloj lógico. Las pruebas anteriores conservan condiciones, contador compartido, join, bucles anidados, traza acotada y equivalencia normal/guiado.

## Operación y límites

Esta fase sólo cambia frontend, worker y pruebas; no agrega migraciones, dependencias, endpoints ni cambios de firmware. El runtime DEV se actualiza con `capibloques-dev-runtime deploy`, manteniendo API/base y el compilador fuera del build según la [operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente).

La ejecución visual representa la simulación del navegador. No sigue un firmware físico ni cambia la lógica cooperativa generada para Arduino o ESP-IDF. La aceptación física de fase 10 continúa pendiente.

## Pendientes posteriores

- Fases 15–19 requieren autorización propia; producción continúa como Fase final postergada.
- El pedido de barra de desplazamiento residual del catálogo quedó registrado en el [backlog](BACKLOG.md#13-barra-de-desplazamiento-residual-del-catálogo), pendiente de priorización y fuera del alcance de esta fase.
- La Fase 19 de desafíos progresivos quedó agregada al [plan](PLAN_FASES_BACKLOG.md#fase-19--desafíos-progresivos), sin iniciar su implementación.
