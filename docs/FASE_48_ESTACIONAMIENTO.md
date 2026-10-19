# Fase 48 — Estacionamiento

Autorización explícita del propietario: documentar las reglas aprobadas,
implementar en rama desde `dev1`, conservar dos ejemplos completos y entregar
el comando para actualizar sólo dev1. Rama: `codex/fase-48-estacionamiento`,
base `origin/dev1` (`73dc00f890c82de4094680c2dbae3daa810d6f1f`).
No integrar/promover main, operar dev2 ni desplegar remotamente en esta entrega.

## Reglas acordadas y disposición

- Mundo de 960 × 540, capacidad física seleccionable de **4, 8 o 12 plazas**.
  Entrada a la izquierda (autos hacia arriba), salida a la derecha (hacia abajo).
  Las plazas numeradas están dentro; las flechas señalan cada recorrido.
- Dos barreras con servos: entrada y salida. **0° cerrada; 90° o más abierta**.
  El recorrido de 1,2 segundos es virtual, progresivo y no bloquea otros caminos.
  No se admiten nuevos autos hasta abrir completamente. Cerrar deja terminar
  a quien ya cruzó la línea de detención; no corta un auto por la mitad.
- **Cuatro barreras infrarrojas digitales**, dos por acceso: auto esperando y
  paso después de la barrera. La señal se interrumpe mientras el auto ocupa el
  haz. Para contar una sola vez: esperar interrumpido y luego libre en el sensor
  de paso. No son ultrasonidos ni mediciones analógicas.
- Los autos llegan solos a intervalos variables, esperan respetando distancias,
  recorren el interior, estacionan y piden salir después de una permanencia
  variable. El alumno no programa el volante ni cada auto: programa los accesos,
  el contador y el cartel.
- La capacidad del mundo y la variable **Capacidad** del programa son conceptos
  explícitos: cambiar las plazas no reescribe bloques. Ambos ejemplos vienen
  completos para **8**; al elegir 4/12, cambiar el número inicial de esa variable.
  El armador y la descripción del ejemplo lo recuerdan. **Ocupados** sólo cambia
  por las instrucciones del alumno; jamás se sincroniza con un contador oculto.
- El programa debe cerrar entrada cuando no haya plazas, sin impedir la salida.
  Pantalla: `Libres: N` o `Completo`. Un sensor no abre barreras automáticamente.
- Si un programa deja entrar sin plaza, el auto **permanece visible y atasca la
  entrada**. No aparece una plaza extra, no desaparece el auto y no se corrige
  el contador. Las salidas siguen funcionando: liberar una plaza permite que el
  auto atascado continúe. No es un choque ni congela toda la simulación.
- Cola exterior de hasta cinco autos visibles/pendientes; no nacen otros encima.
  Dentro hay como máximo las plazas reservadas/ocupadas, un auto sin plaza y
  el acceso de salida. El tráfico exterior excedente espera fuera del modelo;
  no se borran autos que ya ingresaron. Al salir del encuadre se destruyen.
- Azar determinista, mismo reloj del worker: velocidad, pausa y paso compartidos
  con los bloques. Reiniciar limpia autos, sensores, colas, atasco, conteos del
  mundo y semilla; recupera la configuración inicial de servos y variables.
  Apagar una salida o detener el programa no hace desaparecer el mundo.

### Lugares de componentes

| Función | Tipo | Centro x / y | GPIO del ejemplo Wemos |
| --- | --- | --- | --- |
| Barrera de entrada | Servo | 105 / 430 | 14 |
| Barrera de salida | Servo | 855 / 430 | 27 |
| Auto en entrada | Infrarrojo digital | 160 / 480 | 34 |
| Paso de entrada | Infrarrojo digital | 160 / 375 | 35 |
| Auto en salida | Infrarrojo digital | 800 / 390 | 36 |
| Paso de salida | Infrarrojo digital | 800 / 485 | 39 |
| Plazas disponibles | LCD 16 × 2 I2C | 480 / 465 | SDA 26, SCL 25 |

Barreras y detectores encajan en lugares identificados; no pueden superponerse
ni rotarse libremente. El inspector explica su función. Se pueden renombrar,
quitar y reponer; identidades/pines no se reutilizan ocultamente. Un acceso sin
barrera permanece cerrado; sin detector no entrega esa señal. Otros componentes
transversales (luces, sonido, botones) siguen disponibles; una pantalla por proyecto.
Los nombres configurados aparecen en el mundo. Los detectores ligados a estos
lugares son automáticos: Estado y revisión no ofrecen botones manuales competidores.

