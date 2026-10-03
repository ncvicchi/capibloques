# Fase 45 — Escenas atractivas y fidelidad visual completa

Estado: **en curso; segunda entrega funcional el 3 de octubre de 2026**.
Reúne y amplía la antigua asignación de fidelidad espacial de fase 21; no queda
duplicada allí.

## Entregado en la primera implementación

- Cinco aventuras nuevas y serializables: **Cruce de la escuela**, **Pista de
  reparto**, **Huerta inteligente**, **Entrada segura** y **Estación del clima**.
  Usan únicamente componentes actuales y también pueden combinarse desde Armar
  escena.
- Diez fondos vectoriales locales en total. Parque, taller, casa y laguna ya no
  dependen sólo de franjas; cruce, pista, huerta, entrada y patio meteorológico
  tienen zonas reconocibles y escalan con el mismo lienzo lógico de 960 × 540.
- El cruce contiene cuatro lugares válidos para semáforos, todos sobre el jardín
  junto al cordón y fuera del asfalto. Al agregar o mover uno se encaja en esos
  puntos y se impide agregar un quinto. Cada punto está después de la
  intersección en el sentido del auto que controla: este, oeste, sur o norte.
  Flechas sobre los carriles y una vista superior junto a las tres luces muestran
  la orientación; la cara del semáforo mira al tránsito que se aproxima. Los
  nombres automáticos son **Semáforo 1–4**, siempre usando el primer número libre.
  Sólo se mueven entre esquinas libres: soltarlos sobre una ocupada conserva su
  lugar anterior. La flecha superior rota una sola vez y coincide con el carril.
  Un semáforo no puede agregarse ni copiarse a otro fondo, y un cruce que ya
  contiene semáforos no puede cambiar de fondo hasta quitarlos. Las calles son de doble mano y el editor
  permite habilitar por separado autos hacia derecha, izquierda, abajo y arriba;
  también admite una escena sin tránsito. Con dos semáforos, cada uno controla
  ambos sentidos de su eje para conservar las escenas anteriores; al agregar los
  cuatro, cada sentido responde al semáforo de su acceso. Sus autos son
  actores persistentes del mundo, no listas CSS recreadas: conservan identidad
  y posición. Ante rojo forman fila; al pasar de verde a amarillo sólo terminan
  de cruzar quienes ya superaron la línea donde se detienen en rojo, mientras
  quienes todavía no la pasaron forman fila y esperan el próximo verde. La misma
  frontera se aplica si cambia directamente a rojo: nunca se detiene dentro del
  cruce a un auto que ya superó la línea. **Apagado equivale a amarillo para el
  tránsito**: no reinicia ni borra autos, deja salir a quienes ya cruzaron la
  línea y detiene a quienes todavía no llegaron. Su orientación coincide con
  el sentido de circulación y su avance usa la velocidad del simulador. No hay
  una cantidad fija ni autos que den vueltas: cada entrada genera vehículos en
  momentos independientes y ampliamente variables; cada auto se destruye al
  salir de la escena. La población cambia durante la ejecución y está acotada a
  doce para conservar claridad y rendimiento. El azar es determinista y
  comprobable. Un choque congela a los vehículos que efectivamente coinciden
  dentro del cruce. **Reiniciar** restablece el mundo completo además del
  programa: retira autos, filas y choques, reinicia la secuencia aleatoria y
  devuelve todos los componentes a su estado inicial. Detener o apagar un
  semáforo no dispara ese borrado.
- Cada semáforo admite dos carteles opcionales de un único módulo MAX7219 8×8.
  El vehicular es un segundero y muestra únicamente 0–9 o apagado. El peatonal
  muestra una persona caminando, una persona quieta o apagado. Al usar ambos se
  encadenan y comparten
  DIN, CLK y CS. Hay bloques, simulación, Arduino, ESP-IDF y CapiRules/intérprete
  1.5.7 para ambos estados.
