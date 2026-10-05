# Fase 43 — Efectos y animaciones de pantallas

**Estado al 5 de octubre de 2026:** **entregada en software, ampliada con animación por cuadros; DEV y aceptación física pendientes**.

## Animaciones por cuadros — ampliación autorizada

- En las propiedades de Matriz LED y pantalla gráfica: Nueva animación abre un
  borrador modal con nombre, miniaturas, dibujo grande, duplicar, quitar y
  reordenar cuadros. Puede aprovechar dibujos guardados. Cancelar no modifica
  la escena; Guardar animación actualiza el borrador de escena y Guardar escena
  confirma el conjunto. Importación/exportación JSON conserva las secuencias.
- Hasta 4 animaciones de 16 cuadros por dispositivo. Matriz: 32 × 8 puntos;
  OLED/TFT: dibujo monocromático 16 × 8 centrado, no imagen a pantalla completa.
  LCD de caracteres no ofrece esta función.
- Importar PNG/JPG/WebP agrega cuadros en el orden de los archivos seleccionados.
  Conversión local: encuadre proporcional centrado, píxeles oscuros encendidos,
  fondo blanco/transparente apagado. Se revisa y edita antes de guardar. Límite
  visible de cuadros; cada imagen hasta 10 MiB y 4096 × 4096 píxeles.
- Cada animación define 40–2000 ms por cuadro. El bloque «Mostrar animación»
  selecciona una vez, N veces (2–100) o sin parar. Corre en segundo plano;
  «esperar a que termine» sincroniza y «detener efecto» conserva el cuadro actual.
  Otra escritura/dibujo/borrado/animación reemplaza la reproducción. Al terminar
  una secuencia finita queda su último cuadro.
- Simulador, fuentes Arduino/ESP-IDF e intérprete incluyen la operación. Runtime
  mínimo **1.8.0**, capacidad `frame-animation`, formato/ABI sin cambios. Firmware
  anterior se actualiza desde el asistente antes de enviar reglas.
- Evidencia local: smoke completo, tipos/lint, dos recorridos Chromium 16/32
  (dibujar, duplicar, importar, guardar, exportar/reimportar y ejecutar el bloque), reproducción cooperativa del
  worker, validación/configuración/CapiRules y C++ generado Arduino/nativo
  compilado con `-Wall -Wextra -Werror`. Playback del intérprete también se prueba
  en C++ con repetición y desbordamiento de reloj. Estas pruebas no equivalen a
  una compilación completa con ESP-IDF ni a aceptación física; ambas quedan
  para actualizar DEV y grabar/probar el firmware 1.8.0 en los módulos reales.

## Entrega implementada

- Pantalla de texto conserva un solo bloque de animación y ahora permite máquina
  de escribir, letras en secuencia, entrada horizontal desde ambos lados,
  desplazamiento vertical, rebote, persiana, apertura desde el centro y
  parpadeo. Dibujo gráfico ofrece quieto, entrada desde ambos lados, persiana,
  apertura central, invertir y parpadear.
- Una vez, N veces y sin parar comparten el planificador cooperativo existente.
  `detener efecto` cancela explícitamente y conserva el cuadro actual;
  `esperar a que termine` sólo espera en su camino. Escribir, borrar o iniciar
  otro efecto reemplaza al anterior.
- Pantalla gráfica y Matriz LED comparten un editor modal grande 16 × 8 o
  32 × 8. Incluye lápiz, borrador, línea, curva rasterizada, rectángulo vacío o
  lleno, elipse, balde, desplazamientos, volteos, invertir, limpiar,
  Deshacer/Rehacer y vista previa real. Mouse, táctil y activación de píxeles
  por teclado trabajan sobre un borrador local: Cancelar no toca la escena y
  Guardar produce un solo cambio reversible desde el editor de escena.