## Dos ejemplos completos

En **Proyecto → Ejemplos**:

1. **Estacionamiento**: versión directa, con inicialización y tres caminos en
   `Al mismo tiempo`: entrada, salida y actualización del cartel. Cada acceso
   abre, espera el paso completo, cierra y modifica Ocupados una sola vez.
2. **Estacionamiento con procedimientos**: misma solución y escena. Principal
   llama a `Gestionar entrada` y `Gestionar salida`; éstas llaman a `Dejar entrar
   y contar` / `Dejar salir y contar`. `Actualizar cartel` reúne la presentación.
   Pestañas Principal, Accesos, Paso completo y Cartel; cinco procedimientos.

No son desafíos incompletos. Entradas y salidas son cooperativas; esperar plaza
en la entrada nunca bloquea que otro auto salga. La pantalla usa el dato numérico
del programa, no una etiqueta visual calculada por el mundo.

## Implementación y persistencia

- `lib/parking-world.ts`: geometría compartida, asignación por lugar y modelo puro
  acotado; `lib/simulator.worker.ts`: sensores y salidas sobre el reloj existente.
- `components/parking-world.tsx` / `scene-stage.tsx`: mismo dibujo y posiciones
  en armador, simulador y revisión. No hay un segundo motor React con otro reloj.
- `scene-model.ts`, armador y validador Django: fondo/plantilla `parking` y campo
  opcional `canvas.parkingCapacity` (ausente = 8). Sólo 4/8/12; se rechazan datos
  inválidos, lugares repetidos y geometría fuera de contrato.
- Guardar/Cancelar/Deshacer/Rehacer usan el historial existente del borrador.
  JSON y biblioteca conservan configuración, componentes, variables y pestañas;
  no guardan fotogramas/colas. Sin migración de base ni dependencia nueva.

## Verificación y alcance

Pruebas automatizadas específicas:

```powershell
node --experimental-strip-types scripts/parking-world.test.mjs
node --experimental-strip-types scripts/simulator-worker-smoke.mjs
npx playwright test tests/parking.spec.ts --project=chromium --workers=1
```

El smoke general incluye el modelo nuevo. El worker ejecuta **los workspaces reales
de ambos ejemplos**, no una solución alternativa de test: 4/8/12 plazas a 1×/4×,
entrada/salida sostenidas, lleno, cuenta acotada sin duplicados, pausa, paso,
rechazo de entradas manuales y reinicio. También se prueban programa incorrecto
con atasco y recuperación, JSON, pestañas y generación Arduino/ESP-IDF/CapiRules.
Contratos Django sin base: `tests.test_parking_scene_validation`.

Resultados locales: typecheck y lint, build con diez páginas estáticas verificadas,
suite smoke completa, ambos JSON reales
frontend→Django y nueve contratos backend (cuatro nuevos más cinco ferroviarios)
aprobados. Tres recorridos Chromium aprobados: ambos ejemplos con autos/sensores,
pausa/reinicio y armador con capacidad, límites, ayuda, undo/redo, Cancelar con
confirmación y Guardar. Captura del simulador inspeccionada. La versión modular
se expande a la misma lógica de la directa; no se omiten instrucciones encadenadas.
No se operó DEV ni se probó hardware; aceptación humana pendiente.

**Alcance web.** No se cambia firmware, ABI ni toolchain; no compilar SDK por
esta fase. Los bloques usan servos, infrarrojos, datos y display ya soportados.
Generar fuentes/reglas no demuestra la maqueta física. **Renderer/dinámica del
estacionamiento en Waveshare y aceptación física/humana quedan pendientes**;
no prometer que los autos nuevos ya están en la pantalla de la placa.

## Entrega sólo a dev1

En capi-dev, usuario `capi`, con el SHA completo informado al entregar:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-48-estacionamiento --commit SHA40_DE_LA_ENTREGA
```

Integra y actualiza dev1 bajo el bloqueo compartido. No usar `--promote`, no
ejecutar el comando para dev2 ni actualizar main. En esta conversación no se
opera el servidor; integración/DEV y aceptación del propietario pendientes.
Fases 49–55 no iniciadas.
