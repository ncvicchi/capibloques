# Fase 42 — Simplificación integral de la interfaz

Estado al 4 de octubre de 2026: **entregada en software; actualización y
aceptación visual en DEV pendientes**.

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

Ejemplos, exportación JSON, copia local, importación y herramientas para adultos
se reúnen en **Proyecto**. Guardar, Mis proyectos, estado de guardado, nombre,
cuenta y avatar siguen visibles porque responden preguntas distintas y
frecuentes: qué estoy haciendo, si está guardado y dónde lo recupero.

## Inventario de acciones

| Lugar | Siempre visible | Visible según contexto | Bajo demanda |
| --- | --- | --- | --- |
| Proyecto | nombre, Guardar, Mis proyectos y estado | errores de guardado | ejemplos, JSON, copia local, importar y herramientas adultas |
| Trabajo | Crear, Probar, destino, Ejecutar/Pausar, Paso y Usar en placa | Detener durante una ejecución; Detalles de placa al conectarse | Reiniciar, velocidad, código y conexiones |
| Programa | pestañas, Deshacer, Rehacer y Centrar | catálogo de la categoría elegida | ayuda y menú contextual de bloques |
| Escena | escena, Estado/Consola y Armar escena | controles de entradas y progreso del objeto | cámara, propiedades y cableado detallado |
| Cuenta | avatar y menú de cuenta | estado offline o sesión revocada | preferencias, sonido, gestión por rol y salir |

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

Actualizar DEV y comprobar con el propietario el recorrido cotidiano a tamaño
real: crear, probar, detener, guardar, abrir un proyecto y usar una placa. La
aceptación debe confirmar que Proyecto y Más resultan descubribles para chicos
de 8 a 12 años. Si una opción importante no se encuentra, se ajusta su entrada;
no se vuelve a exhibir toda la funcionalidad simultáneamente.
