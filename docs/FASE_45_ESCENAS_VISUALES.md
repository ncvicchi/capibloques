# Fase 45 — Escenas atractivas y fidelidad visual completa

## 04/11/2026 — Fase 45: tráfico con composición compartida

Entrega en `codex/dev3-fase45-trafico`, creada desde `origin/dev3` (`ec7d277`)
e incorporando por avance rápido la optimización ya autorizada (`51415e7`).
No se promueven `dev3`, `dev1`, `main` ni `dev2`. La vista de trabajo DEV3
usa esta rama; no se actualizan los servicios ni los datos del servidor original.

### Qué cambia

- Un plano lógico de 960 × 540 define fondo, calles, pasos peatonales, escuela,
  árboles, flechas, semáforos, matrices opcionales y nombres. Editor y simulador
  escalan juntos geometría y tipografía; Waveshare consume ese mismo plano con
  escala uniforme y márgenes, conservando sus barras de control.
- El cuerpo del semáforo permanece vertical; su flecha indica el carril. Los
  cuatro anclajes mantienen sus coordenadas, sin mover objetos del proyecto.
- Los rótulos buscan espacio libre determinísticamente, fuera de componentes,
  calles y otros rótulos. Se probaron los cuatro semáforos con nombres largos y
  ambas matrices. Dos líneas, tamaño fijo legible y `...` explícito; el nombre
  completo se conserva en el proyecto, inspector y descripción accesible web.
  Fuente 5 × 7 común con acentos españoles, ñ y ü; otros caracteres tienen
  sustitución visual, sin modificar el nombre original.
- Autos y peatones usan dibujos vectoriales comunes. Se elimina la representación
  nativa antigua de autos estáticos ficticios: Waveshare tiene ahora población,
  colas, despeje, choques, pausa y reinicio con el mismo modelo de tráfico.
  Ambos motores avanzan en pasos de 20 ms. La velocidad seleccionada en web
  se aplica al reloj de los actores; esto no convierte dos relojes físicos
  independientes en un sistema sincronizado a nivel de frame.
- El indicador de ejecución queda dentro del semáforo, sin una burbuja extensa
  que tape los nombres. Se corrigió también el recorte de rectángulos fuera de
  pantalla y se ajustaron las zonas táctiles a la nueva transformación.

### Archivos y compatibilidad

`lib/traffic-presentation.ts` produce la descripción compacta; los componentes
React la dibujan y `interpreter/main/traffic_document.h` la valida/dibuja mediante
`traffic_canvas.h`. `traffic_world.h` contiene el modelo nativo contrastado con
TypeScript. Se conserva el renderer anterior para paquetes antiguos sin plano.

Intérprete **1.16.0**, ABI 1, capacidad **traffic-scene-v1** sólo en Waveshare.
El nuevo plano se añade a CapiRules sólo para el cruce en Waveshare; no cambia
el JSON portable, no agrega imágenes descargadas y conserva el límite de 32 KiB.
La escena de prueba de cuatro semáforos, nombres largos y matrices produce
8.625 bytes con un programa mínimo; programas más grandes siguen sujetos al
límite global. Waveshare requiere actualizar firmware antes de enviar reglas
nuevas. Wemos/DevKit conservan mínimo 1.15.0 y no reciben metadatos de pantalla.

No se certifica aquí la fidelidad de todos los componentes genéricos ni de las
otras escenas: conservan sus dibujos anteriores. Una escena arbitrariamente
saturada puede agotar espacio para rótulos; la cobertura de esta entrega es el
cruce con sus cuatro semáforos y carteles, no una promesa de espacio ilimitado.

### Verificación y pendientes

- Typecheck, lint, smoke completo, USB y empaquetado: aprobados en DEV3.
- `npm run test:traffic-presentation`: cuatro nombres sin colisiones, geometría,
  orden determinista, tamaño de reglas, fuente común, recorte y **6.000 pasos
  diferenciales C++/TS**, incluidos autos/peatones, choques, permisos y reinicio.
- `tests/traffic-presentation.spec.ts`: **4/4 en Chrome y Edge**, con ventana
  angosta, zoom, guardar, cambiar nombre, deshacer, rehacer y cancelar. Captura
  revisada; los artefactos generados quedan fuera de Git.
- ESP-IDF 5.5.5: intérprete 1.16.0 compilado y empaquetado para Wemos, DevKit S3
  y Waveshare, conservando objetos/SDK/cachés. La última reconstrucción S3
  reutilizó objetos y sólo necesitó nueve pasos, no una compilación de todo IDF.
- Para las pruebas Node de DEV3 se usó el ejecutable 22.23.2 del contenedor
  oficial ya fijado por el proyecto, en `work/tools/node` (ignorado), porque el
  Node de Ubuntu no ejecuta el runner TS. No se cambió el Node del sistema.

