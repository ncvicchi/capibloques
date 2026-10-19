# Fase 51 — Taller y cinta transportadora

Reglas aprobadas por el propietario el 18 de octubre de 2026 antes de implementar.
Rama `codex/fase-51-taller-cinta`, creada desde origin/dev1 `4976e14`.
Entrega sólo web; no integrar main/dev2 ni operar el servidor.

## Disposición y componentes

Un taller de 960 × 540: ingreso a la izquierda → zona de lectura → desviador
→ bandejas A (arriba) y B (abajo), a la derecha. Una cinta, un desviador y dos
salidas, sin editor de ramificaciones. Los paquetes son actores virtuales, no
componentes con GPIO. Motor, servo y sensores tienen lugares identificados:

| Función | Componente | Lugar |
| --- | --- | --- |
| Transporte | Motor con potencia | (160,360) |
| Paquete en lectura | Barrera infrarroja digital | (325,270) |
| Color en lectura | Sensor RGB TCS34725 | (325,170) |
| Peso en lectura | Balanza HX711 | (435,360), vinculada a la misma zona |
| Desvío | Servo | (640,270) |
| Confirmar A/B | Dos infrarrojos | (785,185) / (785,355) |

Otros botones, luces, buzzer y pantalla opcionales pueden colocarse libremente;
conservan sus límites generales. No agregar un segundo motor/servo/sensor de
color/balanza o un cuarto infrarrojo funcional. Al quitar un sensor, el mundo
continúa, pero el programa pierde esa entrada: se avisa, no se repone ocultamente.
Agregar uno de nuevo utiliza el lugar libre. Renombrar no rompe el vínculo.

## Reglas del mundo

- Paquetes rojos, azules o verdes, de 100 a 1000 g. Llegadas automáticas variables,
  reproducibles, espaciadas 20–30 s para permitir ambos ejemplos completos.
  Primera llegada a 1,2 s. Envío manual con color/peso preparados, sin escribir
  durante la simulación. Máximo una petición manual pendiente y diez paquetes.
- El motor define la velocidad. Potencia cero detiene los paquetes, no el servo
  ni el programa. Marcha atrás muestra explicación y equivale a detenido **sólo
  en este taller**; los motores de otras escenas no cambian.
- Los paquetes no se superponen. Si el ingreso está ocupado, se suspende la
  creación hasta tener lugar, se informa y no se borran los existentes.
- El infrarrojo de lectura está ocupado con el centro del paquete entre x300
  y x355. RGB corresponde únicamente al paquete de esa zona (color dominante
  240, otros 20, luz 80). Zona vacía: todos cero, sin conservar el color anterior.
- Peso válido sólo con paquete en lectura y cinta detenida durante 0,6 s.
  Moverla invalida la lectura y reinicia la estabilización. La escena y Estado
  muestran explícitamente «Sin lectura válida», no un paquete que pesa cero.
  El valor numérico de la balanza es cero mientras no es válido: el programa
  debe comprobar presencia, detener y esperar antes de compararlo; ambos
  ejemplos lo hacen (0,7 s). No se inventa un nuevo valor de hardware/ABI.
- Servo 0° → A, 90° → B, recorrido gradual de 1,2 s. Se decide al llegar
  a x640, no en la zona de lectura. Girar con un paquete sobre ese punto causa
  atasco. La cinta se congela, los paquetes quedan y el programa/servo continúan.
  Se explica la causa y sólo Reiniciar escena limpia el atasco en esta versión.
- No se corrige una clasificación equivocada: el mundo desconoce el criterio
  del programa. La barrera de salida se interrumpe y libera al pasar el paquete;
  luego llega a la bandeja y se retira. Contar la liberación confirma salida,
  no una orden del servo. Pueden transcurrir unos instantes hasta verlo en bandeja.
- Un único reloj del worker para mundo y bloques. Pausa, Paso y velocidad
  afectan ambos. Reiniciar recupera condiciones iniciales y limpia paquetes,
  entregas, sensores, petición pendiente y atasco. Detener no es un nuevo reset.

Los ensayos de Estado no modifican el documento: sobreviven al LOAD interno
de Simular/Paso del mismo proyecto, no a un reset/cambio de escena. En Armar
escena las condiciones iniciales sí se guardan; Deshacer/Rehacer/Guardar/Cancelar
usan el borrador habitual. Los sensores automáticos no muestran controles
manuales competidores ni aceptan SET_INPUT por ID.

