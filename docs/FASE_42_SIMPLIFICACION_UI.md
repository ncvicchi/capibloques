# Fase 42 — Simplificación integral de la interfaz

Estado al 14 de octubre de 2026: **entregada en software y desplegada en DEV
en `9e3d0b9`; aceptación visual y de uso pendiente**.

## Resultado

El editor conserva sus dos filas globales, pero deja de presentar todas las
acciones como igualmente importantes. La segunda fila organiza el trabajo en
dos modos comprensibles para un alumno: **Crear** y **Probar**. Cambiar de modo
no altera el proyecto ni reinicia la simulación; asigna más ancho al programa o
a la escena según la tarea. Ejecutar o avanzar un paso selecciona Probar de
forma natural.

La acción **Usar en placa** continúa siempre visible. Cuando existe una
ejecución física se convierte en **Detalles de placa** y conserva el mismo
asistente. Ejecutar/Pausar, Paso y, mientras corresponde, Detener permanecen en
la fila principal. Reiniciar, velocidad, código y conexiones están en **Más**.
Así no compiten permanentemente con la acción actual, pero siguen a dos gestos
como máximo y son operables con teclado.

Ejemplos, **Mis proyectos**, exportación JSON, copia local, importación y
herramientas para adultos se reúnen en **Proyecto**. Guardar, estado de guardado,
nombre y cuenta siguen en la barra; el avatar se ubica en la esquina inferior
derecha y el saludo con el nombre de la cuenta ya no aparece.

## Inventario de acciones

| Lugar | Siempre visible | Visible según contexto | Bajo demanda |
| --- | --- | --- | --- |
| Proyecto | nombre, Guardar y estado | errores de guardado | Mis proyectos, ejemplos, JSON, copia local, importar y herramientas adultas |
| Trabajo | Crear, Probar, destino, Ejecutar/Pausar, Paso, Usar en placa, Deshacer, Rehacer y Centrar | Detener durante una ejecución; Detalles de placa al conectarse | Reiniciar, velocidad, código y conexiones |
| Programa | pestañas | catálogo de la categoría elegida, con escala fija 0,72 | ayuda y menú contextual de bloques |
| Escena | escena, Estado/Consola y Armar escena | controles de entradas y progreso del objeto | cámara, propiedades y cableado detallado |
| Cuenta | avatar en la esquina inferior derecha y menú de cuenta | estado offline o sesión revocada | preferencias, sonido, gestión por rol y salir |

Las pantallas administrativas permanecen fuera del editor. Los asistentes de
escena, placa, guardado/recuperación, errores y herramientas avanzadas siguen
siendo modales secuenciales: esta fase cambia su entrada y prioridad, no elimina
confirmaciones ni mezcla sus decisiones en la mesa principal.

## Reglas de interacción

- **Crear** prioriza el lienzo de bloques; **Probar** prioriza la escena. En
  pantallas angostas ambas superficies se apilan y no se fuerza un ancho
  imposible.
- El control principal cambia con el estado: Ejecutar, Pausar o Reanudar. Paso
  permanece descubrible; Detener sólo ocupa lugar mientras hay algo activo.
- Las opciones ocultas no dependen de iconos sin nombre. Los disparadores se
  llaman Proyecto y Más, tienen nombre accesible y los menús están agrupados.
- No se modifican JSON, historial, autoguardado, cámara, programa compilado ni
  reglas al cambiar el foco Crear/Probar.
- No se quitan advertencias ni confirmaciones de reemplazo, cableado, permisos o
  sesión para conseguir una interfaz aparentemente más simple.

