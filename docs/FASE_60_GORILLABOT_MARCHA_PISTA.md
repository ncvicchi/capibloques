# Fase 60 — GorillaBot: marcha coordinada y pista

## Acuerdo y alcance

Reglas acordadas y ejecución autorizada el 19 de octubre de 2026. Rama
`codex/fase-60-gorillabot-marcha`, desde `origin/dev1`
`7b65ae1bd28520801620aa21b0c1ba0161a42b32`. Fase 59 instalada en dev1 según
confirmación del propietario, no prueba física. No modificar main/dev2 ni
operar servidores. La actualización de dev1 la ejecuta el propietario.

Se conserva el banco y todos los ejemplos anteriores. La nueva escena
`gorillaTrack` no reutiliza la física de ruedas de la pista diferencial.
La geometría sigue siendo v3, 50/100/46 mm, con calibración por unidad y
las guardas de [fase 59](FASE_59_GORILLABOT_CINEMATICA.md).

Actualización de calibración 22/10/2026: para HW-378 + TowerPro MG90S, el
propietario confirmó que 150–600 ticks a 50Hz funciona bien y llega cerca de
180°. El editor de cinemática ofrece la equivalencia aproximada 732–2930µs como
opción explícita; se mantienen los valores iniciales y escenas ya calibradas.

## Marcha acordada y concretada

- Marcha lenta de cuatro tiempos: trasera izquierda → delantera izquierda →
  trasera derecha → delantera derecha. Una sola pata en recuperación.
- Un ciclo recupera las cuatro patas. No equivale a un movimiento de un servo.
- Una entrada común lleva todos los pies a `forward=0, up=4 mm`, relativos a
  la referencia geométrica. No se denomina postura físicamente certificada.
- Para cada pata: elevar, recuperar longitudinalmente, bajar y empujar con
  los cuatro apoyos previstos. Durante el empuje cada pie retrocede 1/4 del
  paso respecto del cuerpo; durante la recuperación no se traslada el cuerpo.
  Los pies terminan el ciclo en la misma referencia de marcha.
- Esta primera marcha tiene fases de empuje diferenciadas; no es un trote ni
  una marcha dinámica continua. Tres apoyos previstos no demuestran equilibrio:
  no se ha medido centro de masa, fuerza, contacto, adherencia o deformación.
- Retroceder invierte el recorrido longitudinal. Girar usa recorridos opuestos
  por lado, con mitad de amplitud, sin prometer un ángulo real ni movimiento
  lateral. El giro real necesita deslizamiento/contactos y validación física.
- Un dueño por robot y un reloj común para las ocho articulaciones. Cuatro
  órdenes de pie dentro de `Al mismo tiempo` siguen siendo órdenes serializadas,
  no una forma alternativa de esta coreografía. Otros componentes pueden seguir.

### Bloques y edición

- `avanzar / retroceder / girar izquierda / girar derecha durante N ciclos`:
  1–20 ciclos, compilados como repetición común de una orden coordinada.
- `quedar apoyado`: transición común a la referencia de marcha, sin cortar PWM.
  Se ejecuta cuando su camino obtiene el robot; no preempta otro movimiento.
- Configuración opcional `config.gait`: `stride` 1–12 mm, `height` 1–8 mm de
  elevación adicional, `phaseMs` 200–2000 ms y `turnsVerified` booleano.
  Predeterminado: 4 mm, 2 mm, 500 ms y false. El alcance real puede ser menor;
  no todos los valores editoriales son alcanzables con cualquier calibración.
- Inspector muestra la coreografía y duración efectiva del ciclo. Se conserva
  el control bajo nivel, posturas y editor de trayectorias de una pata.
- Los cambios son borrador del inspector/escena: Guardar cambios y Guardar
  escena, Cancelar y Deshacer/Rehacer usan el flujo existente. Cambiar parámetros
  de marcha, calibración o geometría retira la confirmación de giros.

### Validación y ejecución

Los 17 objetivos coordinados (entrada + 4×4 etapas), incluyendo todas sus
transiciones, se validan **antes de emitir un pulso**. Cada pata se comprueba
con IK/FK, misma rama y límites de fase 59; muestreo máximo 0,25 mm y 16–256
subdivisiones por tramo. Rechazo íntegro, sin recortar ni saltar ramas.
La duración de cada etapa es el máximo requerido por las cuatro patas,
limitada a 30°/s con margen del 5% sobre tasa muestreada. Límite de 30 s por
etapa y 180 s por ciclo. IK cartesiana en cada tick, no interpolación arbitraria
entre ángulos finales. Las órdenes no son mediciones de los servos. Preparar no conoce la posición
física inicial ni centra motores: antes de probar se requiere montaje sostenido
y una referencia física comprobada por una persona adulta. Sin encoder no se
puede garantizar una transición desde una posición real desconocida.