## Dos ejemplos completos

En **Proyecto → Ejemplos**:

1. **Taller: clasificar por color.** Programa secuencial: avanzar hasta presencia,
   detener/estabilizar, rojo a A y azul/verde a B, esperar que el servo termine,
   avanzar hasta salida interrumpida y luego libre, detener e incrementar contador.
2. **Taller por peso y procedimientos.** Mismo transporte, comparación de peso
   contra variable **Peso límite** (500 g inicial, editable); mayores a A, menores
   o iguales a B. Cinco procedimientos: Clasificar un paquete, Transportar y pesar,
   Elegir por peso, Entregar en A/B. Principal llama al procedimiento global;
   pestañas Transporte, Clasificación y Entregas alojan las definiciones.

Ambos usan bloques ordinarios, un único inicio y conteo sólo tras salida completa.
No son desafíos incompletos ni automatismos del renderer. Para probar colores
y pesos específicos, desmarcar llegadas automáticas y enviar paquetes manuales
uno por vez. Enviar muchos muy juntos exige ampliar la coordinación del programa;
no hay clasificación automática ni rechazo oculto de paquetes para salvarlo.

## Persistencia, límites y pruebas

`canvas.background/sourceTemplate/simulation.scene = conveyor` y
`canvas.conveyorEnvironment?` con automaticArrivals, color, weight. Configuración
opcional y estricta frontend/backend; proyectos anteriores conservan sus valores.
Actores, reloj, petición y entregas no se persisten. Mundo anterior decorativo
`workshop` y los demás ejemplos quedan intactos. Sin migración/dependencias/SDK/
firmware/ABI. Exportación Arduino/ESP-IDF y reglas usan componentes ya existentes.

Pruebas reproducibles:

```powershell
node --experimental-strip-types scripts/conveyor-world.test.mjs
node --experimental-strip-types scripts/simulator-worker-smoke.mjs
npx playwright test tests/conveyor.spec.ts --project=chromium --workers=1
npm run typecheck
npm run lint
npm run test:smoke
npm run build
```

Modelo puro: lectura inválida/estable, color vacío, rutas, movimiento independiente
del servo, atasco persistente, rechazo de reversa, distancias, población acotada,
determinismo, límites del armador, JSON y ambos workspaces/generadores/reglas.
Worker: los dos workspaces reales, tres colores/pesos incluido límite exacto a
1×/4×, entregas correctas, conteo, entrada manual antes de Simular, pausa/paso/reset
y flujo automático prolongado. Contratos backend para entorno, geometría y slots.
Navegador: ambos ejemplos y condiciones iniciales/undo/redo/guardar/cancelar.
Los resultados verificados se registran en el contexto de entrega.

Entrega verificada: tipos y lint (también los controles/renderer nuevos), smoke
completo y build final aprobados (diez páginas estáticas). Dieciséis contratos
backend de los cuatro mundos recientes y los dos JSON reales frontend→Django
aceptados. Ambos ejemplos pasan en worker con tres combinaciones color/peso,
incluido el umbral exacto, a 1×/4×; también flujo automático y programa incorrecto
con atasco/reset sin congelar el worker. Tres recorridos Chromium aprobados:
ambos ejemplos con envío/entrega/pausa/reset y condiciones iniciales con
undo/redo/guardar/cancelar. Se inspeccionó captura y corrigieron nombres duplicados.
Los primeros fallos del test del armador eran selectores ambiguos (motor DC
frente a paso a paso; select de color frente al sensor), corregidos sin relajar
los controles ni los resultados esperados. Advertencia de chunk frontend grande
ya existente; build exitoso. Sin compilación SDK ni prueba remota/física.

Pendientes expresos: aceptación humana, maqueta física y renderer/dinámica de
este mundo en Waveshare. No afirmar paridad por funcionar en navegador. La escala
virtual es idealizada; calibración y tiempos reales son responsabilidad de la
aceptación de los sensores existentes. No se compila firmware para esta escena web.

## Actualizar sólo dev1

Como capi, usando el SHA40 entregado:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-51-taller-cinta --commit SHA40
```

Sin --promote ni cambios en main/dev2. El propietario ejecuta la actualización.
Fases 52–55 todavía requieren autorización.