- Matriz LED incorpora `poner brillo ... al ... %`; simulador, Arduino,
  ESP-IDF e intérprete convierten 0–100% a los 16 niveles MAX7219. El brillo
  inicial 0–15 sigue en la escena y los proyectos anteriores siguen siendo
  válidos.
- CapiRules conserva formato 1/ABI 1 y exige intérprete **1.7.0**. El firmware
  anterior se detecta antes de enviar reglas y la interfaz ofrece actualizarlo.
  La ampliación por cuadros eleva este mínimo a 1.8.0.
- Pruebas automáticas cubren herramientas geométricas, relleno, transformaciones,
  tiempos acotados, migración JSON, código Arduino/ESP-IDF, CapiRules, fuente del
  intérprete, tipos, lint, build y el recorrido visual del modal.

Quedan como ampliaciones posteriores del catálogo —no como promesas falsas del
hardware actual— selección rectangular/copiar/pegar, importación de imágenes a color,
color, fundidos/zoom y patrones generativos de matriz. La aceptación física
queda pendiente en LCD 16 × 2, LCD 20 × 4, SSD1306, ILI9341/ILI9488 y MAX7219.

## Objetivo

Ampliar los efectos de **Pantalla de texto** y **Matriz LED** sin convertir cada
animación en un bloque distinto ni detener sensores, motores, mensajes u otros
caminos. El alumno elige qué mostrar, un efecto y una forma de repetición; la
interfaz sólo ofrece opciones que el display elegido puede representar de
verdad.

Esta fase extiende las animaciones cooperativas ya entregadas. Conserva una
sola pantalla por proyecto, el bloque explícito `esperar a que termine` y la
regla de que una escritura, borrado o efecto posterior reemplaza de manera
determinista al efecto anterior.

## Catálogo propuesto

### Texto, aplicable según capacidad del display

- **Quieto:** aparece completo y permanece visible.
- **Parpadeo:** alterna visible/oculto; puede terminar quedando visible.
- **Máquina de escribir:** aparecen los caracteres uno por uno.
- **Letras en secuencia:** el mensaje ya está ubicado y cada letra se enciende
  de izquierda a derecha, derecha a izquierda o desde el centro.
- **Desplazamiento horizontal:** entra o circula hacia izquierda/derecha.
- **Desplazamiento vertical:** sube o baja por filas; en LCD de caracteres se
  mueve por renglones completos, no se promete desplazamiento de píxeles.
- **Rebote:** el mensaje va y vuelve dentro del área disponible.
- **Cartel continuo:** el final vuelve a unirse con el comienzo, con separación
  configurable segura.
- **Persiana:** revela u oculta por columnas o por filas.
- **Abrir/cerrar:** aparece desde el centro hacia los bordes o al revés.
- **Alternar mensajes:** cambia entre dos o más textos predefinidos.
- **Cursor:** escribe con un cursor visible y lo apaga al finalizar.

### Pantallas gráficas OLED/TFT

- **Entrada y salida:** deslizar desde un borde, caer, subir o aparecer desde el
  centro.
- **Fundido:** variar luminosidad/color cuando el controlador lo permita; en
  monocromo se usa tramado explícito y nunca se finge brillo analógico.
- **Zoom suave:** crecer o reducir dentro de una zona sin salirse de sus límites.
- **Ola:** desplazar letras o columnas con un pequeño desfase vertical.
- **Temblor:** movimiento corto y acotado, útil para alarmas simuladas.
- **Giro por pasos:** sólo 0°, 90°, 180° y 270° cuando texto y zona lo admitan.
- **Invertir:** alternar figura/fondo o color principal/secundario.
- **Barrido de color:** recorrer el texto o dibujo con una paleta elegida.
- **Dibujar por trazos:** revelar progresivamente una figura infantil.
- **Secuencia de dibujos:** reproducir cuadros predefinidos o creados por el
  alumno, con un límite pequeño y visible de memoria.
- **Reacciones:** latir un corazón, parpadear una cara, mover ojos, sonreír o
  cambiar entre expresiones de avatar.

