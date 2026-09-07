# Fase 6 — Experiencia y programación

Autorizada el 7 de septiembre de 2026. Implementación integrada en DEV; **verificación y cierre pendientes**. No habilita las fases 7–11.

## Funciones

- Avatares SVG originales: 15 animales, robots, personajes y plantas. No hay fotos ni servicios externos. Galería por categorías, vista previa, Guardar/Cancelar, conflicto explícito y selección por cuenta. Elegir avatar es opcional.
- Favoritos de tipos de bloque como primera categoría. El orden es el de selección, no cambia con el uso. El selector conserva el borrador ante fallos; Cancelar no modifica preferencias. Las preferencias viven en PostgreSQL, nunca incluyen IDs de componentes de un proyecto.
- Un único «Al comenzar», obligatorio, móvil pero no borrable ni duplicable. No está en las categorías. Su protección es una regla del editor, no una edición del documento al abrirlo.
- «Al mismo tiempo» admite 2–16 caminos. Para reducir caminos hay que vaciarlos antes: nunca se borran acciones como efecto de cambiar la cantidad. Los bloques posteriores esperan a TODOS los caminos; uno infinito impide continuar debajo. Se permiten hasta 32 tareas estáticas y 4 niveles de paralelo.
- Al abrir varios inicios antiguos se conserva el primero y se reúnen las acciones en caminos, manteniendo IDs y orden de Blockly. Un paralelo único en la raíz conserva el presupuesto y orden del planificador antiguo. El archivo original y las revisiones guardadas no se reescriben. Guardar conserva la conversión en una revisión nueva. Los bloques sueltos no se conectan automáticamente.
- Simulación normal y guiada comparten instrucciones, orden, presupuestos y reloj lógico con el generador Arduino. «Paso» muestra acciones, condiciones, vueltas, esperas y finalización. El modo guiado espera a que la interfaz presente cada cuadro; el historial tiene un máximo de 30 eventos. Las pausas visuales no se insertan en el firmware.
- Panel «Ahora», caminos listos/esperando/terminados, tiempo restante, resaltado de bloques y componentes, seguimiento opcional y acceso a los últimos eventos. Editar bloques detiene la ejecución anterior; Ejecutar/Paso usa el programa actualizado. También disponible en revisión docente, sin escribir en el original.

## Persistencia y permisos

`GET/PATCH /api/auth/preferences/` exige cuenta fresca y precondición de identidad; PATCH además CSRF, campos/catálogos permitidos y versión optimista. Las preferencias no cambian roles, contraseña ni época de sesión. Un reintento idéntico no duplica la versión. Conflictos entre pestañas conservan la selección hasta una elección explícita. Las señales entre pestañas no transportan datos personales.

Migraciones `accounts.0003_preferences` y `0004_empty_favorites` aditivas. La segunda permite validar una cuenta nueva sin favoritos. No se cambiaron contraseñas ni usuarios reales como prueba.

Respaldo previo en DEV, privado y fuera del checkout: `pre-phase6-preferences-20260907.dump`; verificada su existencia y catálogo, no se hizo una restauración ni copia externa. No confundir esto con la prueba de restauración de producción de la fase 11.

## Evidencia provisional

- 162 pruebas backend pasan en DEV; PostgreSQL de prueba separado de los datos reales.
- Typecheck, lint, smoke y build locales pasan en la implementación integrada.
- Nuevo smoke compara trazas normal/guiado; verifica fork/join, anidación, reuso en bucles, tiempos de programas antiguos, límites, backpressure y cambio de modo.
- Fixtures Arduino ampliados con fork/join y reinicio de estado de bucles/Wi-Fi; falta confirmar compilación real del cierre.
- Chrome: selección de avatares, conflictos, cortes, revocación y favoritos ya pasaron. Integración completa/Edge y correcciones de regresión pendientes.
- CI encontró una marca de edición falsa por persistir la protección del inicio y un desborde móvil del botón de cerrar todas las sesiones. No se dará la fase por terminada hasta verificar las correcciones y la regresión.

## Validación de entrega

Una vez cerradas las pruebas: probar con una cuenta propia Guardar/Cancelar avatar y favoritos; importar un proyecto antiguo de varios inicios; ejecutar semáforo/robot en paralelo y observar Paso/Guiado; guardar, recargar, exportar y volver a importar. No usar cuentas ni proyectos reales para probar bajas, purgas o pérdida de datos.

No incluye displays nuevos, ESP-IDF, servidor compilador, USB, control físico en vivo ni publicación en producción.
