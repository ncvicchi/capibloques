# Fase 53 — Estación meteorológica y puesto protegido

Reglas aprobadas por el propietario el 18 de octubre de 2026 antes de implementar.
Rama `codex/fase-53-estacion-meteorologica`, creada desde origin/dev1 `b079ca1`.
Incluye además el plan documental de fase 56 ya publicado, todavía no integrado
en dev1, para conservar ese backlog en la entrega. No implementa esa fase.
Entrega web; no integrar main/dev2 ni operar servidor.

## Disposición y componentes

Vista lateral 960 × 540: cielo/terreno, mástil exterior, detector siempre
expuesto y puesto con mesa bajo techo móvil. A diferencia de la huerta,
la actividad es medir, informar, observar tendencias, alertar y proteger;
no hay plantas ni riego.

| Función | Componente existente | Lugar |
| --- | --- | --- |
| Temperatura/humedad/presión | BME280 | (210,220) |
| Luminosidad exterior | Sensor de luz | (345,220) |
| Humedad del detector | Agua y lluvia | (370,365) |
| Techo móvil | Servo | (650,245) |

Un componente por cada lugar funcional. Los sensores permanecen fuera del
techo y no se pueden arrastrar debajo para cambiar silenciosamente su función.
Se pueden renombrar y configurar sus pines/perfiles. Si se quitan, se avisa y
no se recrean; sin servo el puesto queda expuesto. Pantalla, LEDs y buzzer
opcionales de posición libre; la plantilla/ejemplos incluyen una pantalla
20×4, luz del puesto, aviso de lluvia y buzzer. Límites generales conservados.

No hay viento medido ni anemómetro: no inventar una lectura por tener una
animación. No modificar la plantilla histórica weatherStation/weatherYard.
La nueva escena se identifica como weatherLab.

## Condiciones y evolución

Cuatro condiciones preparadas: Soleado, Nublado, Lluvia suave, Lluvia intensa;
día/noche independiente. Las mediciones cambian gradualmente, no con azar en
cada frame. Objetivos didácticos, no modelo físico certificado:

| Condición | Temperatura día | Humedad | Presión | Luz día /4095 | Lluvia virtual |
| --- | --- | --- | --- | --- | --- |
| Soleado | 28 °C | 40% | 1017 hPa | 3600 | Ninguna |
| Nublado | 22 °C | 65% | 1011 hPa | 1600 | Ninguna |
| Suave | 19 °C | 80% | 1008 hPa | 950 | Baja |
| Intensa | 17 °C | 92% | 1003 hPa | 450 | Alta |

Noche resta 4 °C al objetivo térmico y lleva luz a 100. Transiciones
exponenciales: luz 1,5 s, temperatura 15 s, humedad 12 s y presión 30 s.
Lecturas del componente redondeadas a una décima para ambiente, entero para luz
y humedad del detector; no mostrar largas fracciones de coma flotante.
Los objetivos de presión ilustran tendencias, **no una garantía/pronóstico**.
Ningún ejemplo deduce lluvia de presión baja.

Secuencia automática reproducible, un cambio cada 20 segundos simulados:
soleado de día → nublado de día → lluvia suave de día → intensa de noche →
nublado de noche → soleado de día → repetir. El ciclo incluye un tramo seco
suficiente para comprobar reapertura y nuevos episodios. No es clima aleatorio
ni una predicción del mundo real. Elegir clima o día/noche manualmente detiene
la secuencia; habilitarla otra vez continúa desde una fase compatible.

## Detector, techo y consecuencias

- Detector siempre expuesto: se moja progresivamente; después de llover se
  seca a 2,5 puntos porcentuales/s. Lluvia suave moja 5,4 puntos/s e intensa 12.
  Porcentaje significa humedad de esa superficie, **no mm ni intensidad de lluvia**.
- El booleano «está mojado» respeta el umbral configurado del componente
  (20 por defecto). El programa también puede comparar su nivel numérico.
- Servo 0° cerrado, 90° abierto; recorrido gradual de 1,2 s. El programa decide.
  Un techo no conectado/ausente deja la mesa expuesta, no protegida gratis.
- La mesa se moja según intensidad y fracción de apertura. Cerrar evita nueva
  exposición progresivamente, pero no borra el agua acumulada. En tiempo seco
  se seca lentamente (0,8 puntos/s de día, 0,35 de noche).
- Mesa mojada es una **consecuencia visual**, no otra variable de sensor físico.
  Para leer humedad de mesa desde bloques haría falta agregar un sensor propio.
  No se muestra como propiedad inventada de BME280/servo/detector.
- Sensores exteriores no cambian porque el techo cierre. Luz del puesto/LED
  no altera el sensor exterior. Sin automatismos ocultos de alarma o protección.
- Mojarse no destruye el programa ni exige reset: el alumno puede observar,
  corregir y recuperar. No inferir fallas eléctricas reales de esta simulación.

