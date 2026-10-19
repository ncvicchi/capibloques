# Fase 57 — Laguna, depósito y bombeo

19 de octubre de 2026. Reglas aprobadas por el propietario antes de implementar.
Rama `codex/fase-57-laguna-bombeo`, desde origin/dev1 `86e6cfe` (incluye fase56).
La actualización de fase56 en dev1 fue confirmada por el propietario; no equivale
a aceptación de hardware, SDK o Waveshare. No modificar main/dev2 ni servidores.

## Disposición aprobada

Mundo nuevo `pondLab`, 960 × 540. No reemplaza el fondo histórico `pond` ni el
ejemplo de contador. Vista de corte: reserva izquierda de 300 L, laguna derecha
de 100 L, bomba que transfiere reserva → laguna, desagüe de laguna hacia fuera
del sistema y bandeja de derrame. Ilustración y modelo didácticos, no ingeniería
hidráulica ni elección de bombas/sensores para contacto con agua.

| Función | Componente / posición x,y | Lectura u orden |
| --- | --- | --- |
| Distancia de reserva | distanceSensor / 210,145 | 120 cm vacío, 20 cm lleno |
| Distancia de laguna | distanceSensor / 640,185 | Misma escala inversa |
| Bomba | powerSwitch / 410,340 | MOSFET 0–100%; relé 0/apagado o cualquier orden positiva/encendido |
| Compuerta | servo / 835,375 | 0° cerrada, 90° abierta, posiciones intermedias |
| Derrame | waterSensor / 640,445 | Humedad residual de bandeja; no nivel de tanque |

Dos lugares distintos para distancia; un lugar para cada actuador/detector.
Se pueden quitar y reponer desde catálogo; agregar elige un lugar libre, no
duplica funciones. Arrastrar a otro lugar ocupado no intercambia ni superpone.
Rótulos usan el nombre configurado. LED, buzzer y una pantalla pueden acomodarse.
Sin sensor no hay lectura alternativa; sin bomba no hay transferencia; sin servo
el desagüe está cerrado. Faltantes se explican como advertencias, no se reponen.

## Dinámica aprobada y límites

- Bomba a plena potencia: 2 L/s, proporcional al PWM. La reserva pierde exactamente
  lo que recibe la laguna. La orden persiste aunque se vacíe: sin agua no transfiere
  y el mundo avisa marcha en seco, sin apagar mágicamente ni romper el equipo.
- Compuerta: recorre 90° en 1,2 s sin bloquear; caudal máximo 3 L/s, proporcional
  a apertura. El desagüe no retorna a reserva.
- Lluvia 0–4 L/s entra sólo a laguna. Fuga 0–4 L/s y evaporación 0–0,5 L/s salen
  de laguna. Son tasas didácticas, no meteorología/caudal físico medido.
- Capacidades acotadas, nunca volumen negativo. El exceso se contabiliza como
  derrame, no desaparece. Se conserva el balance con contadores de transferencia,
  lluvia, desagüe, fuga, evaporación, derrame y recarga.
- Un derrame nuevo moja la bandeja al 100%; al cesar se seca en 15 s simulados.
  `wet` respeta el umbral configurado del componente (20% predeterminado), por lo
  que puede dejar de indicar mojado antes de que desaparezca toda humedad.
- Bomba encendida no garantiza que suba el nivel si las salidas superan el aporte.
- Distancia = 120 − 100 × volumen/capacidad. Nivel y dibujo derivan del mismo
  volumen. Litros y porcentajes visuales explican el mundo: no son nuevas entradas
  omniscientes del programa. No simular pH, oxígeno, salud/consumo de peces.
- Integración determinista en subpasos de 20 ms; no timers de pared ni azar.
  Animación de tuberías solamente con caudal, mismo reloj de programa/agua/servo.
  Pausa congela, Paso avanza según contrato del simulador y velocidad escala todo.