Simulador y C++ comparten reglas y son contrastados por pruebas. Arduino,
ESP-IDF e intérprete usan el mismo núcleo C++. Runtime mínimo **1.14.0**,
ABI 1, capacidad nueva `gorilla-gait`; se conserva `gorilla-bench` y todo lo
anterior. Firmware viejo se rechaza antes de enviar reglas. Giro físico requiere
confirmación adulta adicional: guardas en reglas, exportaciones e intérprete.

Pausa congela el reloj; Detener interrumpe y mantiene la última orden de cada
servo. Ninguno garantiza que el robot no caiga. `Quedar apoyado` es un bloque
explícito, no una maniobra forzada después de Detener. Reiniciar restablece todo
el mundo virtual; no certifica ni ejecuta un retorno físico a la base.

## Disposición y reglas de pista

Lienzo 960×540, un GorillaBot. Disposiciones `straight` (ida y vuelta) y
`maneuvers` (rectas y curva amplia). Plano, sin pendientes, saltos ni escaleras.
Salida BASE (120,355), estación A (248,355) y B (680,190), visible en maniobras.
El robot se coloca y orienta antes de ejecutar. Hasta cuatro obstáculos
circulares editables; no pueden superponerse a su posición inicial. Pueden
obstruir un recorrido o una estación: el mundo no arregla el programa.

- Huella conservadora del chasis de radio 42 unidades, no colisión CAD de patas.
  Límite de centros x65–895/y100–460. Comprobación de avance en subpasos ≤2 unidades.
- Escala **didáctica** de traslación: 4 unidades de escena por mm de empuje.
  Giros: un grado virtual por unidad de amplitud de ciclo; sin odometría real.
  Esta escala no convierte el plano en una predicción de distancias físicas.
- El movimiento del mundo sólo deriva de la orden coordinada de marcha.
  Mover un servo o una pata en bajo nivel no desplaza automáticamente el cuerpo.
- Contacto bloquea avance del cuerpo y se señala, pero las patas y el programa
  pueden continuar. Retroceder permite salir, sin rebotes ni evasión automática.
  Un contacto persistente cuenta como un episodio, no uno por frame.
- Estación visitada al permanecer dentro de radio24 y sin marcha durante 500 ms.
  Se registra secuencia de visitas (hasta32); no se exige orden escondido.
  Recorrido de hasta300 muestras. Posición, visitas y contactos son métricas de
  simulación, **no sensores físicos exportados como si existieran**.
- Velocidad, pausa, paso, detención y reinicio comparten reloj con articulaciones.
  Reiniciar limpia posiciones, visitas, contactos y recorrido de toda la escena.
- Vista superior, frente explícito, patas articuladas y pata en recuperación
  resaltada. Apoyo es intención de la coreografía, no lectura de contacto.

## Dos ejemplos completos

1. **GorillaBot: ida y vuelta** (`gorillaTrack`): preparar sin mover motores,
   referencia de marcha, esperar, ocho ciclos adelante, referencia, esperar,
   ocho ciclos atrás, referencia y esperar. Visitas esperadas BASE → A → BASE.
2. **GorillaBot: marcha con procedimientos** (`gorillaTrackProcedures`): mismo
   comportamiento con tres tareas, `Preparar robot`, `Ir a la estación` y
   `Volver a casa`; Principal con tres llamadas, pestaña Recorrido con definiciones.

Ambos son ejemplos resueltos, no desafíos. No incluyen giros experimentales
como requisito para funcionar. Nombres, biblioteca y JSON anteriores se conservan.

## Evidencia y pendientes

Pruebas específicas: cinco modos, orden de patas, tiempos/ángulos TS↔C++,
tasa angular, entrada/salida, objetivo imposible, rechazo sin pulsos, dueño
único, STOP, rollover y fallo I2C; estaciones, contacto persistente y salida
retrocediendo. Dos workspaces reales ejecutados en worker a 1× y 4×, pausa,
ida/espera/regreso, STOP/RESET y guardas de giro. Tipos, lint, smoke y build web.
Backend: seis tests Gorilla y packaging aprobados. Navegador: ambos ejemplos
nuevos con pausa/reinicio y edición guardar/cancelar/undo/redo/reabrir; regresión
58/59. La prueba antigua de pausa ahora espera ACK visible antes de capturar
la posición. Corrida inicial conjunta: 11/12; rerun dirigido final: 3/3,
incluyendo ambos ejemplos nuevos y el test de pausa corregido.

**Pendientes explícitos:** compilar con SDK completo y probar el robot físico;
primero montaje sostenido, luego paso lento sobre suelo, referencia de apoyo,
orden de patas y giros. No hay certificación de equilibrio ni precisión de yaw.
Renderer GorillaBot Waveshare sigue pendiente de fase64. Autonomía61 y mandos
62–64 no están autorizados ni implementados por esta fase. Sin migraciones,
dependencias nuevas, operación remota ni borrado de cachés/objetos SDK.

Actualizar exclusivamente dev1 mediante el comando instalado, fijando el SHA
completo publicado de la entrega:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-60-gorillabot-marcha --commit SHA40
```

El script conserva la compilación incremental del intérprete; este cambio
sí modifica firmware y necesita actualizarlo una vez, no por proyecto.