**Pendiente físico:** comprobar composición, lectura, touch, memoria y fluidez
con una Waveshare real. No se grabó ninguna placa ni se declaró una aceptación
física por pruebas de navegador. Las restantes escenas y herramientas de esta
fase conservan sus pendientes: fase 45 sigue en curso, tráfico entregado en software.

Para continuar localmente en DEV3, consultar [DEV3_VM_LOCAL.md](DEV3_VM_LOCAL.md).
La web de prueba está en http://localhost:3003/ mediante el túnel habitual.
No usar el actualizador del servidor original para instalar esta rama. Integrar
o actualizar otros ambientes requiere pedido explícito del propietario.

Ampliación del 17 de octubre: las mecánicas de mundos interactivos se planifican
en [PLAN_MUNDOS_INTERACTIVOS.md](PLAN_MUNDOS_INTERACTIVOS.md), fases 46–55.
Peatones corresponde a fase 46, no a un cierre de esta fase. La paridad visual
y de actores en Waveshare sigue siendo aceptación separada y explícita.

Estado: **en curso; segunda entrega funcional el 3 de octubre de 2026**.
Reúne y amplía la antigua asignación de fidelidad espacial de fase 21; no queda
duplicada allí.

### Recuperación de la oferta de aventuras — 14 de octubre de 2026

La rama `codex/adventures-pilot-v2` parte de `93561ab`, integra `origin/main` y
añade el revert explícito `646d730` de `5731650`, de modo que el PR restaure
Cruce de la escuela, Pista de reparto, Huerta inteligente, Entrada segura y
Estación del clima, junto con su flujo para seleccionarlas y combinarlas desde
«Armar escena». El piloto visual y los refinamientos locales de identidad se
reaplicaron. Typecheck, lint, smoke básico, workbench, mundos/plantillas y
`git diff --check` pasaron. La smoke suite completa no pudo ejecutarse porque
`frame-animation` e `interpreter-source` necesitan `g++`, ausente en `capi-dev`;
no se instaló toolchain. E2E/aceptación visual, capturas/mediciones y aceptación
física de Waveshare quedan pendientes; el PR #1 sigue abierto y la fase no cierra.
Los checks del primer head del PR fallaron en firmware (tipos no declarados tras
el preprocesador Arduino) y en `verify` (`idf-driver.test.mjs` no ejecutó su
binario nativo); esa revisión precede al revert explícito y requiere una nueva
ejecución antes de integrar o desplegar.
En `e98e0b8`, CI falló: Arduino ubicó prototipos para `OttoDevice` antes del tipo;
ESP-IDF encontró dos líneas Waveshare rechazadas por `-Werror`; `idf-driver`
falló cuando `g++` devolvió `status=null` al compilar `runtime`; la prueba
omitía señal/stdout/stderr. Se amplió su mensaje de diagnóstico para la siguiente
ejecución. En el árbol local sin subir, el
proyecto Arduino se exporta como ZIP con `.ino` mínimo y encabezado generado,
para impedir que Arduino reordene esos prototipos. El editor, revisión docente,
compilador servidor y fixtures usan el mismo esquema; las dos líneas Waveshare
se separaron. Pasan typecheck, lint dirigido y pruebas locales dirigidas, pero
Arduino ya pasó Wemos, S3 y siete perfiles en CI, y el build ESP-IDF/backend también
pasó en run 273. `verify` aún falla en `idf-driver`: `g++` devuelve `status=null`
compilando `runtime`; la señal/causa sigue sin aparecer en el log pese al ajuste
de diagnóstico subido. `g++` y Arduino CLI no están instalados localmente. No
integrar/desplegar hasta resolver `idf-driver` y obtener CI verde.

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

## Ajustes de interfaz del armador — 15 de octubre de 2026

Por pedido explícito del propietario se retiró del armador el selector de placa,
se simplificó el encabezado para mostrar los estados y el cierre, y se dio más
ancho al inspector derecho reduciendo la proporción del tablero. El campo de
nombre de escena permanece; unificarlo con el nombre del proyecto está pendiente
de resolver cómo se representan recuperación e importación. Los cambios están
en commits separados `ec01571`, `d9879f3` y `50c2cad`.

DEV se actualizó desde `50c2cad` con `./scripts/update-dev.sh --fast`; la imagen
activa y la salud del editor quedaron verificadas por el orquestador. La limpieza
Docker quedó incompleta por tener menos de 2 GiB libres. CI completa para el
commit falló en `verify`: `scripts/idf-driver.test.mjs` informó `status=null` al
compilar `runtime`; backend aprobó y `esp-idf`/`firmware` no quedaron confirmados
por el cierre temprano. La actualización rápida se hizo tras reiteración
explícita del propietario. Esto no cierra la fase ni sus aceptaciones visuales,
de uso y físicas.