### Matriz LED 32 × 8 y matrices equivalentes

- Desplazar texto a izquierda/derecha y, si la geometría alcanza, arriba/abajo.
- Encender letra por letra, columna por columna, fila por fila o desde el centro.
- Rebote, persiana, invertir y pulso de intensidad.
- **Lluvia de puntos**, **destellos**, **onda**, **serpiente** y **barrido**.
- Transición entre dos dibujos: corte, persiana, disolver por puntos o barrido.
- Caras y avatares simples con parpadeo, mirada lateral y boca animada.

Los efectos que requieren color no aparecen en matrices monocromáticas. Los
que requieren más de una fila no aparecen en LCD 16 × 2/20 × 4 cuando la zona
no alcanza. La interfaz debe explicar brevemente por qué una opción está
deshabilitada.

## Bloques y configuración infantil

No habrá decenas de bloques casi iguales. La propuesta inicial es:

- `mostrar [texto/dibujo] con efecto [efecto]`;
- `detener efecto de [pantalla]`;
- `esperar a que termine [pantalla]`.

El inspector del bloque ofrece sólo lo necesario: dirección o variante,
velocidad **lenta/normal/rápida**, y ejecución **una vez / N veces / sin parar**.
Opcionalmente puede incluir una pausa breve entre repeticiones. Los parámetros
avanzados permanecen ocultos por defecto. Un texto dinámico toma una instantánea
de sus variables al comenzar el efecto; para actualizarlo, el programa vuelve a
ejecutar el bloque. Así simulador y placa producen el mismo resultado.

## Editor cómodo de dibujos personalizados

Crear una imagen no debe hacerse en la cuadrícula diminuta del inspector. Al
elegir **Crear dibujo** o **Editar dibujo**, se abre un modal amplio que conserva
visible el nombre, las dimensiones y una previsualización al tamaño real. La
cuadrícula usa todo el espacio disponible, admite zoom sin cambiar los píxeles
y muestra con claridad filas, columnas y posición del puntero.

Herramientas propuestas:

- lápiz y borrador, con trazo continuo al arrastrar;
- línea recta y curva, con previsualización antes de confirmar;
- rectángulo, elipse/círculo y variantes sólo borde o rellenas;
- balde de relleno para una región cerrada;
- selección rectangular para mover, copiar, cortar o borrar una parte;
- desplazar un píxel en cualquier dirección, voltear e invertir;
- limpiar todo, Deshacer y Rehacer con botones grandes y atajos de teclado;
- biblioteca inicial de formas, caras y avatares que pueda copiarse y editarse.

En matrices monocromáticas las herramientas trabajan con encendido/apagado; en
perfiles con color se habilita una paleta pequeña y apropiada. El editor no
promete curvas de resolución inexistente: rasteriza la previsualización sobre
la geometría real y permite aceptar o corregir el resultado. Debe funcionar con
mouse, pantalla táctil y teclado; nunca depender sólo del color. **Guardar**
aplica un único cambio reversible al proyecto, mientras **Cancelar** conserva
el dibujo anterior. Cerrar accidentalmente con cambios pide confirmación.

La vista puede superponer guías —centro, tercios o dibujo anterior— sin
guardarlas como píxeles. Importar imágenes externas queda fuera del alcance
inicial: antes requiere definir recorte, escala, umbral, privacidad y formatos.

## Brillo según capacidad del módulo

La matriz MAX7219 ya tiene brillo inicial de **0 a 15** en Armar escena. Esta
fase lo hace visible también como acción del programa: `poner brillo de [matriz]
a [porcentaje]`. El alumno usa 0–100%; cada perfil lo convierte a su rango
nativo y expone el último brillo ordenado como dato consultable.

Parpadeo, pulso y fundido reutilizan la misma capacidad sin competir con un
segundo controlador. Al terminar, su cuadro final y brillo quedan definidos. Si
el hardware sólo permite encendido/apagado o brillo fijo, el bloque no aparece y
la ayuda explica la limitación. Simular menor brillo es una representación
visual, no una medición de luminosidad o corriente.