## Editor, pruebas y persistencia

Armar escena → **Clima al comenzar** guarda condiciones iniciales y modo
automático mediante el borrador normal: Deshacer/Rehacer/Guardar/Cancelar.
En Estado, botones de prueba cambian clima/día/noche y permiten la secuencia
sin modificar el proyecto guardado. Revisión docente ofrece los mismos ensayos.
No se muestran sliders manuales competidores para los sensores de este mundo,
ni se acepta SET_INPUT por sus IDs. El modo espejo de placa no habilita esos
botones como si fueran lecturas/control del hardware.

Un reloj worker para clima, lluvia dibujada, servo, sensores y programa.
Pausa congela todo; Paso y velocidad lo afectan; Reiniciar restaura condiciones
iniciales, techo, secuencia y limpia humedad de detector/mesa. Detener no
equivale a borrar el mundo. Ensayos previos a Simular/Paso sobreviven al LOAD
interno del mismo proyecto; reset/otra escena no los heredan.

`canvas.weatherEnvironment?`: condition, night, automatic; opcional para
proyectos anteriores, estricto frontend/backend. background/sourceTemplate/
simulation.scene amplían con weatherLab. No guardar frames, humedad acumulada,
fase de ciclo o medidas en JSON/autoguardado. Sin migración/dependencias/SDK/
firmware/ABI nuevos: se usan bloques y sensores existentes.

## Dos ejemplos completos

En **Proyecto → Ejemplos**:

1. **Estación que informa.** Secuencial: alterna temperatura/humedad/presión/
   estado del detector en pantalla, señala detector mojado y regula una luz con
   oscuridad. Deja techo abierto deliberadamente: permite observar mesa mojada.
   No usa buzzer repetitivo ni promete protección.
2. **Puesto protegido con procedimientos.** Cuatro procesos cooperativos:
   informe, techo, luz y avisos. Techo cierra con detector >35 y reabre <10;
   luz enciende <1200 y apaga >1800. Buzzer una vez por episodio >35, espera <10
   antes de admitir otro aviso. Esa espera bloquea sólo su hilo, no informe/
   techo/luz. Ocho procedimientos y cinco pestañas, un único comienzo.

Ambos traen secuencia automática para probarlos sin tocar controles. La pantalla
alterna mensajes/mediciones, no es una consola científica ni un pronóstico.
Los números entran por bloques de valores de componente; no hay decisiones
del ejemplo ocultas en el renderer. Cambiar umbrales es trabajo del programa.
Exportaciones Arduino/ESP-IDF y reglas usan los mismos componentes existentes.

## Pruebas y entrega

```powershell
node --experimental-strip-types scripts/weather-world.test.mjs
node --experimental-strip-types scripts/weather-worker.test.mjs
npx playwright test tests/weather.spec.ts --project=chromium --workers=1
npm run typecheck
npm run lint
npm run test:smoke
npm run build
```

Modelo puro: cambios graduales, humedad residual, exposición independiente,
mesa/techo, determinismo, configuración/JSON y generadores/reglas.
Worker con ambos workspaces reales a 1×/4×: exposición/protección, cierre/
reapertura, luz, un aviso por episodio (y otro tras secarse), secuencia
automática prolongada, bloqueo de entradas competidoras y pausa/paso/reset.
Contratos backend y documentos JSON reales generados por frontend. Navegador:
ambos ejemplos y editor con condiciones/undo/redo/guardar/cancelar.
Resultados finales en el contexto vivo.

Resultado local: tipos/lint, smoke completo y build aprobados, diez páginas
estáticas. Veinticuatro contratos backend de seis mundos recientes y los dos
JSON reales frontend→Django aceptados. Ambos workspaces a1×/4× pasan protección,
secado/reapertura, luz y avisos por episodio; dos ciclos automáticos comprobados.
Tres recorridos Chromium aprobados. Capturas inspeccionadas, con ajustes
posteriores de contraste nocturno y techo abierto. Se corrigió una carrera al
usar dos controles rápidamente: selección transitoria hasta ACK del worker,
limpiada por escena/época, sin efectos sobre el documento. La prueba de pausa
espera la confirmación Reanudar antes de comparar frames. Sin SDK/hardware/
operación remota. Advertencia de chunk grande existente, no fallo de build.

Pendientes expresos: aceptación del propietario, sensores/servo/pantalla físicos
y renderer/dinámica de este mundo en Waveshare. No afirmar paridad por funcionar
en web ni compilar SDK para esta entrega. Fases 54–56 siguen sin autorización
para implementar (55 de análisis; 56 mantiene su documento de planificación).

Como capi en capi-dev, con SHA40 entregado:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-53-estacion-meteorologica --commit SHA40
```

El propietario integra/actualiza sólo dev1; sin --promote ni cambios en main/dev2.
