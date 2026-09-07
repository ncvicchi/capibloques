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

## Evidencia de la implementación

- 162 pruebas backend pasan en DEV; PostgreSQL de prueba separado de los datos reales.
- Typecheck, lint, smoke y build locales pasan en la implementación integrada (`20ebe7f`). El build verifica nueve páginas estáticas y sus assets. Sigue la advertencia conocida, no bloqueante, de chunks superiores a 500 kB.
- Nuevo smoke compara trazas normal/guiado; verifica fork/join, anidación, reuso en bucles, tiempos de programas antiguos, límites, backpressure y cambio de modo.
- CI de `20ebe7f`: [ejecución 34165513731](https://github.com/ncvicchi/capibloques/actions/runs/34165513731), correcta. 162 pruebas backend, 138 de interfaz Chromium sin casos flaky; tipos, lint, smoke, auditoría npm y build estático.
- Compilación real en ese CI de los dos fixtures ampliados con fork/join y reinicio de estado de bucles/Wi-Fi, usando Arduino-ESP32 3.3.11 y `esp32:esp32:d1_uno32`. Memoria de programa: 897707 y 281443 bytes; datos globales: 45700 y 22352 bytes. Son programas de prueba, no una medida de todos los proyectos posibles ni una prueba física en placa.
- Contra la VM DEV actualizada: 20/20 pruebas de preferencias e inicio/paralelo/pasos, diez en Chrome y diez en Edge, sin reintentos (1,9 min). Incluyen guardar/cancelar/recargar, conflictos y respuesta perdida, revocación, favoritos, arrastre con deshacer/rehacer, conversión de proyectos antiguos y móvil 390 px con texto al 200%.
- Corregidos y verificados en CI/Chrome/Edge: marca de edición falsa por persistir la protección del inicio, desborde móvil de acciones de cuenta y desplazamiento horizontal de todo el editor al abrir Exportar. El panel distingue Detenido/Terminado y no deja componentes aparentando ejecución. El selector de velocidad normal se deshabilita en Guiado; no cambia el reloj lógico.
- Las pruebas UI usan identidades y respuestas sintéticas dentro de Playwright; las pruebas backend comprueban permisos, conflictos y persistencia en PostgreSQL real de prueba, separado de los datos de DEV. No se cambiaron credenciales ni proyectos reales como prueba.

## Validación de entrega

1. En **Mi cuenta → Elegir avatar**, seleccionar un personaje y cancelar; comprobar que no cambió. Repetir con Guardar y recargar.
2. En la primera categoría **★ Favoritos → ☆ Elegir favoritos**, marcar Semáforo y Esperar. Guardar y comprobar que ambos aparecen allí. Cancelar otra selección no modifica lo guardado.
3. Usar el único **Al comenzar**. Agregar **En paralelo → Al mismo tiempo** y colocar acciones en sus caminos. Lo conectado debajo sólo corre cuando terminaron todos. Para quitar un camino ocupado primero hay que mover sus bloques.
4. Elegir **Guiado: ver cada paso**. **Paso** avanza con cada clic; **Ejecutar/Reanudar** presenta los pasos automáticamente. Revisar «Ahora», el estado de los caminos y «Últimos pasos». Activar «Seguir el bloque en pantalla» sólo si se desea mover la vista.
5. Guardar, recargar, exportar JSON y volver a importarlo. Un archivo antiguo con varios inicios se abre con un solo inicio y sus acciones en caminos; el archivo original no se sobrescribe.

No hace falta conectar una Wemos para validar esta fase. No usar cuentas ni proyectos reales para probar bajas, purgas o pérdida de datos.

No incluye displays nuevos, ESP-IDF, servidor compilador, USB, control físico en vivo ni publicación en producción.
