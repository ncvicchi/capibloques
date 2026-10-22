# Fase 59 — Cinemática v3 y trayectorias de una pata

Entrega posterior a [posturas por ángulos](FASE_59_GORILLABOT_POSTURAS.md).
El propietario confirmó THIGH_SERVO_MG90S_v3 del 3MF de ocho piezas y autorizó
este resto de59. Rama `codex/fase-59-gorillabot-trayectorias`, desde origin/dev1
`6909d040497f6a4a2083d1a2992dd4a68a080e05`. No se operan main, dev2 ni
servidores. No se implementa marcha60 ni equilibrio/teleoperación.

## Fuente y medidas comprobadas

Paquete local GorillaBot the 3D Printed Arduino Autonomous Sprint Quadruped
Robot - 4577379, proporcionado por el propietario. Autor original Sebastian
Coddington, Thingiverse4577379; LICENSE.txt indica CC BY-NC-SA. No se copian
código, mallas, imágenes ni manual del autor al producto. Se conservan hechos
geométricos, identificación y un analizador propio de lectura.

- THIGH y THIGH_SERVO_MG90S_v3: **50mm entre articulaciones**.
- CALF_EXT y CALF_INT: **100mm entre articulaciones** en ambos casos.
- BASE_FRONT y BASE_BACK: **46mm entre ejes** de cada par, ambos a z6mm.
- El pie calculado es el centro del perno L4, **no** el contacto de la pieza
  FOOT con el piso. No se aplica un radio de apoyo al modelo59.

Medición reproducible sin dependencias:

```bash
python scripts/measure-gorilla-v3.py /ruta/al/paquete/files
```

Lee STL binarios, identifica centros mediante consenso de arcos circulares,
comprueba nominales a0,1mm e imprime evidencia y SHA256. No usa las dimensiones
exteriores como longitudes de las barras y no ejecuta scripts suministrados.
También verifica ocho objetos, unidad milímetro y transformaciones sin escala
del 3MF. No modifica los archivos originales.

Identificación de las piezas principales:

| Archivo | SHA256 |
| --- | --- |
| INDIVIDUAL_THIGH_SERVO_MG90S_v3.stl | 19bcf78203aa5be0ee7705b37b2d4bf3aa8bae4143eb472d9529b249c88f4d18 |
| INDIVIDUAL_CALF_EXT.stl | de5f9149088d75fff329db62a9b30eadd11e2cc39a1cabea1eedc8d8bb103913 |
| INDIVIDUAL_CALF_INT.stl | 87604bebf7cd2e1add2b2401ba75ad283c63d2fb166b1062798476b83e3f1060 |
| INDIVIDUAL_BASE_FRONT.stl | fe009c57b3a2c39f918ce9bd0de1f04efceefc20a1d639aad8515a438b24d7ba |
| THIGH_SERVO_MG90S_v3_x8.3mf | 86a3e2f079bca7f9347f682d1a374b2a5bff095cf7c9f2e0a54447b224150ea5 |

El visor de armado local usa46,1mm y98,9mm para la pantorrilla exterior:
son aproximaciones que NO se adoptan. La nueva medición corrige ambas.

## Convenios y calibración

Perfil fijo `gorilla-v3-50-100-46`. A es el muslo delantero/CALF_EXT;
B es el trasero/CALF_INT, en las cuatro patas. Plano longitudinal, x positivo
hacia adelante del robot, y hacia abajo internamente. La interfaz usa adelante
y arriba relativos al pie en la referencia de esa pata.

`config.kinematics` opcional:
profile, zeroAngles[8], pulseMinUs, pulseMaxUs, verified. zeroAngles expresa
orientación geométrica del muslo cuando el ángulo lógico es0:0° hacia adelante,
90° hacia abajo,180° hacia atrás. Se permiten45–135°, no son ángulos físicos
medidos por un sensor. Un incremento lógico aumenta ese ángulo; la inversión
del servo existente resuelve el montaje reflejado. Valores iniciales90° sólo
para vista previa, **sin verificar**.

Calibrar un servo no determina automáticamente la posición del brazo instalado.
Verificar referencias A/B, sentidos y pulsos con el montaje sostenido antes
de habilitar hardware. La confirmación es un procedimiento adulto, no un permiso
de rol ni un certificado o realimentación. Cambios de calibración de servos
invalidan la confirmación geométrica; cambios de geometría/pulsos la invalidan
en el editor. Cambiar pulsos también invalida la revisión general del componente.

Se conservan canales y escala anteriores,1000–2000µs. El programa adaptado
suministrado usa544–2400µs y orden de canales distinto:
DI A/B0/1, DD A/B7/6, TI A/B2/3, TD A/B5/4. No aplicarlos automáticamente.
Los pulsos configurables500–1200/1800–2500µs deben contrastarse con cada unidad
y oscilador PCA9685; no se certifica un giro real a partir del número enviado.

## Cinemática y ejecución

