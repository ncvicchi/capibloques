# Fase 59 — Posturas por ángulos de GorillaBot

## Alcance acordado

El propietario aprobó primero posturas por ángulos. Las trayectorias físicas
por coordenadas del pie quedan **pendientes hasta tener medidas reales**.
No se implementan IK, recorridos cartesianos, marcha, equilibrio, teleoperación
ni nuevos perfiles. No se inventan longitudes a partir de la ilustración58.

Rama `codex/fase-59-gorillabot-posturas`, creada desde origin/dev1
`d8f33ed9ac36da7a4ea67db5cd67479f369110a3`. Fase58 confirmada en dev1
por el propietario; no es prueba independiente de hardware. No operar main/dev2,
ni actualizar servidores automáticamente. [Plan58–64](PLAN_GORILLABOT_EVOLUTIVO.md).

## Modelo y reglas

- Una postura contiene ID estable, nombre propio (1–40 caracteres) y ocho
  ángulos enteros respecto de los centros calibrados, de −20° a +20°.
  Orden DI A/B, DD A/B, TI A/B, TD A/B. El mismo convenio que58.
- Biblioteca opcional `config.postures` del componente gorilla. Hasta16,
  nombres e IDs únicos. Un proyecto58 sin biblioteca conserva Referencia
  (ocho ceros); una biblioteca explícitamente vacía no repone una retirada.
  El JSON portable, guardado servidor, revisión e historial la conservan.
- Los ocho objetivos deben respetar centro, inversión y mínimo/máximo de cada
  motor. Rechazo íntegro, sin recorte silencioso. Cambiar calibración obliga
  a corregir posturas incompatibles antes de guardar la escena.
- Una transición usa un tiempo común (pedido200–10000ms), ampliado si hace
  falta para no superar30°/s en ningún motor. Interpolación lineal de ángulos:
  **no significa trayectoria recta del pie**. Las escrituras I2C son secuenciales,
  no un disparo eléctrico simultáneo de ocho canales.
- Un solo movimiento por robot. Órdenes concurrentes esperan el recurso, no
  sustituyen objetivos a mitad de transición; no se promete FIFO entre hilos.
  El hilo dueño espera; otros procesos no relacionados continúan.
- Pausa congela reloj, Paso usa el dueño existente y Detener cancela el recorrido
  conservando la última orden, sin desenergizar ni volver físicamente a cero.
  Reiniciar restablece la simulación; no acredita posición real de los servos.

Preparar conserva58: inicia el controlador sin centrar los ocho motores.
No existe lectura de posición: al encender, la referencia software no indica
dónde está cada servo. La primera orden puede moverse desde una posición física
desconocida. Robot sostenido, calibración adulta y mecanismos desacoplados si
corresponde antes de cualquier prueba; límites angulares no certifican ausencia
de colisiones, apoyo, equilibrio ni esfuerzos del mecanismo.

## Recorrido de uso

Armar escena → seleccionar GorillaBot → **Editar posturas**.
Modal amplio con nueva/duplicar, nombre, ocho campos por pata, eliminar con
confirmación, selección de pata y representación articulada ilustrativa.
Deshacer/Rehacer local (60 cambios), guardar/cancelar; cierre con cambios pide
confirmación. Guardar posturas sólo aplica al borrador del componente: después
Guardar cambios y Guardar escena, con el historial habitual de escena.

La vista previa es sólo local y nunca abre USB. Permite Ver desde referencia,
pausa/continuación y muestra porcentaje/duración efectiva; no escribe estados
iniciales de hardware en el JSON. Referencia es la única postura implícita.
No se publican “De pie”, “Agachado” o “Saludo” como posiciones mecánicas seguras.
Podrán crearse por nombre tras validar el montaje.

Nuevo bloque en Movimiento: **ir a postura [nombre] en [segundos]**. Sus
referencias usan IDs: renombrar no rompe llamadas; retirar una postura deja una
opción advertida y un diagnóstico bloqueante, nunca elige otra en silencio.
Los bloques58 de motor/par y los valores j0..j7/ready/moving/error se mantienen.
El banco identifica una postura coincidente cuando se detiene; son órdenes,
no sensores. Mover un motor a otra posición muestra posición personalizada.

## Ejemplos completos

1. **GorillaBot: explorar posturas**. Preparar, Referencia y tres ciclos de
   Motores A +8°, Motores B −8°, Referencia. Pausas y transición de2s.
2. **GorillaBot: posturas con procedimientos**. Mismo comportamiento, cuatro
   procedimientos y tres pestañas Principal/Secuencia/Posturas; Explorar posturas
   llama a las tres tareas de movimiento. Ambos terminan en Referencia.

Son ejercicios de banco sostenido, no posturas de apoyo comprobadas. Los dos
ejemplos58 siguen disponibles sin modificaciones.

## Firmware y compatibilidad

Intérprete **1.12.0**, ABI/formato1. Nueva acción `gorilla/posture` lleva ocho
ángulos resueltos; capacidad `gorilla-postures` además de `gorilla-bench`.
Firmware viejo debe actualizarse antes de aceptar reglas con posturas.
La biblioteca de edición no añade un evaluador de nombres en el robot.
Validación de tamaño, enteros y rangos también en firmware; límites físicos
revalidados por el motor común C++ entre intérprete y Arduino/ESP-IDF.

Sin migraciones ni dependencias. Se reconstruye la aplicación del intérprete
incrementalmente para los perfiles existentes; conservar objetos SDK y cachés.
Sin renderer GorillaBot Waveshare: ese destino continúa bloqueado.

## Validación y pendiente explícito

- Tipos/lint, build estático, smoke y pruebas Gorilla de modelo/JSON/Blockly,
  reglas/capacidades, ambos generadores y workspaces reales en worker1×/4×.
- Ocho objetivos sincronizados, límites, rechazo íntegro, preparación, pausa,
  parada y fallo I2C en núcleo C++ compilado con warnings como errores y dobles
  HAL Arduino/IDF; validación real del intérprete compilada con dobles JSON.
- Backend: proyectos58 y biblioteca59, nombres/IDs/ángulos/límites inválidos.
- Seis recorridos Chromium aprobados: dos ejemplos58, dos59, calibración y
  editor de posturas; regresiones detectadas corregidas y repetidas. Revisión
  visual del modal y ajuste de scroll para mantener Guardar/Cancelar visibles.
  Un contrato adicional comprueba competencia de dos movimientos, pausa y
  continuidad de un contador independiente; inválidos bloqueados antes de correr.

**No se ejecutó aquí el SDK ESP-IDF completo ni una prueba física de ocho servos.**
Actualizar/probar dev1 corresponde al propietario. No declarar cinemática59
terminada: faltan CAD/STL o medidas entre ejes, longitudes reales/extensiones,
montaje espejado, rama de ensamblaje y zona válida sin singularidades/colisiones.
Con esos datos se retoma la parte restante59 antes de marcha60.
