# Fase 47 — Paso a nivel

Reglas acordadas y autorización de implementación del 17 de octubre de 2026.
Rama de entrega: `codex/fase-47-paso-a-nivel`. Parte del plan de
[mundos interactivos](PLAN_MUNDOS_INTERACTIVOS.md). Las fases siguientes no se
inician por esta autorización.

## Disposición original (configuración de una vía)

- Lienzo lógico 960 × 540. Una vía horizontal y calle vertical de doble mano.
  No hay estación, desvíos ni peatones en esta primera versión.
- Un tren presente a la vez; entra por izquierda o derecha y sale por el otro
  lado. Llegadas variables y reproducibles al reiniciar con el mismo programa.
- Barrera norte y barrera sur, cada una representada por un servo, antes de las
  vías. Norte gobierna autos hacia abajo; sur gobierna autos hacia arriba.
- Dos detectores: oeste/izquierda en x=140, este/derecha en x=820. Según el
  sentido del tren intercambian las funciones de entrada y salida.
- Dos luces rojas de aviso y un buzzer activo. No son semáforos completos.
- Cada servo/detector tiene un lugar válido identificable; máximo dos de cada
  tipo. El armador explica su función, encastra posiciones y deshabilita agregar
  un tercero con motivo visible. Giro no altera la vía ni la función.
- Luces, buzzer y otros componentes transversales conservan su edición normal.
  Son siete componentes físicos existentes, no nuevos dispositivos «tren».

## Qué son los detectores

Primera versión: **barreras infrarrojas digitales**, reutilizando el componente
de fase 28. Entregan haz libre/interrumpido, no distancia ni un evento mágico
de «tren entrando/saliendo». La polaridad LOW/HIGH sigue en la configuración
del componente para adecuarla al módulo de la maqueta.

Ultrasonido mide distancia y un switch mecánico necesita contacto; sensores
Hall/reed podrían detectar imanes. Son alternativas para analizar como perfiles
futuros, **no sustitutos automáticos implementados aquí**. No agregamos nuevos
perfiles, protocolo eléctrico ni ayuda de hardware no verificado por esta fase.

En el simulador, la envolvente del tren (incluidos vagones) mantiene interrumpido
el detector hasta que termina de pasar. El programa puede leer el mismo valor
con un `si`, bucle o dato tipado. La entrada la produce el worker del simulador;
el panel Estado la muestra como automática, sin botones que compitan por ella.
No es telemetría de la placa. Los detectores de las demás escenas siguen siendo
manuales como antes. Reiniciar también limpia las entradas vinculadas al tren.

En una maqueta real no se promete detección continua por el solo hecho de usar
infrarrojo: separación entre vagones, ubicación y forma del tren pueden producir
liberaciones breves. La adaptación y filtrado/despeje deberán ensayarse con el
material concreto. Esta escena no es un sistema de seguridad ferroviaria real.

## Reglas de trenes, barreras y autos

- El tren no frena por barreras ni autos. Tiene longitud: locomotora fuera del
  cruce no equivale a último vagón fuera. El siguiente no se genera antes de que
  salga el anterior en esa misma vía, y los actores se destruyen al abandonar el mundo.
- Los autos llegan de forma variable por ambos accesos y guardan distancia.
  Población máxima de doce, sin reutilizar una lista fija de autos cíclicos.
- Servo a 0°: cerrado; 90° o más: abierto. Ángulos intermedios mantienen el
  acceso cerrado. Recorrer 0–90° tarda 1,2 segundos virtuales; no bloquea el
  camino de bloques. La lectura `angle` existente sigue siendo la orden, no una
  medición física ni el tiempo que falta para completar el recorrido.
- Al empezar a bajar, se detienen quienes todavía no pasaron la línea. Quienes
  la pasaron continúan para despejar, sin frenarse encima de las vías.
- Al subir, la fila espera hasta la apertura completa. La línea de detención
  deja margen entre el frente del vehículo y la barrera, no coloca el auto
  encima del brazo. Una barrera ausente mantiene cerrado su acceso y se avisa.
