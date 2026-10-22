# Fase 56 — Vehículo seguidor de línea

## Reglas aprobadas e implementación — 19 de octubre de 2026

Esta sección sustituye el estado de propuesta de las secciones históricas de
abajo. El propietario aprobó disposición/reglas y autorizó la fase completa.
Rama `codex/fase-56-seguidor-linea`, creada desde origin/dev1 e9158e1;
incorpora por avance rápido la documentación de fase55 (42ff720), todavía no
integrada en dev1, para no perder ese análisis. No operar main/dev2 ni servidores.

### Mesa, robot y sensores

Nuevo mundo `lineTrack`, mesa vista desde arriba960×540, un vehículo diferencial
y una barra `lineSensors` de tres reflectivos digitales. Perfil genérico
`DIGITAL_3`: izquierdo/central/derecho, no barrera emisor–receptor, color,
QTR RC, analógico ni I2C. Cuerpo circular radio22; frente visible y sensores
montados20 unidades adelante, separados lateralmente14. Escala educativa,
no reproducción de medidas de un chasis comercial.

Cada sensor responde sobre línea/fuera justo en su posición; negro sobre claro,
sin ruido ni iluminación variable en esta primera entrega. Lecturas automáticas
sin sliders competidores; polaridad de salidas físicas configurable en escena
(`activeLow`), sin invertir por eso el negro del mundo. Módulos exactos, altura,
umbral, alimentación y polaridad física requieren aceptación independiente.
La ayuda asociada explica diferencia, uso, conexiones y límites; ilustración,
no fotografía comercial ni certificación de pinout.

Barra única fija en la lista del armador (165,420) pero dibujada y medida sobre
el frente móvil del robot, no como otro sensor fijo sobre la mesa. Robot
movible/orientable antes de ejecutar; al faltar barra no se inventan sensores.
LED de aviso libre. No se modifican robotArena ni los proyectos anteriores.

Ejemplo Wemos: puente H17/16/23/19; entradas reflectivas34/35/36; LED27.
Las entradas reciben salidas digitales definidas por los módulos; no se asume
pull-up interno en GPIO34–36. Motor necesita driver, alimentación propia y
masa común; no motores conectados a GPIO. No elegir marca de reflectivo por
inferencia ni prometer que los módulos comerciales tengan igual polaridad.

### Movimiento y errores

- Bloque nuevo «motor izquierdo … % · derecho … %», −100..100 independiente.
  Positivo avanza, negativo retrocede y0 detiene. Orden persistente hasta otra
  orden. Mantener avanzar/girar/detener existentes; vale también fuera de esta
  escena y no consulta el dibujo para decidir motores.
- Sin inercia/deslizamiento/batería: velocidad media de ruedas y giro por su
  diferencia, igual convención ideal que pista52. Potencia100≈100 unidades/s;
  giro diferencial0,75°/s por punto de diferencia. Subpasos≤10ms.
- No riel, alineación, búsqueda, frenado ni recuperación ocultos. Línea perdida
  es recuperable; programa decide. En cruces sólo ve el patrón, no el camino.
- Mesa delimitada: centro x42–918/y72–488. Contacto bloquea desplazamiento,
  no rebota ni destruye robot/programa; puede girar/retroceder. Contactos por
  episodio, recorrido acumulado, tiempo sin línea y traza acotada300 puntos.
  Son métricas visuales, no sensores de hardware nuevos.
- Un reloj worker para vehículo, lecturas y algoritmo. Pausa/Paso/velocidad
  comunes. Reiniciar limpia recorrido/contactos/tiempo y restaura pose/circuito
  guardados. Detener apaga motores sin borrar el proyecto.
- Abrir Armar escena detiene la ejecución como en los otros mundos; circuito
  y pose no se editan en paralelo con la ejecución.

### Circuitos y editor

Recta, óvalo, curvas amplias y S, con tramo inicial horizontal compatible con
pose del ejemplo (300,390), rumbo0. Abiertos o cerrados según trazado; los
abiertos terminan en pérdida de línea, no un evento mágico de meta.
Cambiar un circuito arbitrario puede requerir mover/orientar robot o ajustar
programa; no modificarlo automáticamente.