- La pista dibuja salida, ruta y meta sin convertir la línea en órdenes ocultas:
  el programa sigue controlando íntegramente el robot.
- Editor y simulación usan la misma capa vectorial y coordenadas. El intérprete
  Waveshare **1.5.7** consume el mismo identificador de fondo, conserva la
  transformación de posiciones y dibuja versiones compactas de los cinco mundos,
  incluidos autos/atasco/choque del cruce. Los nombres largos usan tipografía
  compacta para no invadir la tarjeta vecina.
- Hay prueba automática de validez JSON, plantillas, encaje y límite de carriles.

## Entregado en la segunda implementación

- El editor permite seleccionar varios objetos con **Ctrl/Cmd o Mayús + clic**,
  arrastrarlos juntos y alinearlos a izquierda, centro horizontal, arriba o
  centro vertical. Con tres o más también puede distribuirlos horizontal o
  verticalmente. El movimiento grupal respeta los límites del lienzo.
- La grilla puede configurarse en 10, 20 o 40 puntos y el encastre sigue siendo
  opcional. Grilla, alineaciones, distribución y movimiento forman parte del
  historial normal de Deshacer/Rehacer; la cámara continúa fuera del proyecto.
- Al arrastrar, guías magenta detectan el centro del lienzo y los centros de
  otros objetos; dentro de una tolerancia pequeña el objeto se encastra en esa
  coordenada. Las guías son transitorias y no entran en el JSON.
- **Adelante/Atrás** conserva un orden transversal entre componentes y widgets
  mediante `canvas.itemOrder`. Es una extensión opcional del JSON de escena v1:
  los proyectos anteriores sin ese campo mantienen su orden y posición. El
  backend acepta, valida y persiste únicamente ids vivos y sin duplicados.
- Un catálogo único de cajas lógicas define el área de semáforo, robot, Otto,
  displays, mensajes, contador y componentes comunes. Editor y simulador usan
  esas dimensiones y el mismo orden visual.
- El editor detecta superposiciones relevantes, marca los objetos y explica que
  el aviso no impide composiciones intencionales ni ejecuta auto-layout oculto.
- Los nombres cercanos reciben anclas deterministas arriba, abajo o a los
  costados; los objetos no se mueven para resolver el rótulo. Los nombres largos
  conservan elipsis y texto completo accesible.
- El renderer Waveshare consume `itemOrder`, pinta de atrás hacia adelante y
  aplica la misma elección determinista de anclas laterales/superiores/inferiores
  para componentes cercanos. Los proyectos sin orden explícito conservan el
  recorrido histórico del arreglo de dispositivos.
- Pruebas puras cubren cajas, solapamientos, anclas, alineación, capas y
  compatibilidad con escenas anteriores. Un recorrido Chromium cubre selección
  múltiple, grilla, alineación, capas, Guardar y el recorrido previo de
  mover/Deshacer/Rehacer/cámara.

Quedan dentro de esta fase la comparación estable por capturas de referencia.
La salida Waveshare 1.5.7 requiere compilación en DEV y
aceptación física; una compilación correcta no sustituye esa prueba. También
faltan las mediciones máximas de memoria, paquete y tiempo de dibujo.

## Objetivo

Hacer que las escenas sean visualmente ricas y que una composición creada en
**Armar escena** conserve fondo, posiciones, tamaños, alineaciones, capas y
nombres en la simulación web, revisión docente y Waveshare.

## Escenas más lindas

- Rediseñar las plantillas existentes. El jardín deja de ser tres franjas y
  agrega cielo, terreno, sendero, vegetación, flores, nubes y detalles suaves que
  ayuden a contar una historia sin competir con los componentes.
- Aplicar el mismo criterio a ciudad/semaforización, robot, aula, laboratorio y
  demás fondos: profundidad simple, zonas reconocibles, paleta infantil y puntos
  útiles de colocación.
