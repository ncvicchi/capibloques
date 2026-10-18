# Fase 49 — Huerta e invernadero

Reglas aprobadas por el propietario antes de implementar. Entrega en rama
`codex/fase-49-huerta-invernadero`, desde `origin/dev1` en
`821cc1c` (incluye fase 48 integrada). Sólo se entrega comando para dev1;
no operar el servidor ni integrar/promover main o dev2.

## Disposición y reglas

Un mundo de 960 × 540: **huerta exterior a la izquierda e invernadero a la
derecha**, un cantero por sector y una ventana. Arriba se ven sol/nubes/lluvia;
pantalla opcional abajo. No incorporar cantidades configurables, especies,
nutrientes, plagas ni enfermedades en esta primera entrega.

| Elemento | Comportamiento |
| --- | --- |
| Suelo | Humedad 0–100%; se seca gradualmente, más rápido con sol/calor. |
| Riego | Salida de potencia del cantero asociado: 0% apagado, 100% máximo. Nunca riega por detectar sequedad sin una orden del programa. |
| Lluvia | Humedece sólo el cantero exterior; no atraviesa el techo. |
| Invernadero | El sol lo calienta; conserva más calor con ventana cerrada. |
| Ventana | Servo 0° cerrada, 90° o más abierta. Recorrido de 1,2 s no bloqueante. Ventilar acerca la temperatura a la exterior, no enfría por debajo de ella. |
| Plantas | Crecen con condiciones adecuadas. Sequedad, exceso de agua o calor sostenidos reducen su salud. Se recuperan gradualmente al corregir el problema; no hay muerte irreversible. |

Estados visibles: **Saludable → Necesita atención → Marchita**, con texto y
símbolo de la causa, no sólo color. Se prioriza falta de agua, exceso de agua y
calor al mostrar una causa; no pretende ser un modelo botánico certificado.
Plantas/canteros no consumen GPIO ni se incorporan como sensores electrónicos
omniscientes: el programa lee tierra, temperatura/humedad ambiente y luz.

Los sensores del mundo generan **entradas**, no acciones. El alumno programa
los riegos y la ventilación con los bloques existentes. No corregir su programa
ni proteger plantas mágicamente. Incluso un riego correcto puede no resolver
un clima extremo o una lluvia continua: las consecuencias deben poder verse.

### Escala educativa y umbrales

Tiempo didáctico acelerado: segundos simulados condensan cambios ambientales;
no representan segundos reales de una huerta ni justifican tiempos de una bomba.
Suelo inicial 55%, salud 90%, crecimiento 25%. Sequedad por debajo de 25%, exceso
por encima de 85%, calor por encima de 35 °C. Son umbrales de juego, no agronomía.

Cada segundo: pérdida de agua = 0,35 + luz% × 0,004 + exceso de temperatura sobre
20 °C × 0,025; riego máximo +4 puntos, lluvia exterior +2, drenaje adicional 0,4
si humedad >75. Salud pierde 2 puntos con estrés y recupera 0,8 en condiciones
adecuadas; crecimiento depende de luz/salud. Todos los valores están acotados.
Temperatura exterior/interior y humedad del aire evolucionan gradualmente.

Sol bajo/medio/fuerte equivale a 25/60/100% de luz virtual (sensor 0–4095).
Exterior configurable 5–40 °C. Cerrado, el sol puede elevar el interior hasta
18 °C sobre el exterior; abierto reduce ese aporte a 2 °C al sol máximo.
La presión se mantiene en 1013 hPa; no es una variable meteorológica nueva.
Las lecturas de tierra se entregan con resolución de 1% y clima con 0,1;
el modelo interno continuo no llena la pantalla de decimales irrelevantes.

## Componentes y lugares

| Función | Componente existente | x / y | GPIO del ejemplo Wemos |
| --- | --- | --- | --- |
| Tierra de la huerta | Humedad de tierra | 205 / 365 | 34 |
| Tierra del invernadero | Humedad de tierra | 655 / 365 | 35 |
| Riego de la huerta | Interruptor de potencia MOSFET | 345 / 365 | 26 |
| Riego del invernadero | Interruptor de potencia MOSFET | 795 / 365 | 27 |
| Clima del invernadero | BME280 | 680 / 145 | SDA 18, SCL 19 |
| Ventana | Servo | 865 / 205 | 14 |
| Luz del sol | Sensor de luz | 375 / 145 | 36 |
| Estado de las plantas | LCD 16 × 2 I2C | 480 / 465 | SDA 25, SCL 23 |

Riego es una **representación de la bomba mediante salida de potencia**, no una
bomba conectada al GPIO. Perfiles físicos, alimentación, calibraciones y coexistencia
de buses/drivers requieren aceptación en maqueta; no afirmar prueba eléctrica.

Sensores, riegos y ventana se encajan en lugares identificados, sin superponerlos
ni rotarlos libremente. Nombre y rol visibles. Se pueden quitar/reponer; la
ausencia genera un aviso: sin sensor no hay lectura para el programa, sin salida
no actúa. Luces, botones, buzzer y pantalla siguen siendo transversales; una sola
pantalla por proyecto. No se alteran los proyectos anteriores de Huerta inteligente.

