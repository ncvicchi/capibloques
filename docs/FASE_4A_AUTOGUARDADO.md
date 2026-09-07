# Fase 4A: autoguardado del proyecto abierto

Entrega acotada de la fase 4. Se conserva el guardado explícito, la revisión optimista y la operación idempotente existentes. No cambia el esquema de PostgreSQL ni la API, y no habilita producción.

## Uso

1. Crear o importar el proyecto y pulsar **Guardar**. No se crean proyectos automáticamente antes de la primera confirmación del servidor.
2. Continuar editando. Con autoguardado activo, los cambios del proyecto vinculado se envían después de 1,5 segundos sin editar. La edición continua dispara un envío a los 10 segundos, sujeto a las pausas descritas debajo. El temporizador comprueba cada 250 ms; no es una garantía de latencia de red.
3. Consultar el estado junto a Guardar: sólo local, pendiente, guardando, confirmado o conflicto. Una respuesta del servidor sólo confirma la instantánea enviada, nunca ediciones posteriores.
4. **Mis proyectos → Guardar automáticamente en mi cuenta** permite desactivarlo. Se recuerda por UUID de cuenta y navegador, no entre dispositivos. Está activado por defecto; desactivarlo no cancela un envío que ya empezó. Guardar manual continúa disponible.

El editor sigue admitiendo cambios mientras guarda. No hay avisos globales repetidos por cada autoguardado: se mantiene el estado de guardado accesible. La interfaz reutiliza los controles y estilos existentes, incluyendo etiqueta asociada a la opción y navegación por teclado.

## Pausas y fallos

- No se envía mientras se arrastra con el puntero, se arma una escena, está abierta la biblioteca/confirmación de reemplazo, la pestaña está oculta, hay otra operación en curso o el acceso al editor está bloqueado. Al volver a estar disponible se atienden los cambios pendientes. Guardar/Cancelar de la escena sigue siendo explícito: el borrador de escena no se publica.
- Fallos de transporte y servidor conservan la misma operación y cuerpo en memoria, y se reintentan a los 5, 10, 20 y luego cada 30 segundos. Un evento de reconexión puede adelantar el reintento, pero no evita verificar la sesión ni los permisos.
- Rechazos 4xx pausan los envíos automáticos; no se insiste indefinidamente sobre una cuota, validación o autorización rechazada. Corregir y usar Guardar manual. Los rechazos confirmados 400/413 permiten enviar el documento corregido.
- Los conflictos se hacen visibles y requieren elegir: abrir la versión del servidor o guardar el editor como copia. Nunca se adopta silenciosamente una revisión ajena. Curso archivado o alumno retirado mantienen el original protegido; se puede continuar con una copia personal.
- Importar, Nuevo o cargar ejemplos no heredan el ID del proyecto anterior. Las respuestas tardías no pueden vincularse a otra cuenta o generación del editor. Los límites, permisos, CSRF, revisión y replay se vuelven a comprobar en servidor.

## Límites explícitos de esta entrega

**No es la fase 4 completa ni un modo offline de la aplicación.** Se conserva la copia local ya existente, pero la operación pendiente está sólo en memoria. Cerrar o recargar puede perder el dato necesario para reintentar exactamente esa operación. Si hubo una escritura con respuesta perdida, la revisión del servidor evita sobrescribirla; puede hacer falta resolver el conflicto manualmente. Antes de salir con cambios/envíos sin confirmar, reintentar o exportar JSON.

La barrera de acceso existente cubre el editor si no puede verificar la sesión. Un fallo sólo del servicio de proyectos permite seguir editando con sesión verificada; una caída total de conectividad puede bloquear el editor hasta revalidar. El autoguardado no elude esa protección.

Pendientes para 4B/4C, con nuevos OK: cola durable por cuenta/proyecto, recuperación de varios borradores y al cerrar, tratamiento de equipos compartidos/salida de sesión, borradores de escena recuperables, historial restaurable y política de purga. La auditoría no se presenta como historial. No se modifica la retención actual ni se borran cuentas/proyectos para validar.

## Validación

Validación del 7 de septiembre de 2026. Autoguardado en `85284e7`, pruebas ampliadas en `24def71` y ajuste visual final en `5d072d6`, con [CI completo aprobado](https://github.com/ncvicchi/capibloques/actions/runs/34131521008).

- Tipos, lint y smoke del editor/worker/historial más el planificador nuevo aprobados. El test del planificador comprueba debounce, plazo de edición continua, escalado de reintentos, reconexión, cambios posteriores al ACK, identidad y deshacer hasta el estado guardado.
- CI final de `5d072d6`: 77 pruebas Chromium y 118 Django/PostgreSQL aprobadas, auditoría de dependencias sin vulnerabilidades informadas, dos sketches compilados para Wemos D1 R32 y ocho rutas del build verificadas. No se probó hardware físico ni se modificaron los generadores.
- Chrome y Edge contra DEV: 48 pruebas de regresión de acceso/sesiones, biblioteca, respuestas perdidas, exportación/importación y cursos aprobadas sobre `85284e7`. Ronda final de 34 pruebas de autoguardado/biblioteca aprobada sobre `5d072d6`, sin reintentos. Las rondas se superponen: no son 82 casos diferentes.
- Inspección visual a 390 px y texto al 200 %: opción y salida accesibles en ambos navegadores. La prueba ampliada encontró que el selector nativo excedía su columna. Se corrigió el dimensionado de los filtros para envolver según el tamaño del texto, sin ocultar contenido ni aumentar tolerancias. Las capturas y la prueba final confirman ausencia de desborde y acceso a Volver al editor.
- DEV se actualizó deteniendo sólo editor antes de `git pull --ff-only` y esperando salud al iniciarlo. No hubo migraciones ni reinicio de API/DB. Se conservan datos, cuentas y secretos; no se tocó PRD, gateway, Nginx ni Pages. No es una prueba de carga de una clase.
- Comprobación final DEV: `check` sin problemas y `migrate --check` aprobado; los tres servicios saludables, sin OOM ni reinicios automáticos. Observación al terminar las pruebas: aproximadamente 64 MiB API, 26 MiB PostgreSQL y 896 MiB editor, dentro de sus límites existentes.

Los contratos UI usan sesiones/respuestas sintéticas sólo en Playwright. Los contratos manuales anteriores desactivan expresamente la preferencia de autoguardado para seguir verificando ese modo; la suite nueva prueba el valor predeterminado activado. No existe bypass de autenticación en el producto.

## Punto de control del propietario

1. Guardar un proyecto de prueba, cambiar nombre o bloques y esperar el estado **Guardado en tu cuenta** sin pulsar Guardar otra vez. Abrirlo desde Mis proyectos en otro navegador autenticado.
2. Desactivar la opción y comprobar que vuelve a requerir Guardar; recargar y comprobar que la opción se recuerda.
3. Armar una escena y Cancelar: no debe publicarse ese borrador. Guardar la escena y comprobar que luego se guarda el proyecto.
4. Abrir el mismo proyecto en dos pestañas, modificarlo en una y luego en la otra: revisar el conflicto y guardar una copia, sin pisar el original.

Detenerse al entregar esta subfase y pedir validación. No iniciar recuperación durable ni historial sin otro OK.