- Preferir primitivas/vectoriales, paletas y mosaicos reutilizables. Las imágenes
  raster grandes se preparan en variantes web/placa con licencia y presupuesto
  explícitos; no se descarga arte remoto durante la ejecución.
- Fondos decorativos no cambian lógica, colisiones ni cableado. Ofrecer reducción
  de detalle/contraste y respetar movimiento reducido.

## Un solo modelo visual

- Definir un lienzo lógico normalizado, anclas y cajas visuales compartidos por
  editor, simulación, revisión y renderer Waveshare. El tamaño del panel puede
  escalar o encuadrar con letterbox, nunca redistribuir automáticamente objetos.
- Persistir fondo, decoración, `x/y`, tamaño, rotación admitida, capa y ancla en
  un contrato JSON versionado y migrar proyectos anteriores sin moverlos.
- Separar capas deterministas: fondo, decoración, componentes, estado/efectos,
  nombres y selección. El orden visual guardado se conserva en todos los destinos.
- La cámara —zoom/desplazamiento— sigue siendo transitoria y no altera la escena,
  autoguardado, historial ni coordenadas del objeto.

## Nombres y componentes cercanos

- La caja manipulada en el editor coincide con el dibujo real, incluidos nombres
  y adornos. No se permite seleccionar una caja pequeña que después ocupe mucho
  más al ejecutarse.
- Los rótulos usan anclas alternativas y resolución determinista de colisiones.
  Si dos semáforos están juntos, sus nombres no se pisan: se ubican arriba,
  abajo o al costado y, cuando haga falta, usan una línea corta hacia el objeto.
- Resolver colisiones de rótulos no mueve los componentes ni cambia las
  distancias elegidas. Nombres largos tienen límite visible, elipsis y detalle
  accesible; no se achican hasta resultar ilegibles.
- Detectar y avisar solapamientos problemáticos durante la edición, sin impedir
  superposiciones intencionales ni aplicar un auto-layout oculto.

## Paridad con Waveshare

- El paquete de reglas/escena incluye una descripción compacta del fondo y la
  decoración compatible. El renderer 800 × 480 dibuja primero el fondo y luego
  los mismos objetos y rótulos con transformaciones compartidas.
- Si un recurso excede memoria o no está soportado, el editor lo informa antes
  de enviar y ofrece una degradación explícita; nunca reemplaza el fondo por
  franjas genéricas sin avisar.
- Web y placa comparten colores semánticos, orientación, nombres y estados. Se
  aceptan diferencias tipográficas/antialiasing propias del hardware, no cambios
  de composición.

## Herramientas de autoría

- Vista previa inmediata del borrador con Guardar/Cancelar, Deshacer/Rehacer y
  autoguardado correctamente separados.
- Guías de alineación, distribución y encastre opcionales, rejilla configurable,
  orden adelante/atrás y selección múltiple. Nada de esto altera proyectos al
  abrirlos ni obliga a usar auto-layout.
- Permitir escoger una plantilla enriquecida, fondo simple o color accesible sin
  crear decenas de tipos de escena incompatibles.

## Aceptación

- El jardín y al menos cuatro plantillas adicionales tienen fondos enriquecidos
  coherentes en editor, simulación, revisión y Waveshare.
- Una escena con display, barrera y semáforo casi pegados conserva distancias y
  alineación a distintas resoluciones, zoom y orientación.
- Una escena con dos semáforos de nombres largos no superpone rótulos en web ni
  en Waveshare 800 × 480, y tampoco mueve los semáforos para resolverlos.
- Pruebas comparan cajas/anclas/transformaciones normalizadas y capturas de
  referencia; no se valida sólo a ojo en una pantalla.
- Importar proyectos anteriores, mover, Guardar/Cancelar, Deshacer/Rehacer,
  historial y recuperación no pierden trabajo ni cambian la composición.
- Se miden memoria, tamaño del paquete y tiempo de dibujo en Waveshare con el
  máximo admitido de objetos y decoración.
