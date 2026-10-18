# Fase 52 — Pista de exploración y reparto

Reglas aprobadas el 18 de octubre de 2026 antes de implementar. Rama
`codex/fase-52-pista-robots`, desde origin/dev1 `2d6229f` (fase 51 integrada).
Entrega para el simulador web. No modificar main/dev2 ni operar servidor.

## Disposición aprobada

Vista superior, un solo robot de dos motores. Base (120,420), estación A
roja (400,420), estación B azul (400,180), meta verde (800,180). Camino ancho
en dos giros: derecha → arriba → derecha. El camino orienta, no es un riel.
Pared exterior, espacio para desvíos y obstáculos sólidos preparados antes
de ejecutar. Otto mantiene su fase propia; no se agrega seguidor de línea.
La plantilla nueva robotArena no altera los antiguos robotCourse/robotTrack.

Componentes:

- Robot: avanzar, retroceder, girar izquierda/derecha y detener con potencia.
- Distancia frontal: sensor existente HC-SR04/VL53L0X, montado sobre el robot.
- Color hacia el suelo: TCS34725 existente, montado en el mismo robot.
- Barrera infrarroja fija de meta, marcador (800,110), haz x800/y120–240.
- Luz y buzzer opcionales, para avisos programados. Se incluyen en los ejemplos.

Un solo sensor de cada tipo y una barrera de meta en esta primera versión.
Vínculo por tipo único/ID actual, independiente del nombre: los sensores montados
no pueden arrastrarse a un sitio donde la lectura parezca provenir de otro lugar.
Se seleccionan desde la lista de objetos del armador para nombre, perfil y pines.
Robot sí puede moverse y orientarse al preparar la escena. El dibujo marca
claramente su frente; distancia dorada y sensor de suelo violeta viajan con él.
Ninguna de estas lecturas del mundo equivale a telemetría física.

## Movimiento, contactos y recuperación

- El programa conduce. No buscar estaciones, seguir líneas, evitar obstáculos
  ni corregir el rumbo automáticamente.
- Posición continua y giros graduales. Dos ruedas iguales desplazan; opuestas
  giran. Modelo idealizado: potencia 100 → 100 unidades/s; dos ruedas opuestas
  a 75 → 112,5°/s. Una unidad de escena equivale a un cm simulado.
- Cuerpo circular de radio 22 para contactos y paso de meta. Subpasos de hasta
  10 ms impiden atravesar obstáculos por un salto grande. Arena delimitada
  x20–940/y50–510; el centro respeta el radio del robot.
- Chocar bloquea ese desplazamiento, muestra «Contacto» y deja correr el
  programa. Puede retroceder o girar para salir; no rebota ni cambia el rumbo
  por sí solo. Se cuentan episodios de contacto, no cada fotograma.
- Salir del camino muestra «Fuera del recorrido» pero permite continuar y volver,
  también durante el desvío correcto del ejemplo. No teletransportar ni penalizar
  automáticamente: un desafío puede definir su propia misión.
- Sin inercia/batería/deslizamiento o daños. Un reloj del worker para bloques
  y mundo: velocidad, pausa, Paso, Detener y Reiniciar compartidos. Reiniciar
  limpia visitas, recorrido, contactos y meta, y devuelve posición/orientación
  iniciales. Apagar una luz no reinicia nada.

## Sensores y estaciones

- Distancia: haz frontal estrecho idealizado desde la parte delantera hasta
  obstáculo/pared más cercano, con máximo configurado del sensor (400 cm por
  defecto, hasta 500). Sin detección dentro de alcance devuelve el máximo, no
  cero. Un ultrasónico real tiene apertura/ruido; no se promete esa fidelidad.
- Color: suelo bajo el centro del robot. Dentro de la marca circular de radio
  43, canal rojo/azul/verde dominante 240, restantes 20. Suelo común: todos 20.
  Nada de leer la próxima estación ni conservar una marca abandonada.
- Visita: entrar en A/B y detener ambas ruedas al menos 0,6 s dentro. Mantenerse
  detenido suma una sola visita; salir y volver a detenerse permite otra.
  Visitas informativas, no una misión universal u orden obligatoria.
- Meta: barrera interrumpida mientras cualquier parte del robot cruza su zona;
  libera al salir. Indicador histórico «meta alcanzada» hasta Reiniciar, distinto
  de la señal instantánea. El programa decide si frena/avisa.