## Controles ambientales, reloj y persistencia

En **Estado → Clima virtual de la huerta**: sol, temperatura exterior, lluvia y
clima cambiante. Se modifican condiciones, no directamente sensores. Los sensores
ligados no tienen sliders manuales competidores, tampoco en revisión. Los cambios
no se mandan a sensores físicos; controles de clima deshabilitados durante espejo
de placa. El clima cambiante usa semilla reproducible y transiciones cada 45 s.

El armador permite elegir el **clima inicial**, plegado para no sobrecargar.
Guardar/Cancelar/Deshacer/Rehacer conservan el contrato del borrador. Las pruebas
de clima en ejecución son transitorias: no ensucian el proyecto ni autoguardan
fotogramas. El JSON conserva sólo `canvas.gardenEnvironment` opcional; ausente
usa sol medio, 22 °C, sin lluvia ni cambios automáticos.

Un único reloj en el worker para algoritmo, suelo, plantas, ventilación y clima.
Pausar congela todo; Paso avanza el mismo mundo; velocidad escala todo. Reiniciar
restaura plantas, humedad, semilla, clima inicial y actuadores. Apagar un riego no
reinicia plantas; detener no borra el estado visible. No hay temporizador React
independiente para animar un mundo divergente.

## Dos ejemplos completos

En **Proyecto → Ejemplos**:

1. **Huerta con riego automático**: solución directa de ambos canteros, usando
   dos umbrales: encender <35%, apagar >65%. En la banda intermedia conserva
   la orden, sin prender/apagar constantemente. Ventana abierta fija; cartel
   muestra humedad exterior. Tres caminos cooperativos.
2. **Huerta e invernadero con procedimientos**: riegos independientes y ventana
   regulada por temperatura (>30 abre, <26 cierra). Principal llama a Cuidar la
   huerta / Cuidar el invernadero; éstas llaman a Regular riego exterior/interior
   y Regular ventilación. Mostrar humedad actualiza el cartel en otro camino.
   Seis procedimientos, pestañas Principal, Cuidar plantas, Riego y Clima y cartel.

No son desafíos a completar. Ambos vienen ejecutables para clima inicial normal;
el segundo incorpora la regulación que en el primero es apertura fija.

## Implementación y verificación

Modelo puro en `lib/garden-world.ts`, renderer en `components/garden-world.tsx`,
controles compartidos en `components/garden-controls.tsx`. Worker aplica lecturas
a componentes existentes; el mismo grafo compila a Arduino/ESP-IDF/CapiRules.
Modelo/armador/frontend/backend comparten fondo/plantilla nueva `greenhouse`.
Sin migración, dependencia nueva, ABI ni cambio de firmware. No compilar SDK.

Se corrigieron dos fallos anteriores expuestos por estos ejemplos: los lectores
genéricos de datos no ofrecían módulos educativos y el bloque de potencia no
estaba en la allowlist de JSON del frontend (sí estaba en backend).

Comprobaciones locales:

```powershell
node --experimental-strip-types scripts/garden-world.test.mjs
node --experimental-strip-types scripts/simulator-worker-smoke.mjs
npx playwright test tests/garden.spec.ts --project=chromium --workers=1
npm run typecheck
npm run lint
npm run test:smoke
npm run build
```

El worker ejecuta los dos workspaces reales a 1×/4× durante ciclos sostenidos,
verifica histéresis en ambos canteros, ventana, salud, lecturas ligadas al mundo,
rechazo de sobrescritura manual, pausa/paso/reinicio y validación del clima.
Modelo puro verifica sequedad, inundación, techo, calor, ventilación, recuperación,
determinismo y límites. JSON de ambos ejemplos, pestañas, generación de fuentes y
reglas; contratos de almacenamiento Django y navegador se verifican por separado.

Resultados locales: tipos/lint (incluidos renderer y controles nuevos), suite
smoke completa y build con diez páginas estáticas verificados. Trece contratos
backend aprobados (cuatro nuevos y nueve de mundos anteriores); ambos JSON reales
frontend→Django aceptados. Tres recorridos Chromium aprobados: ambos ejemplos,
riego realimentado, pausa/reset, clima y ausencia de sliders competidores,
capacidad de guardar/cancelar y undo/redo del clima inicial. Capturas inspeccionadas;
rótulos separados y valores legibles, sin decimales interminables. Pruebas no
equivalen a uso humano ni a hardware. No se operó el servidor ni se esperó CI.

**Pendientes explícitos:** aceptación del propietario, integración/actualización
dev1, renderer/dinámica Waveshare y maqueta física. No prometer que esta nueva
huerta ya corre dibujada en la placa por generar correctamente las reglas.
Fases 50–55 no iniciadas.

## Actualizar sólo dev1

Como `capi` en capi-dev, reemplazando SHA40 con el commit completo entregado:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-49-huerta-invernadero --commit SHA40
```

No usar `--promote` ni ejecutar contra main/dev2. En esta entrega no se opera
remotamente ni se espera GitHub Actions.