Armar escena → Editar circuito abre modal amplio con:

- Lápiz con muestreo mínimo3 unidades; recta por arrastre.
- Curva cuadrática por tres clics: inicio, control, final;33 puntos guardados.
  Se dibuja esa misma polilínea, no una curva visual diferente de la detectada.
- Seleccionar/mover trazo, lista accesible de trazos, borrar seleccionado y
  borrar todo con confirmación. Mover conserva forma y respeta límites.
- Ancho12–24, extremos/uniones redondos, Deshacer/Rehacer hasta60 acciones.
- Guardar circuito aplica al borrador de escena, no al proyecto confirmado;
  Guardar/Cancelar/Deshacer/Rehacer de escena siguen siendo el límite externo.
  Cancelar circuito conserva el original; salida sucia pide confirmación.

Límites:64 trazos,256 puntos por trazo y512 puntos totales; mensaje al llegar,
sin aceptar una versión recortada a escondidas. Coordenadas finitas dentro de
x45–915/y75–485. Admite circuito vacío para probar pérdida de línea. Trazos
compartidos entre dibujo y detección (distancia a cada segmento≤ancho/2).
No imágenes importadas, SVG ejecutable, fotos ni geometría sin límite.

JSON portable aditivo `canvas.lineCircuit?` con width/strokes, validación
frontend/backend estricta, default óvalo si falta. Sólo geometría/pose inicial,
no cada frame o lectura. La transferencia CapiRules conserva su límite32KiB:
si un programa/circuito personalizado combinado lo supera, se rechaza con
explicación, nunca se envían reglas truncadas. Importar/exportar proyecto
incluye circuito y los dos ejemplos; sin migración de base.

### Dos ejemplos completos

En Proyecto → Ejemplos:

1. **Seguidor de línea básico**: si central ve línea,40/40; si izquierda,
   12/44; si derecha,44/12. Si ninguno,0/0 y aviso luminoso. Condiciones
   secuenciales, sin búsqueda oculta ni conocimiento del trazado.
2. **Seguidor con búsqueda y procedimientos**: misma corrección, recuerda
   último lado observado. Al perder línea inicia temporizador2s y gira hacia
   ese lado (−30/30 o30/−30); si detecta otra vez, continúa; si vence, se
   detiene con aviso hasta Reiniciar. Último lado inicial izquierdo es una
   política explícita si nunca vio una curva, no dirección inferida del mapa.
   Cinco tareas, tres pestañas: Principal, Seguimiento, Búsqueda. Un único
   responsable de ambos motores; espera cooperativa entre lecturas.

Dos soluciones para el óvalo incluido; búsqueda limitada, no garantía de
resolver cualquier cruce/trazado/gap. Sin PID, varios robots, obstáculos,
ruido o bifurcaciones complejas. Inventario de ampliaciones inferior conservado.

### Exportaciones y firmware

Op nuevo `robotWheels`, capacidades `robot-wheels`/`line-sensors`.
Arduino e IDF generan conducción de ambas ruedas y lecturas digitales con
polaridad; intérprete lee esos pines al consultar valores. Runtime mínimo
**1.10.0**, ABI/formato1 intactos. No enviar reglas a firmware viejo ni
etiquetar bundles1.9.x como1.10.0. El manager del actualizador deriva versión
de la release; conservar objetos/cache incremental. No compilar por proyecto.

Esta escena y sensores dinámicos nuevos no equivalen a implementarlos en el
renderer autónomo Waveshare. Paridad de mundo/sensores en pantalla, aceptación
física y SDK completo son pruebas separadas; no afirmarlas por generar fuentes.

### Verificación y entrega

Pruebas de geometría/lecturas, determinismo, contactos recuperables, límites,
JSON, workspaces completos, generadores y capacidades. Worker ejecuta ambos
ejemplos a1×/4×, trayectoria larga, pérdida/búsqueda limitada, pausa/Paso/reset
y bloqueo de entradas competidoras. Navegador: ambos ejemplos y herramientas
de dibujo, edición/undo/redo/guardar/cancelar. Contratos Django y documentos
reales frontend→backend. Evidencia final y límites en el contexto vivo.