## Ejecución y límites

- Todos los efectos usan el planificador cooperativo; nunca llaman esperas
  bloqueantes para producir cuadros.
- Cada pantalla mantiene un único efecto activo y estado acotado. Un nuevo
  contenido cancela el anterior y libera sus recursos.
- Detener el programa cancela animaciones, temporizadores y cuadros pendientes.
- Simulador, Arduino, ESP-IDF y firmware intérprete comparten duración,
  repetición, cancelación y cuadro final observables.
- El ritmo se basa en tiempo, no en cantidad de iteraciones, para que otros
  caminos no alteren la velocidad.
- Texto, cuadros y memoria tienen límites derivados del perfil. El editor los
  muestra antes de ejecutar y nunca deja que un exceso congele la simulación.
- El simulador respeta `prefers-reduced-motion`: ofrece una vista reducida sin
  cambiar la lógica ni depender de movimiento o parpadeo para comunicar estado.
- Parpadeos rápidos, destellos intensos y frecuencias riesgosas quedan
  excluidos; los estados importantes conservan texto accesible.

## Orden implementado y extensible

1. Unificar el motor de línea de tiempo y su tabla de capacidades por perfil.
2. Sustituir la cuadrícula pequeña por el editor modal con herramientas,
   historial local y vista previa fiel.
3. Unificar brillo inicial, bloque programable, estado consultable y efectos de
   intensidad según la capacidad declarada por cada perfil.
4. Entregar el núcleo común: quieto, parpadeo, máquina de escribir, secuencia,
   desplazamientos en cuatro direcciones, rebote y persianas.
5. Agregar efectos gráficos, dibujos y avatares sólo a OLED/TFT compatibles.
6. Agregar patrones específicos de matriz y límites de intensidad/memoria.
7. Extender `CapiRules` y publicar intérpretes versionados; firmware antiguo
   debe rechazar reglas con capacidades nuevas y ofrecer actualización.
8. Verificar equivalencia temporal/cancelación y hacer aceptación física en
   LCD 16 × 2, LCD 20 × 4, ILI9341 y matriz MAX7219 disponibles.

## Aceptación

Corrección del 5 de octubre de 2026: la captura se realiza sobre el lienzo,
con coordenadas calculadas desde el puntero y preview durante el arrastre.
Línea, curva, rectángulo, relleno y círculo ya no toman la casilla inicial como
destino. El lápiz/borrador interpola el recorrido y cada gesto tiene un único
paso de Deshacer. Se verificaron las herramientas y balde, Deshacer/Rehacer y
guardar/reabrir en 16×8 y 32×8 con Chrome y Edge instalados (4 pruebas E2E).
La corrección es web; no cambia reglas ni versión del firmware. DEV pendiente
de actualización por el propietario.

- El mismo proyecto muestra una animación equivalente en simulador y placa.
- Motores, sensores, temporizadores y caminos paralelos continúan avanzando
  durante cualquier efecto, incluso `sin parar`.
- Una vez, N veces, sin parar, detener, reemplazar y esperar tienen resultados
  deterministas y visibles dentro del componente.
- Cada perfil ofrece únicamente efectos soportados y explica los deshabilitados.
- Los límites de texto/cuadros se validan al editar, importar, simular y enviar
  reglas; ningún exceso bloquea la aplicación.
- El editor modal permite crear y corregir un dibujo con lápiz, línea, curva,
  formas y relleno sin acertar píxeles diminutos; Guardar/Cancelar y
  Deshacer/Rehacer son predecibles con mouse, táctil y teclado.
- En perfiles regulables, el brillo inicial, el bloque, los efectos y el estado
  consultable coinciden; en perfiles fijos no se ofrece un control ficticio.
- Se prueban cambio de placa/display, guardar/importar, Deshacer/Rehacer,
  reducción de movimiento y firmware incompatible.