- Luces y buzzer advierten, pero no detienen autos por sí solos. El mundo no
  cierra barreras ni resuelve el programa del alumno automáticamente.
- Choque sólo por coincidencia espacial auto–tren, no por una señal incorrecta
  cuando no hay vehículo. Marca a ambos, congela el mundo y muestra el aviso
  común de accidente con instrucción de reinicio, sin representación gráfica
  de lesiones. Parar/ejecutar o Paso no borran el accidente.

## Programación esperada

El programa decide todo: reconocer por qué lado llega, avisar, cerrar ambas
barreras, esperar al detector de salida y a su liberación y luego abrir.
**No basta con abrir cuando los dos detectores estén libres**: el tren puede
estar entre ambos. Tampoco basta con que se libere el detector de entrada.
La prueba del worker compila el workspace real del ejemplo y ejecuta esa
misma solución: espera ocupación y liberación del detector opuesto y vuelve
a abrir sin colisiones, en ambos sentidos, con las dos luces y el buzzer.

Corrección pedida por el propietario: **los ejemplos son soluciones completas;
los desafíos son actividades a resolver**. Desde Proyecto → Abrir un ejemplo
→ Paso a nivel se carga un programa completo y editable con Al comenzar,
repetir siempre, decisiones por sentido, aviso luminoso/sonoro, cierre de las
dos barreras, esperas cooperativas del detector de salida y apertura final.
No es una protección oculta del mundo: al editar esos bloques se cambia el
comportamiento. La aventura del editor de escenas sólo agrega componentes,
no sustituye el programa actual ni inserta una solución automáticamente.
No se reemplaza una escena ajena ni sus IDs
por pulsar agregar aventura. Cambiar el fondo de un borrador encastra los
componentes compatibles y conserva Cancelar/Deshacer; el validador detecta
lugares duplicados o fuera de las posiciones admitidas.

## Segundo ejemplo: procedimientos y pestañas

Proyecto → Abrir un ejemplo ofrece dos soluciones independientes: «Paso a
nivel» (directa, conservada sin cambios) y «Paso a nivel con procedimientos».
Ambas usan la misma escena, conexiones, acciones y esperas. No se cambia el
mundo ni se agrega firmware. La modular tiene un inicio y nueve tareas sin
parámetros en cinco pestañas:

- **Principal:** según el detector oeste/este, llama a Vía ocupada, Esperar
  salida este/oeste y Vía libre; repite con espera de 0,05 s.
- **Control del cruce:** Vía ocupada llama a Encender avisos, Cerrar barreras
  y Sonar aviso. Vía libre llama a Abrir barreras y Apagar avisos.
- **Barreras:** las tareas Cerrar/Abrir ordenan 0°/90° a ambos servos.
- **Avisos:** Encender/Apagar controlan ambas luces; Sonar da un beep de 250 ms.
- **Detectores:** Esperar salida este/oeste espera la interrupción del detector
  opuesto y después su liberación por el último vagón.

Las dos ramas reutilizan Vía ocupada/Vía libre, que llaman a tareas pequeñas.
Doble clic abre la pestaña de la definición, incluso en llamadas anidadas.
Las pestañas sólo organizan raíces del mismo workspace. JSON conserva tareas,
nombres y distribución; los dos ejemplos no comparten un workspace mutable.

`scripts/rail-examples.test.mjs`, incluido en mundos, compila ambos workspaces
reales con Blockly, verifica nueve tareas/cinco pestañas y compara la solución
expandida con la directa, ignorando sólo IDs y marcas de navegación de 0 ms.
Comprueba JSON, generación Arduino/ESP-IDF y reglas. El smoke del worker ejecuta
cada ejemplo 192 s simulados: ambos sentidos, luces/buzzer, cierre/apertura,
sin choques, pausa/reset/velocidad/Paso. La prueba de navegador abre el segundo
desde el catálogo, navega dos niveles de llamadas y simula. La aceptación
humana y física y el portado del mundo Waveshare siguen pendientes.

Verificación local de la ampliación modular: tipos/lint, suite smoke completa,
ambos ejemplos en worker a 1× durante 192 s cada uno y recorrido Chromium de
catálogo, pestañas, navegación anidada y cierre/pausa aprobados. Captura del
Principal inspeccionada. No se compiló SDK ni se operó DEV.