- Entradas ligadas al mundo automáticas: sin sliders manuales competidores,
  tampoco SET_INPUT puede sobrescribirlas. Si falta un sensor se avisa; el mundo
  no lo crea ni repara ocultamente y el programa debe adaptarse.

## Preparación y persistencia

En Armar escena → **Pista al comenzar**:

- Despejada o con obstáculo preparado; hasta cuatro obstáculos, agregar/quitar.
- Moverlos con controles Horizontal/Vertical, sólo dentro de zonas válidas:
  centros x210–850/y100–460; radios 20–40 en JSON, 28 para nuevos obstáculos.
- No superponer obstáculos ni cubrir base/estaciones/meta/robot. El control
  rechaza posiciones inválidas; los validadores también lo verifican.
- Mostrar/ocultar haz, zonas de estación y trayectoria. Sensores montados siguen
  visibles aun ocultando guías. Recorrido acotado a 300 puntos, sin memoria creciente.

Durante ejecución no se arrastran robot/obstáculos. Para cambiar la disposición,
detener y abrir el armador (proyecto/borrador con la confirmación habitual).
Guardar/Cancelar/Deshacer/Rehacer son del borrador de escena, no de cada frame.
`canvas.arenaEnvironment?` guarda sólo `guides` y hasta cuatro obstáculos.
`robotArena` se agrega a background/sourceTemplate/simulation.scene.
Sin frames, contactos, visitas ni trayectoria en JSON/autoguardado.
Sin migración, dependencias, SDK, firmware o ABI nuevos.

## Dos ejemplos completos

**Reparto por estaciones**: secuencial, pista despejada. Avanzar hasta rojo,
adentrarse brevemente en la marca, detener/avisar; girar izquierda, repetir en
azul; girar derecha, avanzar hasta barrera de meta, detener, encender luz y sonar.
Giros/avances temporizados son órdenes visibles en bloques, no asistencia oculta.

**Explorador con obstáculos y procedimientos**: obstáculo (260,420), radio 28.
Medir cercanía <70 cm, detener y retroceder, rodear por arriba con giros/avances
preparados, continuar a A/B/meta. Ocho procedimientos y cinco pestañas:

- Principal: inicialización y llamada a Completar el reparto.
- Recorrido: programa global y Recorrer primer tramo.
- Desvío: Resolver este obstáculo y Llegar y avisar.
- Estaciones: Atender estación A/B.
- Giros: Girar a la izquierda/derecha.

Resuelve la disposición que trae, **no cualquier laberinto**. Mover la salida,
rotar el robot, cambiar el obstáculo o su potencia puede exigir modificar el
programa. No esconderlo con recalibración automática. El ejemplo no se convierte
en desafío incompleto: tal como se abre llega a A/B/meta sin contactos.

Ambos en Proyecto → Ejemplos, un único inicio, bloques existentes exportables
a Arduino, ESP-IDF y reglas. La simulación ideal no prueba trayectorias físicas:
un robot real exige calibrar motores/tiempos y aceptar sus sensores.

## Verificación y entrega

```powershell
node --experimental-strip-types scripts/robot-arena.test.mjs
node --experimental-strip-types scripts/arena-worker.test.mjs
npx playwright test tests/arena.spec.ts --project=chromium --workers=1
npm run typecheck
npm run lint
npm run test:smoke
npm run build
```

Pruebas de geometría, distancia/color, contactos sin rebotes y recuperación,
visitas sin duplicados, límites/JSON, ambos workspaces reales a 1×/4× y
generadores/reglas. Contratos backend de configuración/obstáculos/posición/
cardinalidad. Navegador para ambos ejemplos y edición con undo/redo/guardar/
cancelar. Evidencia final en contexto vivo.

Resultado local: tipos/lint (incluidos controles/renderer nuevos), smoke completo,
ambos ejemplos reales a 1×/4× y build final aprobados (diez páginas estáticas).
Veinte contratos backend de los cinco mundos recientes y los dos documentos
reales frontend→Django aceptados. Tres recorridos Chromium aprobados, captura
inspeccionada; no prueba física ni despliegue. Advertencia de chunk grande ya
existente, sin fallo de build. Sin compilación SDK.

Pendientes expresos: aceptación humana, robot físico y renderer/dinámica
Waveshare. No afirmar paridad por funcionar en la web. No compilar firmware
para esta escena. Fases 53–55 todavía requieren autorización.

Como capi en capi-dev, con SHA40 entregado:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-52-pista-robots --commit SHA40
```

Sin --promote, sin operar main/dev2. El propietario integra y actualiza dev1.