## Edición y ensayos

Condiciones guardadas: niveles iniciales, evaporación, fuga y lluvia. Predeterminado:
laguna 35 L, reserva 240 L, evaporación 0,05 L/s, fuga/lluvia cero. Panel plegado
en editor con guardar/cancelar/deshacer/rehacer existentes. JSON portable estricto
en frontend/backend, cinco campos acotados; ausencia usa predeterminados.

Durante prueba: lluvia, fuga y botón recargar reserva a 300 L. No modifican el
proyecto ni permiten forzar los sensores automáticos. Recargas se encolan como
una petición acotada y se aplican al avanzar el reloj, no durante pausa. Ensayos
previos a Simular/Paso se conservan en LOAD del mismo mundo; Reiniciar restaura
todo desde proyecto: volúmenes, humedad, contadores, entorno y compuerta/programa.
Revisión docente reutiliza mundo/ensayos. En espejo físico se deshabilitan ensayos:
no afirmar que la simulación web lee agua real.

## Ejemplos completos

1. **Laguna con nivel automático**: inicio seguro (bomba apagada, desagüe cerrado,
   luz apagada); bucle directo enciende al bajar de 40% (distancia >80 cm), apaga
   al llegar a 70% (distancia ≤50 cm), conserva decisión entre ambos. Espera 0,2 s.
   No protege reserva ni abre desagüe; la descripción lo aclara. Permite observar
   consecuencias al introducir lluvia, fuga o reserva insuficiente.
2. **Laguna protegida con procedimientos**: seis procedimientos, cuatro pestañas,
   tres procesos (control, avisos, informe). Control único de bomba: reserva con
   distancia >110 cm impide bombear; recargar permite reanudar. Misma histéresis
   de laguna. Temporizador empieza sólo al encender y limita cada bombeo a 25 s;
   agotarlo deja fallo enclavado hasta Reiniciar, evita reintentos interminables.
   Servo abre con distancia <30 cm (>90%), cierra >40 cm (<80%), conserva apertura
   intermedia entre umbrales. LED avisa reserva/timeout/bandeja mojada; buzzer una
   vez por episodio de aviso, no continuamente. Pantalla alterna informe de
   distancia y mensajes de reserva/tiempo; el programa no lee litros ocultos.

Los ejemplos están en el catálogo, no son desafíos vacíos. La regulación básica
no es una protección universal; lluvia a 4 L/s supera incluso el desagüe máximo.
Los tres procesos del modular tienen responsables únicos para cada actuador.

## Entrega y aceptación

Implementación web y componentes/bloques existentes, sin cambios de firmware,
ABI, dependencias ni migraciones. Conserva Arduino y ESP-IDF, intérprete/reglas
con capacidades ya existentes. No reconstruir SDK por este mundo web ni borrar
objetos/cachés incrementales. El renderer/motor de este mundo en Waveshare **no
está implementado**, no es simplemente una prueba física pendiente.

Pruebas automatizadas: `scripts/pond-world.test.mjs`, `scripts/pond-worker.test.mjs`
(incluidas en smoke), `tests/pond.spec.ts`, `backend/tests/test_pond_scene_validation.py`.
Smoke completo, pruebas de mundo/worker, 7 pruebas Django de57/53 y los dos
proyectos reales frontend→Django aprobados. Tres recorridos Chromium aprobados:
ambos ejemplos con pausa/reset y edición con guardar/cancelar/undo/redo;
capturas inspeccionadas. Tipos, lint y build de10páginas aprobados, advertencia
existente de chunk grande sin ocultar. Se comprobaron también IDs normalizados
de pestañas y nombres de variables ≤32 para conservar organización/guardado.
Evidencia y limitaciones en el contexto vivo. Pendientes integración dev1
por propietario, aceptación humana/docente, maqueta física y mundo Waveshare.
No operar main/dev2 ni integrar otra fase al cerrar ésta.