## Ampliación: 1, 2 o 4 vías y trenes simultáneos

Pedido posterior autorizado; rama `codex/paso-nivel-multivia`. En Armar escena,
el selector «Cantidad de vías» ofrece 1 (bidireccional), 2 (una por sentido)
o 4 (dos por sentido). Las vías 1 y 3 avanzan hacia la derecha y las 2 y 4
hacia la izquierda, con flechas y números visibles. La versión
de una vía conserva sus dos ejemplos y el comportamiento original.

Hay como máximo un tren por vía: varios pueden circular a la vez en vías
distintas; nunca se genera otro encima del anterior en la misma vía. Los
detectores son independientes: dos por vía, en x=140 y x=820. La envolvente
completa mantiene su haz ocupado. Dos servos comunes protegen toda la calle;
las barreras y líneas de detención se desplazan fuera del conjunto de vías.

Geometría lógica 960×540:

| Vías | Centros Y de vías | Barreras norte/sur | Centros de detención norte/sur |
| --- | --- | --- | --- |
| 1 | 270 | 185 / 355 | 160 / 380 |
| 2 | 230, 310 | 145 / 395 | 120 / 420 |
| 4 | 180, 240, 300, 360 | 105 / 435 | 80 / 460 |

Con varias vías el tren avanza a 45 unidades/s (una vía conserva 85), para
dejar tiempo de despeje a los autos que ya pasaron la línea y deben atravesar
un cruce más ancho; los autos siguen a 52 unidades/s. No hay frenado mágico
ni protección automática: una programación incorrecta puede causar choque
en cualquier vía. El accidente identifica el tren implicado y congela todos
los actores, sin cambiar pausa, velocidad, Paso ni reinicio compartidos.

Se agregan «Paso a nivel · 2 vías» y «Paso a nivel · 4 vías», completos y con
procedimientos/pestañas. Principal inicializa **Trenes pendientes** a cero y
lanza un camino de control común más uno por vía (3/5 procesos). Cada tarea
Vigilar vía espera su entrada, suma uno, espera ocupación y liberación del
detector de salida y resta uno. Controlar el cruce espera pendientes > 0,
llama a Vía ocupada y espera pendientes = 0 antes de llamar a Vía libre. Las
tareas globales siguen reutilizando barreras y avisos. No basta con mirar si
ambos detectores están libres, ni se abre al salir sólo el primer tren.

El selector modifica sólo el borrador, con Deshacer/Rehacer, Guardar y Cancelar.
Aumentar agrega los detectores necesarios y los ubica; reducir pide confirmación,
retira sensores sobrantes y conserva sus IDs retirados. Mantiene IDs, nombres
personalizados y conexiones existentes; no cambia ni sustituye los bloques.
Al cambiar un proyecto ya programado hay que adaptar el programa o abrir el
ejemplo correspondiente; los destinos retirados se marcan como faltantes.

JSON agrega únicamente `canvas.railTracks?: 1 | 2 | 4`; los documentos antiguos
sin campo siguen siendo de una vía. Frontend/backend validan campo, número de
sensores y posiciones. Las instantáneas de trenes, temporizadores de llegadas,
actores y colisiones siguen siendo transitorias, fuera del archivo. Sin
migración de DB ni modificación del firmware/ABI: los ejemplos usan variables,
paralelo, procedimientos y componentes físicos existentes. La maqueta real y
el portado del mundo a Waveshare siguen pendientes; no confundir simulación
con seguridad ferroviaria real ni un SDK compilado con aceptación de hardware.

Verificación multivía: tipos/lint, smoke completo y build de diez rutas
estáticas aprobados. Worker ejecuta los cuatro ejemplos 192 s a 1× y otros
192 s a 4×; comprueba simultaneidad máxima, conteo acotado, salida parcial
sin abrir ante otros pendientes, cierre/reapertura, sin choques y controles.
Modelo puro: 250 s por configuración, sentidos, detectores independientes y
choque en última vía. Cinco contratos backend y JSON real frontend→Python
de ambos ejemplos aprobados.