## Evidencia

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run test:smoke`: correcto, incluidos contratos de componentes,
  simulador, CapiRules, pestañas y mesa de trabajo.
- `npm run build`: correcto; diez páginas estáticas verificadas.
- Prueba E2E específica de divulgación progresiva, anchos Crear/Probar y
  cobertura de menús: correcta en Chromium, Google Chrome y Microsoft Edge.
- Los recorridos afectados de guardar, biblioteca, perfiles de placa,
  compilación y cableado fueron adaptados al nuevo acceso. La ejecución masiva
  local conserva fallos antiguos de casos que importan sobre un editor ya
  modificado sin resolver primero el diálogo obligatorio de reemplazo; no son
  evidencia de retirar esa protección.

## Pendiente de aceptación

DEV quedó actualizado en `9e3d0b9`. Comprobar con el propietario el recorrido
cotidiano a tamaño real: crear, probar, detener, guardar, abrir un proyecto y
usar una placa. La aceptación debe confirmar que Proyecto y Más resultan
descubribles para chicos de 8 a 12 años. Si una opción importante no se
encuentra, se ajusta su entrada; no se vuelve a exhibir toda la funcionalidad
simultáneamente.

## Pulido adicional de la barra del editor — 14 de octubre de 2026

Se agregaron ocho ajustes autorizados, cada uno en un commit funcional propio:

- Catálogo de bloques a escala fija `0,58` y ancho fijo de 148 px.
- Avatar superpuesto al aviso de estado inferior.
- Retiro de la etiqueta de placa «Wemos» del encabezado.
- Lápiz colocado a la derecha del nombre editable del proyecto.
- Guardar y el destino/estado del proyecto colocados junto al nombre.
- Fondo de color por categoría en las etiquetas del catálogo.
- Categorías ocultas en **Probar** y visibles otra vez en **Crear**.
- **Detener** vuelve a **Crear**; **Pausa** mantiene la vista elegida.

Commits: `688f6d0`, `1e023bd`, `c9ef77d`, `f6aa0d8`, `ac2fb2a`, `7f7f365`,
`aeaa863` y `90b2ea8`. `git diff --check` pasó. No se ejecutaron pruebas ni
despliegue remoto para esta actualización. El DEV continúa en `9e3d0b9` hasta
que el propietario ejecute el orquestador habitual. La aceptación visual de
estos ajustes queda pendiente después de desplegarlos.

## Pulido complementario — 5 de octubre de 2026

Se ampliaron las acciones de avatar y se nombraron **Seleccionar Avatar** y
**No cambiar mi avatar**; los bloques Wi-Fi muestran «segundos» completo. El
zoom del programa conserva fijo el tamaño de los bloques del catálogo y la
papelera se marca en rojo cuando Blockly indica que un bloque arrastrado está
encima. Las operaciones originales de selección, cancelación, conexión, espera,
zoom y borrado siguen usando sus mismos manejadores.

Verificación de esta entrega: lint de los componentes modificados y la prueba
de humo general correctos; `scripts/wifi-messages.test.mjs` y
`git diff --check` correctos. El chequeo global de TypeScript no se pudo validar
con el compilador disponible: además de una opción de imports `.ts` ausente en
la primera ejecución, la ejecución ajustada marcó numerosos
`@ts-expect-error` preexistentes como no utilizados. En ese momento no se
actualizó DEV; la aceptación visual y de uso indicada arriba sigue pendiente.

## Ajustes de barra y ejecución — 14 de octubre de 2026

«Mis proyectos» se abre desde el menú **Proyecto**; su botón independiente se
retiró. El avatar ahora es un control flotante en la esquina inferior derecha,
sin el saludo con el nombre de la cuenta en la barra superior. El catálogo
conserva tamaño independiente del zoom del programa y usa escala fija `0,72`.
Se retiró el encabezado «Programa visual» y Deshacer/Rehacer/Centrar se movieron
junto a «Usar en placa». Mientras corre una ejecución, **Pausar** usa fondo
amarillo anaranjado con texto negro y **Detener** fondo rojo con texto blanco.

Los cambios se separaron en commits; el último funcional es `9e3d0b9` y DEV
quedó saludable con ese commit. Typecheck, lint dirigido y pruebas de workbench
y ergonomía pasaron. El recorrido visual/humano sigue pendiente. Tras el primer
intento de despliegue, la caché de build se limpió con autorización y el
orquestador se reanudó; la salud interna y pública respondieron `ok`, el
planificador quedó activo, admisión abierta y cola vacía. La VM conserva menos
de 2 GiB libres; la limpieza Docker informó esa advertencia y no se tocaron
imágenes activas ni volúmenes.

## Ajustes visuales solicitados — 17 de octubre de 2026

Quedó implementado localmente: modo invitado/cuenta y nombre de usuario en el
botón superior derecho, retiro del aviso alto de invitado, Capi el capibara como
avatar invitado predeterminado, efecto hover para botones, controles de Blockly
al frente, escala fija del catálogo al abrir categorías o cambiar zoom, zoom
inicial del programa de `0,9` a `0,8`, menú Proyecto con estilo de acción
principal, y Deshacer/Rehacer/Centrar con texto. Se quitó la franja «Mi escena»;
Armar escena comparte ahora la fila de pestañas Escena/Estado/Consola/Ejecución.
Las etiquetas del catálogo medían **13 px** y, tras consultar al propietario,
se redujeron a **12 px**.

Pasaron lint dirigido, typecheck, `scripts/workbench.test.mjs`,
`scripts/scene-worlds.test.mjs`, build de producción y verificación de las diez
rutas estáticas. `git diff --check` también pasó. La suite smoke completa se
detuvo en `frame-animation.test.mjs`: este entorno no tiene `g++` y el proceso
de compilación devolvió `status=null`; por eso no se ejecutaron los casos
posteriores de esa secuencia. DEV aún no se actualizó con este cambio. La
revisión visual de estos ajustes y su aceptación siguen pendientes.