Sólo commit/push a la rama. Actualización por propietario en capi-dev:

```bash
cd /home/capi/capibloques &&
git fetch --quiet origin codex/fase-56-seguidor-linea &&
git show origin/codex/fase-56-seguidor-linea:scripts/update-dev.sh |
bash -s -- --env dev1 --branch codex/fase-56-seguidor-linea --commit SHA40
```

Sin --promote ni operación en main/dev2. SDK incremental1.10.0 una vez; no
esperar Actions. No iniciar otra fase por esta autorización.

## Plan original e inventario conservado

Los apartados siguientes son históricos/propuestas futuras; no sustituyen las
reglas aprobadas anteriores ni amplían automáticamente el alcance entregado.

Pedido del propietario: agregar una fase para una escena con líneas predefinidas
o dibujadas por el usuario y pensar actividades complementarias. **Planificación,
no implementación autorizada ni reglas definitivas.** No reemplaza ni amplía
silenciosamente la fase 52; no renumerar fases 53–55 ni iniciar la 53 por este pedido.

## Concepto

Un robot de dos motores sigue una línea porque **su programa interpreta sensores
de suelo y corrige los motores**, no porque el mundo lo enganche al trazado.
Puede perderla, salir, buscarla y recuperarla. Separar:

- Circuito: dibujo y propiedades del suelo.
- Vehículo: movimiento diferencial y contactos.
- Sensores: lecturas donde realmente pasan, montados en el frente inferior.
- Programa: decisiones sobre motores; sin ayuda oculta para completar el circuito.

Reutilizar geometría/reloj/contactos recuperables de fase 52 cuando convenga,
sin cambiar su comportamiento ni confundir sus marcas de color con una línea.

## Propuesta inicial para discutir

Una escena con un solo vehículo. Circuitos de inicio: recta, óvalo, circuito
con curvas amplias y recorrido en S. Abiertos o cerrados; base y orientación
inicial visibles. Línea negra sobre fondo claro, ancho configurable dentro de
un rango que sea compatible con la separación de sensores.

Editor de circuito en modal amplio: lápiz/trazado libre, segmentos rectos,
curvas, seleccionar/mover y borrar tramos, ancho de línea, borrar todo con
confirmación. Deshacer/Rehacer; Guardar y Cancelar aplican al borrador, no
directamente al proyecto. Importar/exportar circuito como parte del JSON portable.
Empezar por trazados vectoriales; imágenes/fotos importadas no son requisito
inicial y necesitarían un análisis de conversión/calibración propio.

El dibujo y la superficie consultada por los sensores deben provenir de la
misma geometría: nada de una línea visible distinta de la que se detecta.
Acotar cantidad de trazos/puntos y simplificar el dibujo sin alterar
excesivamente su forma; acordar límites medibles antes de implementar.
No permitir editar el circuito durante una ejecución.

## Sensores y control: decisión necesaria antes de implementar

Recomendación inicial: barra de **tres sensores reflectivos**, izquierdo,
centro y derecho, con estado amigable «sobre línea / fuera de línea».
Dos sensores pueden ser una variante; cinco/ocho y lecturas analógicas para
control proporcional/PID son posibilidades avanzadas, no alcance aprobado.
Mostrar cada sensor y su lectura sobre el vehículo y en Estado.

**No son la barrera infrarroja emisor/receptor ni el sensor de color existentes.**
Son reflectivos de suelo (por ejemplo familias TCRT5000/QTR, a confirmar según
hardware disponible). Definir perfil, polaridad, separación, altura idealizada,
calibración y umbral; no elegir hardware/driver ni prometer compatibilidad
eléctrica sin conocer el módulo.