Siete escenarios Chromium cubiertos entre corridas: ejemplos de una vía,
choque/reinicio, roles del armador, ejemplo modular y navegación, ejemplos
2/4 con simultaneidad y selector con deshacer/guardar/cancelar y confirmación
de reducción. La regresión halló una luz interceptando el clic de una barrera;
se corrigió con anclas compactas/prioritarias y el recorrido pasó. Otra
repetición agotó 10 s en carga inicial de Blockly; repetición aislada aprobada
sin ampliar timeouts ni forzar clics. Captura multivía inspeccionada y rótulos
ajustados por vía. No se operó DEV ni se ejecutó SDK o hardware.

## Reloj y persistencia

El mundo vive en el worker, junto al reloj del programa, no en un segundo
requestAnimationFrame que sólo dibuja. Velocidad, pausa y Paso afectan tren,
autos, barreras y detectores. El renderer sólo consume la instantánea.
Finalizar/detener el programa no hace circular el tren por separado. Reiniciar
restaura trenes, autos, detectores, ángulos iniciales, choques y azar.

JSON mantiene proyecto v2/escena v1, con identificadores nuevos de fondo y
plantilla `railCrossing`, sin fotogramas, actores ni GPIO inventados. Las
versiones anteriores no conocen ese identificador; las escenas anteriores se
conservan sin migración. Backend valida el mismo fondo, plantilla, dimensiones,
lugares y nombres de escena de simulación que el frontend. Se corrigió la lista
antigua de cuatro escenas de simulación para aceptar también las aventuras ya
existentes. No hay migración de base ni relajación del contrato de permisos.

## Alcance físico y aceptación

Los componentes y bloques físicos ya existían: exportación Arduino/ESP-IDF e
intérprete siguen usando servos, infrarrojos, LED y buzzer. En una placa real
los detectores leen el material real, no el tren dibujado en el navegador. El
espejo web no asegura realimentación ni coincidencia de esos sensores físicos.
No se modifica firmware/ABI ni se recompila SDK por esta entrega.

El mundo del tren **no está implementado en el renderer Waveshare**. Queda
pendiente su portado y aceptación; no afirmar paridad por ver la escena web.
También quedan aceptación docente/infantil y maqueta física con detectores,
servos, alimentación y tiempos reales. Las nuevas escenas no alteran los
permisos del taller ni autorizan trabajar en infraestructura.

## Verificación y operación

- Pruebas puras `scripts/rail-world.test.mjs`, incluidas en mundos: JSON,
  plantillas, límites/posiciones, ambos sentidos, último vagón, cierre/apertura
  no bloqueante, accesos independientes, colisión/reinicio, límites y azar.
- Worker: sensores automáticos no manipulables desde controles manuales,
  programa completo de cierre/espera/apertura sin choques, pausa, velocidad y
  Paso. Se conserva la suite anterior de sensores y programación cooperativa.
- Backend: tres pruebas de almacenamiento sin DB y validación adicional del
  JSON realmente generado por frontend, no sólo fixture construido a mano.
- Navegador: sensor → bloque condicional → luz, barreras, pausa/reinicio,
  accidente persistente, roles/límites y cancelación del armador.
- Registrar resultados finales en contexto. No presentar estos tests como
  prueba física ni como despliegue DEV. El propietario integra y actualiza.

Resultados locales: tipos/lint (incluido renderer nuevo), suite smoke completa,
build con diez rutas estáticas, tres pruebas backend y JSON real frontend→Python
aprobados. Nueve recorridos de navegador aprobados (tres por Chromium, Chrome
y Edge), con captura inspeccionada. Agregar aventura conserva IDs retirados
y no reutiliza sus identidades, incluso después de vaciar una escena.

El comando específico de la entrega debe usar el
[flujo compartido](FLUJO_RAMA_INTEGRACION_DEV.md): verificar rama/SHA, integrar
en un worktree separado, push de merge a main y luego actualizador `--fast`.
Nunca adelantar manualmente el HEAD del checkout operativo antes de auditar
los cambios. Ante conflictos o cambios locales, detener sin pisar trabajo.
