# Fase 19 — Herramientas pedagógicas y desafíos progresivos

**Estado:** planificada, no autorizada ni implementada.

Este documento amplía la fase 19 existente. Conserva el pedido original de desafíos progresivos e incorpora el inventario completo revisado en Pilas Bloques el 23 de septiembre de 2026. No se copian historias, personajes, escenas ni soluciones: se estudian herramientas de lenguaje, construcción de desafíos, ejecución y acompañamiento.

## 1. Fuente y alcance de la revisión

Se pudo acceder a [Pilas Bloques](https://pilasbloques.program.ar/online/emberPB/index.html) sin iniciar sesión y recorrer sus niveles Principiante, Intermedio y Avanzado. Se inspeccionaron el catálogo y desafíos representativos de procedimientos, decisiones, repetición condicional, sensores numéricos y parametrización. No se encontró una plataforma oficial distinta llamada «Polibloques»; este plan asume que el nombre se refería a Pilas Bloques.

Fuentes primarias complementarias:

- [Repositorio actual de Pilas Bloques](https://github.com/Program-AR/pilas-bloques-app).
- [Notas de versión del editor Ember](https://github.com/Program-AR/pilas-bloques-ember/blob/develop/notasDeVersion.md), que documentan resaltado, procedimientos, parámetros, expectativas, sugerencias, importación y validaciones.
- [Repositorio de ejercicios](https://github.com/Program-AR/pilas-bloques-exercises).
- [Secuencia didáctica oficial sobre procedimientos](https://repositorio.curriculum.program.ar/wp-content/uploads/tainacan-items/55/5073/SDC-7-creamos-desafios-de-procedimientos.pdf).

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

## 5. Inventario completo de ejecución y apoyo observado

- Resaltado del bloque que se ejecuta.
- Resaltado simultáneo de llamada y cuerpo del procedimiento.
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
- Navegación entre desafíos relacionados.

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
- paleta de categorías/bloques y límites justificados;
- conjunto de semillas/variantes y datos de simulación;
- objetivo funcional y expectativas conceptuales;
- pistas ordenadas y explicación posterior;
- política de intentos, reinicio y continuidad;
- recursos visuales/sonoros con licencia y accesibilidad;
- pruebas de soluciones válidas, alternativas y errores cercanos;
- migración o convivencia con versiones anteriores.

El proyecto del alumno sigue siendo un proyecto portable normal vinculado a una asignación, no una edición del enunciado.

## 8. Motor de validación

El validador se ejecuta con fixtures sintéticos y límites estrictos:

1. valida estructura/escena y que no haya bloques incompletos;
2. ejecuta el programa en varias semillas reproducibles;
3. observa resultados funcionales sin depender de animación visual;
4. aplica expectativas conceptuales configuradas;
5. devuelve hechos concretos, no una comparación contra una solución secreta;
6. conserva evidencia mínima por intento sin guardar telemetría infantil innecesaria.

Los validadores se versionan con el desafío. Un error del validador se distingue de una solución incorrecta y no consume ni altera un logro.

## 9. Progreso, docentes y privacidad

Por cuenta se guarda desafío/versión, estado, intentos, pistas solicitadas, proyecto asociado y fecha. El docente ve el progreso permitido de sus cursos y los conceptos que presentan dificultad; no recibe una reproducción oculta de cada gesto ni acceso por ser administrador global.

No habrá ranking público, comparación entre alumnos ni premio que sustituya la explicación conceptual. Reintentos y logros son idempotentes; revocación de curso/cuenta se aplica con permisos frescos.

## 10. Interfaz

- Catálogo por tramos, conceptos, edad, simulador/hardware y asignación docente.
- Tarjeta con objetivo, herramientas que se practicarán y requisitos, sin revelar estrategia.
- Área de pistas graduadas y explicación final.
- Indicador de variante/semillas sin mostrar respuestas.
- Botones reiniciar desafío, abrir copia, guardar, simular, validar y retomar claramente distintos.
- Paleta específica visible como decisión del desafío; los bloques globales no desaparecen fuera del reto.
- Ejecución guiada entra en procedimientos y vuelve a la llamada; `según` destaca valor, caso elegido o rama por defecto.
- Accesibilidad por teclado, texto ampliado, lector, movimiento reducido y alternativas a color/sonido.

## 11. Plan de construcción dentro de la fase

Es una única fase; estos son hitos internos, no subfases independientes:

1. Congelar esquema versionado de desafío, validador y progreso.
2. Implementar `según` en JSON, Blockly, simulador, validación y generadores.
3. Implementar paleta/escena/proyecto inicial por desafío sin afectar el editor normal.
4. Crear ejecución multisemilla y validación funcional determinista.
5. Incorporar expectativas conceptuales configurables y feedback verificable.
6. Integrar pistas, explicación, guardado/reanudación y progreso por cuenta.
7. Crear catálogo inicial propio, primero sin hardware, con pruebas de soluciones alternativas.
8. Agregar depuración de programas iniciales, retos creativos y variantes complementarias.
9. Incorporar retos de componentes/hardware sólo cuando su fase esté aceptada.
10. Validar con docentes y chicos de 8–12 años, accesibilidad, Chrome/Edge y privacidad.

## 12. Pruebas y aceptación

- Solución esperada, al menos una alternativa válida y varios errores cercanos por desafío.
- Semillas distintas detectan soluciones rígidas sin volver aleatoria la calificación.
- Paletas no contaminan proyectos normales ni invalidan proyectos portables.
- `según` cubre casos numéricos/textuales/enumerados, caso por defecto, duplicados, tipos, importación y todos los runtimes disponibles.
- Pistas no revelan la solución antes de tiempo y mantienen accesibilidad.
- Guardar/salir/retomar/reiniciar no sobrescribe enunciado ni trabajo ajeno.
- Progreso aislado por cuenta/curso, versión y permisos; correcciones del catálogo no borran logros sin explicación.
- Los primeros desafíos funcionan enteramente en simulación. Un reto físico distingue compilar, grabar, conectar y validar hardware.
- Métricas pedagógicas evalúan comprensión y fallos del diseño; no incentivan reducir bloques como objetivo universal.

## 13. No objetivos

- Copiar desafíos, personajes, arte o textos de Pilas Bloques.
- Exigir una solución única o premiar siempre el menor número de bloques.
- Crear un ranking público.
- Habilitar inicialmente un creador libre de desafíos para cualquier usuario.
- Incorporar tutor de IA o chat como requisito de la fase.
- Declarar comprendido un concepto sólo porque la escena terminó una vez.