El control actual avanzar/girar/detener permite un ejemplo sencillo, pero para
corregir suavemente conviene una orden explícita **motor izquierdo / motor derecho**
con potencias independientes. Evaluar extensión compartida del bloque de robot
y su soporte en simulador, Arduino, ESP-IDF e intérprete. No disfrazar la ausencia
de ese control haciendo que la simulación maneje por su cuenta. Si exige nuevas
capacidades de firmware, versionarlas y mantener compatibilidad de proyectos.

## Reglas a concretar con el propietario

- Detectar línea según posición real de cada sensor y ancho del trazo.
- Suelo sin línea produce lecturas de fuera, no la última lectura válida.
- Sin rebotes, teletransporte ni alineación automática.
- Perder la línea es un estado recuperable: el programa decide buscar,
  detenerse o avisar. Mostrar la causa, no resolverla.
- Un cruce se ve mediante el patrón de sensores; no otorgar orientación
  absoluta ni ruta elegida que un sensor real no podría proporcionar.
- Un reloj compartido para robot, sensores y programa; pausa/Paso/velocidad/reset.
- Reiniciar limpia recorrido, métricas y contactos; conserva circuito guardado.
- Sensores automáticos sin controles manuales competidores. Real/físico y
  virtual deben diferenciarse; simulación ideal no sustituye calibración.
- Vueltas/tiempos son indicadores del mundo. Una línea de meta necesita
  dirección y salida/reentrada para no sumar vueltas repetidas al detenerse.
  Esas métricas no se convierten automáticamente en lecturas de hardware.

## Ideas complementarias para priorizar

1. **Perder y recuperar la línea:** curvas cerradas, salida del trazado y búsqueda.
2. **Circuitos por dificultad:** ancho variable, curvas suaves/cerradas, tramos
   cortos; evitar que dificultad sea sólo velocidad.
3. **Vueltas y checkpoints:** recorrido, mejor tiempo, tiempo fuera de línea y
   contactos. Sin nota automática ni premiar exclusivamente correr más.
4. **Cruces y bifurcaciones:** tomar izquierda/derecha, alternar rutas o elegir
   según contador/mensaje. Distinguir cruces de marcas especiales.
5. **Marcas de parada y estaciones:** franjas transversales o marcas de color,
   con sensor apropiado, espera y señales de llegada programadas.
6. **Obstáculo sobre el recorrido:** sensor de distancia para frenar; rodearlo
   y reencontrar la línea sería una actividad más avanzada.
7. **Tramos sin línea:** memoria del último giro, temporizadores y búsqueda
   limitada, sin seguir un tramo invisible automáticamente.
8. **Velocidad adaptativa:** más lento en curva y más rápido en recta a partir
   de lecturas disponibles, no de conocimiento oculto del dibujo.
9. **Calibración didáctica:** ver claro/oscuro, umbral y contraste. Ruido o
   iluminación variable sólo como modo avanzado explícito y reproducible.
10. **Variantes de control:** decisiones discretas y luego proporcional/PID
    para mayores/docentes, conservando el recorrido básico para 8–12 años.

Todo esto queda como inventario de posibilidades, no como lista aprobada para
implementar de una vez. No incluir varios robots, competición en red o editor
de mundos arbitrarios en la primera entrega sin un pedido específico.

## Orden de trabajo propuesto

1. Acordar disposición/reglas, cantidad/perfil de sensores y alcance inicial.
2. Definir datos portables del circuito y componente reflectivo, compatibilidad
   de firmware y control independiente de ruedas.
3. Implementar mundo y circuitos predefinidos, comprobando lecturas y pérdida/
   recuperación sin piloto automático.
4. Incorporar editor cómodo con undo/redo/guardar/cancelar y JSON acotado.
5. Dos ejemplos completos: seguidor básico por condiciones y solución modular
   con procedimientos/pestañas, incluyendo búsqueda al perder la línea.
6. Verificar modelo, workspaces reales, navegador, persistencia y rendimiento.
   Hardware y renderer Waveshare requieren aceptación específica.

Todos son pasos internos de la **fase 56**, no fases numeradas adicionales.
La prioridad de ejecución puede cambiar con autorización sin renumerarla.
El alta de este documento no instala componentes ni cambia la fase 52 entregada.