FK: dos muslos50mm y cierre de dos círculos100mm separados por sus rodillas.
IK: solución analítica de cada cadena2R, rama fija A−acos/B+acos y cierre
inferior. Se comprueba que la reconstrucción FK coincida con el objetivo.
No se cambia de rama para alcanzar un punto; no hay recorte silencioso.

Guardas numéricas conservadoras: rodillas debajo de los ejes, separación
horizontal de rodillas≥4mm, distancia entre rodillas4–198mm, seno normalizado
del ángulo muslo/pantorrilla≥0,12 y argumento de acos con valor absoluto<0,995.
Además, límites lógicos±20° y centro/inversión/límites calibrados. No son un
modelo CAD de colisiones entre piezas ni una certificación mecánica.

Antes de mover se revisan **todos** los tramos, incluida la entrada desde la
posición ordenada actual. La IK inicial debe reconstruir los mismos ángulos
que esa posición: no se salta a la otra rama de articulación tras un bloque
manual de ángulos. Muestreo determinista mínimo16 subdivisiones/tramo,
paso máximo0,25mm y máximo256 subdivisiones. La ejecución reevalúa IK en cada
actualización; cualquier fallo detiene el recorrido con error.

Interpolación cartesiana en cada segmento, no interpolación de ángulos entre
extremos. Duración ampliada según máxima tasa angular muestreada más5% de margen
para30°/s. Transferencias I2C acotadas y servicio cooperativo con el mismo reloj,
pausa/Paso/STOP. Un dueño de movimiento del robot, sin preempción; otros caminos
no relacionados continúan. No FIFO prometido entre escritores.

La salida física está cuantizada por PCA9685/servo; no se promete precisión
submilimétrica. La posición real tras encender/reiniciar no se conoce: Preparar
sigue sin centrar servos. La primera orden puede partir de otra posición física.
Detener conserva el último pulso, no desenergiza ni garantiza apoyo.

## Editor, bloques y límites

Armar escena → GorillaBot → **Editar trayectorias de una pata**. Modal amplio
con perfil/calibración, plano adelante/arriba, muestras alcanzables, puntos
arrastrables y campos, alta/baja/reordenado de puntos, nombres/IDs estables,
deshacer/rehacer60, guardar/cancelar, preview local con pausa y progreso.
Guardar aplica al borrador; después Guardar cambios/Guardar escena.

Hasta8 trayectorias,16 puntos cada una, nombre1–40 caracteres, una pata por
trayectoria. Cada punto: forward±50mm, up±30mm, ms entero200–10000; suma pedida
≤120s, cada tramo efectivo≤30s y total efectivo≤180s. Estos rangos editoriales
NO hacen alcanzables todos sus puntos. Se señala el primer tramo inválido.
Arcos son polilíneas editables, no curvas spline ocultas.

Bloques en Movimiento: mover pie adelante/arriba en segundos; recorrer
trayectoria1–20 veces. Repetición usa el bucle común. Una trayectoria retirada
produce diagnóstico, nunca se sustituye por otra. Guardado/JSON/backend estrictos
y compatibilidad con proyectos58/59 sin geometría. El banco muestra el mecanismo
medido cuando existe perfil, no oculta una referencia inválida con el dibujo viejo.

Dos ejemplos nuevos completos: **GorillaBot: trayectorias de una pata** y
**GorillaBot: trayectorias con procedimientos**. Preparar, referencia y tres
ciclos levantar/apoyar y rectángulo; biblioteca incluye arco. Modular:
tres procedimientos/dos pestañas. Ejemplos anteriores conservados.

## Runtime, evidencia y aceptación pendiente

Intérprete mínimo **1.13.0**, ABI/formato1, capacidad gorilla-kinematics-v3.
Acciones gorilla/foot y gorilla/path. Planificador geométrico en TS y en núcleo
C++ común exports Arduino/ESP-IDF e intérprete; no compilar por proyecto.
No migraciones/dependencias nuevas, conservar SDK/objetos/cache incremental.

Pruebas: medición STL/3MF,220posiciones FK/IK TS↔C++, tres presets/tasa/rechazo
íntegro/parada/rollover/fallo de bus, funciones reales de validación/preparación
del intérprete compiladas con HAL, ejemplos reales en worker1×/4×, backend y
9/9 recorridos Chromium de ejecución/editor, repetición de arrastre/undo y
un décimo de editar/guardar/ejecutar sin recargar. La firma de dispositivos del
workspace incluye config Gorilla para no compilar puntos de una biblioteca vieja.
Prueba de entrada desde otra rama, sin salto, en TS/C++. Tipos/lint/build y
smoke completo aprobados. Estado final en contexto vivo.

**Pendientes:** actualización/aceptación dev1 por el propietario; build SDK
completo y prueba real de una pata v3 sostenida, calibración por unidad, escalas
de pulso/oscilador y holguras. No se probaron aquí servos físicos ni se operó DEV.
La fase59 queda implementada en software con estas aceptaciones, no se inicia60.
