# Fase 19 — Herramientas pedagógicas y desafíos progresivos

**Estado:** planificada, no autorizada ni implementada.

Este documento amplía la fase 19 existente. Conserva el pedido original de desafíos progresivos e incorpora las dos revisiones de Pilas Bloques realizadas el 23 de septiembre de 2026: primero su catálogo y editor clásico y luego, en profundidad, la aplicación 3.0.2, su creador de desafíos, formato versionado, análisis estructural, recursos docentes y propuesta desenchufada. No se copian historias, personajes, escenas ni soluciones: se estudian herramientas de lenguaje, construcción de desafíos, ejecución y acompañamiento.

## 1. Fuente y alcance de la revisión

Se pudo acceder sin iniciar sesión tanto a la [aplicación actual de Pilas Bloques](https://pilasbloques.program.ar/online/#/) —versión pública 3.0.2 al revisar— como al [editor Ember anterior](https://pilasbloques.program.ar/online/emberPB/index.html). Se recorrieron los niveles Principiante, Intermedio y Avanzado, desafíos representativos y el creador actual. Se inspeccionaron procedimientos, decisiones, repetición condicional, sensores numéricos, parametrización, depuración, ejecución paso a paso, escenas múltiples y autoría. «Polibloques» era una referencia imprecisa a Pilas Bloques.

Fuentes primarias complementarias:

- [Repositorio actual de Pilas Bloques](https://github.com/Program-AR/pilas-bloques-app).
- [Creador visual público](https://pilasbloques.program.ar/online/#/creador/seleccionar).
- [Modelo versionado de desafíos creados](https://github.com/Program-AR/pilas-bloques-app/blob/develop/src/components/serializedChallenge.ts).
- [Expectativas estructurales](https://github.com/Program-AR/pilas-bloques-app/blob/develop/src/components/blockly/mulang/expectations.ts) y [feedback localizado sobre bloques](https://github.com/Program-AR/pilas-bloques-app/blob/develop/src/components/blockly/mulang/blockFeedback.ts).
- [Notas de versión del editor Ember](https://github.com/Program-AR/pilas-bloques-ember/blob/develop/notasDeVersion.md), que documentan resaltado, procedimientos, parámetros, expectativas, sugerencias, importación y validaciones.
- [Repositorio de ejercicios](https://github.com/Program-AR/pilas-bloques-exercises).
- [Recursos oficiales para docentes](https://pilasbloques.program.ar/docentes/) y [Pilas Bloques Desenchufado](https://pilasbloques.program.ar/pilas-bloques-desenchufado/).
- [Secuencia didáctica oficial sobre procedimientos](https://repositorio.curriculum.program.ar/wp-content/uploads/tainacan-items/55/5073/SDC-7-creamos-desafios-de-procedimientos.pdf).

El hallazgo arquitectónico principal es que el desafío separa cinco dimensiones: escena inicial, bloques disponibles, programa inicial, resultado funcional y expectativas pedagógicas. CapiBloques debe conservar esa separación y aplicarla sobre sus proyectos portables, escenas componibles y componentes físicos.

## 2. Inventario completo de herramientas de lenguaje observadas

### 2.1 Secuencias y primitivas

Acciones elementales dependientes de la situación, combinadas en un orden explícito. Cada desafío puede limitar las primitivas visibles para reducir ruido y definir las estrategias posibles.

### 2.2 Repetición simple

Repetir una cantidad conocida de veces para reconocer patrones y sustituir copias de la misma secuencia.

### 2.3 Decisión simple

Ejecutar una rama sólo cuando una condición se cumple.

### 2.4 Decisión completa

Elegir entre dos ramas mediante `si / si no`. Algunos desafíos cambian el escenario entre ejecuciones para impedir una solución fija.

### 2.5 Repetición condicional

Repetir mientras o hasta que una condición cambie, especialmente cuando la cantidad de pasos no se conoce anticipadamente.

### 2.6 Sensores booleanos

Preguntas del escenario que producen sí/no y se encastran en decisiones o repeticiones: presencia, borde, objetivo alcanzado, estado de un objeto u otra propiedad equivalente.

### 2.7 Sensores numéricos

Valores producidos por el escenario que pueden compararse o controlar una repetición. Pilas Bloques los presenta como sensores numéricos en lugar de simular funciones mediante variables.

### 2.8 Procedimientos

Crear acciones nuevas a partir de primitivas, darles un nombre y reutilizarlas. Permiten descomponer el problema y expresar intención.

### 2.9 Procedimientos parametrizados

Una misma acción recibe tamaño, dirección, cantidad u otro valor para resolver familias de subproblemas sin duplicar definiciones.

### 2.10 Valores tipados o enumerados

Números y dominios como direcciones se modelan como valores apropiados, evitando comparar textos arbitrarios cuando existe un conjunto cerrado.

### 2.11 Descomposición en subtareas

El escenario y las restricciones hacen visible que una solución se compone de partes repetibles. Los procedimientos pueden definirse antes de completar su contenido para favorecer diseño descendente, siempre con estado incompleto comprensible.

### 2.12 Estructuras anidadas

Repeticiones dentro de procedimientos, decisiones dentro de repeticiones y otras composiciones. La estructura del programa puede evaluarse además de su resultado.

### 2.13 Depuración de programas existentes

Actividades que parten de una solución incorrecta o incompleta para observar, localizar y corregir el error, en lugar de construir siempre desde cero.

### 2.14 Programa inicial incompleto

El desafío puede entregar bloques que deben ordenarse, completar o sustituir. Esto permite focalizar una noción sin exigir reconstruir todo el contexto.

### 2.15 Dibujo tipo tortuga

Movimiento, giro y trazado sirven para trabajar geometría, repetición, procedimientos y parámetros mediante una salida visual inmediata.

### 2.16 Lectura y escritura mediante primitivas

Algunos personajes ofrecen comportamientos de lectura/escritura. En CapiBloques la idea se traslada a Mensajes, consola, pantallas y valores, no a copiar personajes o historias.

## 3. Nueva herramienta acordada: `según` (switch)

No se observó una estructura `switch` en los desafíos revisados. CapiBloques incorporará un bloque infantil **`según [valor]`** porque mejora programas que comparan repetidamente un único estado con alternativas excluyentes.

Contrato:

- Evalúa el valor una sola vez.
- Contiene dos o más casos y una rama opcional **«en cualquier otro caso»**.
- Los casos tienen el mismo tipo que el valor: número, texto, sí/no o estado enumerado.
- No admite casos duplicados ni vacíos silenciosos.
- No existe caída de un caso al siguiente ni se expone `break`.
- El orden visual no cambia la igualdad; la primera coincidencia única ejecuta su rama.
- Para intervalos —por ejemplo temperatura menor a 10, entre 10 y 20— se usan condicionales, no casos disfrazados.
- Para estados de componentes ofrece únicamente valores declarados por el perfil: por ejemplo rojo/amarillo/verde/apagado.
- Renombrar, cambiar perfil o borrar un componente revalida referencias como en la fase 32.
- Simulador, firmware intérprete, Arduino y ESP-IDF conservan la misma semántica. C/C++ puede usar `switch` para dominios compatibles; texto puede generarse como comparaciones equivalentes sin cambiar el bloque visible.

Ejemplos propios posibles: actuar según el mensaje recibido, el modo de un robot, el estado de un semáforo o una selección de menú. No se copiarán desafíos de Pilas Bloques.

## 4. Inventario completo de herramientas de construcción de desafíos

### 4.1 Paleta específica por desafío

Cada actividad decide categorías, primitivas y estructuras disponibles. Restringir bloques es una decisión pedagógica versionada, no una mutilación global del lenguaje.

### 4.2 Escenarios variables

Un mismo programa se valida contra disposiciones, cantidades o estados diferentes. El alumno debe construir una solución general.

### 4.3 Varias ejecuciones o semillas

Cuando existe aleatoriedad, completar una única ejecución no alcanza. El validador usa un conjunto reproducible de semillas y explica que está comprobando otros casos.

### 4.4 Objetivo funcional y conceptual separados

El objetivo funcional describe qué debe ocurrir. El conceptual puede comprobar uso razonable de repetición, procedimientos, parámetros, decisiones u otra noción, sin exigir una única forma exacta.

### 4.5 Expectativas estructurales

El motor puede observar, cuando sea pedagógicamente necesario:

- presencia y llamadas de procedimientos;
- cantidad/longitud de bloques;
- repetición en lugar de copia mecánica;
- uso y anidación de estructuras;
- parámetros reutilizados;
- bloques desconectados o innecesarios;
- ramas/casos cubiertos;
- división en subtareas.

Una expectativa estructural nunca reemplaza la prueba funcional ni rechaza una solución alternativa válida sin justificación docente explícita.

### 4.6 Múltiples soluciones válidas

Se valida comportamiento y propiedades conceptuales, no igualdad contra un XML/JSON modelo ni coordenadas exactas de bloques.

### 4.7 Pistas conceptuales progresivas

Las pistas explican qué idea revisar, luego orientan hacia una categoría y sólo al final muestran un ejemplo parcial. No entregan de entrada la cadena completa.

### 4.8 Sugerencias activables

El alumno puede pedir u ocultar sugerencias. La ayuda no ocupa permanentemente el espacio de trabajo ni interrumpe una ejecución.

### 4.9 Progresión explícita

Secuencia pedagógica de referencia:

1. editor, simulación y secuencias;
2. repetición simple;
3. procedimientos y descomposición;
4. decisión simple;
5. decisión completa;
6. repetición condicional;
7. sensores booleanos y numéricos;
8. variables, expresiones y textos;
9. procedimientos con parámetros;
10. `según` y estados enumerados;
11. temporizadores y eventos;
12. caminos paralelos;
13. mensajes, pantallas y comunicación;
14. hardware físico cuando exista y haya sido validado.

### 4.10 Desafíos creativos libres

Después de un tramo guiado se ofrece un espacio de creación que reutiliza las mismas herramientas sin una única meta.

### 4.11 Desafíos complementarios graduados

Variaciones cortas aumentan una sola dimensión de dificultad y permiten práctica adicional sin repetir exactamente la misma escena.

### 4.12 Navegación y continuidad

Anterior/siguiente, tramo actual, requisitos, progreso y recomendación docente visibles. El orden recomendado no impide al docente asignar otro recorrido.

### 4.13 Programa inicial con intención pedagógica

El programa entregado por un desafío puede estar:

- vacío, para construir una solución completa;
- parcialmente armado, para ordenar o completar una idea;
- completo pero incorrecto, para localizar y reparar errores;
- funcional pero deliberadamente difícil de leer, para refactorizarlo con repeticiones, procedimientos o parámetros.

La modalidad es parte versionada del desafío. Reiniciar restaura exactamente ese programa sin afectar otros proyectos del alumno.

### 4.14 Depuración como actividad de primera clase

La familia «Corregimos los programas» entrega una solución y propone probarla paso a paso. CapiBloques debe poder crear retos propios de diagnóstico: estados invertidos, orden incorrecto, condición equivocada, timer sin reinicio, módulo de matriz invertido, procedimiento sin llamada o comunicación sin tratamiento de timeout. La validación distingue localizar el problema, corregirlo y explicar la causa cuando el docente lo solicite.

### 4.15 Progresión por contraste

Las familias de actividades conservan personajes y contexto mientras modifican una sola herramienta. CapiBloques aplicará el mismo principio con contenido propio: secuencia → repetición; repetición fija → condicional; `si` → `si/no`; `si/no` repetidos → `según`; espera bloqueante → timer; secuencia larga → procedimiento; procedimiento duplicado → parámetro. Así se reduce la carga ajena al concepto nuevo.

### 4.16 Creador visual de desafíos

La aplicación actual permite seleccionar personaje, editar el tablero, cambiar filas/columnas, colocar objetos y obstáculos, duplicar/eliminar escenarios, escribir título/enunciado/pista, elegir bloques disponibles, previsualizar, descargar, importar y compartir. La adaptación no debe ser un editor paralelo: un docente convierte una escena/proyecto CapiBloques existente en desafío y agrega sobre ella restricciones, variantes, objetivos y ayudas.

El creador de CapiBloques debe permitir como mínimo:

- elegir o copiar un proyecto/escena base;
- editar uno o más estados iniciales y asignarles una semilla reproducible;
- escoger categorías, bloques, componentes, acciones, valores y eventos disponibles;
- definir la modalidad y contenido del programa inicial;
- declarar objetivo funcional, expectativas pedagógicas y pistas ordenadas;
- configurar pruebas visibles y reservadas al docente;
- previsualizar exactamente como alumno antes de publicar;
- guardar borrador, cancelar, deshacer/rehacer, versionar, duplicar, exportar/importar y archivar;
- asignar a cursos sólo después de publicar una versión inmutable.

### 4.17 Autoría por alumnos, con mediación docente

La creación de un reto para que otro alumno lo resuelva es una actividad valiosa, pero no entra como publicación libre inicial. En una evolución posterior, el docente puede habilitar autoría por curso; el alumno diseña escena, consigna, estados, herramientas y pistas, y el docente revisa/acepta antes de compartir. Nunca se publican proyectos infantiles globalmente por defecto.

### 4.18 Actividades abiertas y transferencia

Tras una secuencia guiada se ofrece un laboratorio sin solución única. El objetivo es comprobar si el alumno puede reutilizar espontáneamente lo aprendido. Puede conservar condiciones de seguridad y límites de recursos, pero no una estructura obligatoria ni una única salida visual.

### 4.19 Recursos imprimibles y trabajo desenchufado

La propuesta oficial incluye materiales para imprimir, recortar y jugar. CapiBloques podrá generar desde un desafío una ficha imprimible con consigna, tarjetas de bloques, componentes, diagrama/pinout de la placa, tabla para predecir estados, casos de prueba y un QR para abrir el proyecto. Es una extensión posterior y no condiciona el primer catálogo digital.

## 5. Inventario completo de ejecución y apoyo observado

- Resaltado del bloque que se ejecuta.
- Resaltado simultáneo de llamada y cuerpo del procedimiento.
- Ejecución paso a paso disponible explícitamente en actividades de depuración.
- Modo turbo para acelerar animaciones largas.
- Guardar y cargar soluciones.
- Borrar solución con confirmación apropiada.
- Pantalla completa.
- Modo oscuro.
- Modo de lectura simple.
- Detección de bloques incompletos o conexiones con huecos antes de ejecutar.
- Atenuación de llamadas/parámetros inválidos o bloques no admitidos al importar.
- Feedback final sobre el objetivo.
- Feedback opcional/progresivo sobre expectativas conceptuales.
- Inicio de sesión y recuperación del último trabajo cuando corresponde.
- Escenarios renovados al volver a ejecutar cuando la actividad lo requiere.
- Botón para recorrer escenarios iniciales distintos sin modificar el programa.
- Navegación entre desafíos relacionados.
- Enunciado y pista separados; algunos tutoriales incluyen material audiovisual.
- Vista previa del desafío creado antes de descargarlo o compartirlo.

CapiBloques reutilizará sus mecanismos vigentes de biblioteca, recuperación, historial y cuenta; no copiará formatos de solución ajenos.

## 6. Capacidades no observadas como núcleo de Pilas Bloques

No se identificaron como herramientas centrales del catálogo revisado:

- caminos concurrentes o ejecución paralela;
- timers y eventos cooperativos;
- funciones que devuelven valores;
- variables generales comparables al modelo CapiBloques;
- comunicación entre placas;
- hardware físico configurable y cableado;
- simulador y placa como destinos equivalentes;
- servicios Wi‑Fi;
- controladores de motores, pantallas o luces direccionables configurables.

CapiBloques debe aprovechar esas diferencias sin incorporarlas todas en los primeros desafíos.

## 7. Modelo de datos del desafío

Cada versión inmutable del desafío declara:

- identificador, versión, título, edad orientativa, tramo y conceptos;
- prerequisitos/recomendaciones y si necesita hardware;
- escena confirmada y proyecto inicial copiable;
- modalidad del programa inicial —vacío, parcial, incorrecto o para refactorizar— y su contenido restaurable;
- paleta de categorías/bloques y límites justificados;
- conjunto de semillas/variantes y datos de simulación;
- objetivo funcional y expectativas conceptuales;
- pruebas visibles, pruebas reservadas y política de repetición/reproducción de casos;
- pistas ordenadas y explicación posterior;
- política de intentos, reinicio y continuidad;
- recursos visuales/sonoros con licencia y accesibilidad;
- pruebas de soluciones válidas, alternativas y errores cercanos;
- migración o convivencia con versiones anteriores.

El proyecto del alumno sigue siendo un proyecto portable normal vinculado a una asignación, no una edición del enunciado.

El formato observado confirma la conveniencia de versionar por separado título, enunciado/pista, escena con varios mapas, toolbox, paso a paso, solución inicial, evaluaciones y referencia compartida. CapiBloques ampliará ese contrato con placa/perfil, componentes, conexiones, semillas, eventos, permisos, recursos y migraciones; no reutilizará el archivo ajeno.

## 8. Motor de validación

El validador se ejecuta con fixtures sintéticos y límites estrictos:

1. valida estructura/escena y que no haya bloques incompletos;
2. ejecuta el programa en varias semillas reproducibles;
3. observa resultados funcionales sin depender de animación visual;
4. aplica expectativas conceptuales configuradas;
5. devuelve hechos concretos, no una comparación contra una solución secreta;
6. conserva evidencia mínima por intento sin guardar telemetría infantil innecesaria.

El resultado se comunica en tres niveles independientes:

- **Funciona:** el comportamiento requerido se cumplió en los casos ejecutados.
- **Puede mejorar:** la solución funciona, pero existe una sugerencia pedagógica concreta y localizable.
- **No puede ejecutarse:** hay bloques incompletos, referencias rotas, configuración inválida o un error del propio validador.

Una expectativa pedagógica no convierte automáticamente una solución funcional alternativa en incorrecta. Las restricciones obligatorias deben estar justificadas en la consigna —por ejemplo «resolvelo usando un procedimiento»— y siguen distinguiéndose del resultado físico o simulado.

Los validadores se versionan con el desafío. Un error del validador se distingue de una solución incorrecta y no consume ni altera un logro.

## 9. Progreso, docentes y privacidad

Por cuenta se guarda desafío/versión, estado, intentos, pistas solicitadas, proyecto asociado y fecha. El docente ve el progreso permitido de sus cursos y los conceptos que presentan dificultad; no recibe una reproducción oculta de cada gesto ni acceso por ser administrador global.

La autoría usa permisos explícitos: administrador configura políticas; docente crea/publica/versiona/asigna dentro de sus cursos; alumno resuelve y, sólo si el docente lo habilita, crea un borrador sujeto a aprobación. Compartir por enlace o exportar nunca vuelve público un trabajo infantil por omisión.

No habrá ranking público, comparación entre alumnos ni premio que sustituya la explicación conceptual. Reintentos y logros son idempotentes; revocación de curso/cuenta se aplica con permisos frescos.

## 10. Interfaz

- Catálogo por tramos, conceptos, edad, simulador/hardware y asignación docente.
- Tarjeta con objetivo, herramientas que se practicarán y requisitos, sin revelar estrategia.
- Área de pistas graduadas y explicación final.
- Indicador de variante/semillas sin mostrar respuestas.
- Modo paso a paso y reproducción de la semilla que falló.
- Botones reiniciar desafío, abrir copia, guardar, simular, validar y retomar claramente distintos.
- Paleta específica visible como decisión del desafío; los bloques globales no desaparecen fuera del reto.
- Ejecución guiada entra en procedimientos y vuelve a la llamada; `según` destaca valor, caso elegido o rama por defecto.
- Accesibilidad por teclado, texto ampliado, lector, movimiento reducido y alternativas a color/sonido.
- Editor docente basado en la misma escena, con herramientas laterales separadas, borrador/publicado visibles y vista previa real como alumno.

## 11. Plan de construcción dentro de la fase

Es una única fase; estos son hitos internos, no subfases independientes:

1. Congelar esquema versionado de desafío, programa inicial, autoría, validador y progreso.
2. Implementar `según` en JSON, Blockly, simulador, validación y generadores.
3. Implementar paleta/escena/proyecto inicial por desafío sin afectar el editor normal.
4. Crear ejecución multisemilla y validación funcional determinista.
5. Incorporar expectativas conceptuales configurables y feedback verificable.
6. Integrar pistas, explicación, guardado/reanudación y progreso por cuenta.
7. Incorporar el creador docente sobre proyectos/escenas existentes, con borrador, vista previa, publicación inmutable y asignación.
8. Crear catálogo inicial propio, primero sin hardware, con pruebas de soluciones alternativas y progresión por contraste.
9. Agregar depuración de programas iniciales, retos de refactorización, actividades creativas y variantes complementarias.
10. Incorporar retos de componentes/hardware sólo cuando su fase esté aceptada.
11. Evaluar autoría mediada por alumnos y recursos imprimibles sin volverlos requisito del primer lanzamiento.
12. Validar con docentes y chicos de 8–12 años, accesibilidad, Chrome/Edge y privacidad.

## 12. Pruebas y aceptación

- Solución esperada, al menos una alternativa válida y varios errores cercanos por desafío.
- Semillas distintas detectan soluciones rígidas sin volver aleatoria la calificación.
- Paletas no contaminan proyectos normales ni invalidan proyectos portables.
- `según` cubre casos numéricos/textuales/enumerados, caso por defecto, duplicados, tipos, importación y todos los runtimes disponibles.
- Pistas no revelan la solución antes de tiempo y mantienen accesibilidad.
- Los cuatro tipos de programa inicial se restauran sin afectar otros proyectos y permiten depurar paso a paso.
- Un docente crea un borrador desde una escena, define variantes/paleta/objetivos, lo previsualiza, publica una versión inmutable y la asigna sin editar trabajo del alumno.
- Una semilla fallida puede reproducirse; cambiar de escenario no altera el programa.
- «Funciona», «puede mejorar» y «no puede ejecutarse» nunca se confunden entre sí.
- Guardar/salir/retomar/reiniciar no sobrescribe enunciado ni trabajo ajeno.
- Progreso aislado por cuenta/curso, versión y permisos; correcciones del catálogo no borran logros sin explicación.
- Los primeros desafíos funcionan enteramente en simulación. Un reto físico distingue compilar, grabar, conectar y validar hardware.
- Métricas pedagógicas evalúan comprensión y fallos del diseño; no incentivan reducir bloques como objetivo universal.

## 13. No objetivos

- Copiar desafíos, personajes, arte o textos de Pilas Bloques.
- Exigir una solución única o premiar siempre el menor número de bloques.
- Crear un ranking público.
- Habilitar inicialmente un creador libre de desafíos para cualquier usuario.
- Copiar el creador limitado a personajes/cuadrículas en vez de aprovechar escenas y componentes de CapiBloques.
- Reprobar una solución funcional únicamente porque no coincide con la estructura modelo no declarada.
- Guardar cada gesto o programa infantil como analítica indiscriminada.
- Crear un segundo editor incompatible para los desafíos.
- Incorporar tutor de IA o chat como requisito de la fase.
- Declarar comprendido un concepto sólo porque la escena terminó una vez.
