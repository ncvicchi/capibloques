# Mundos interactivos: escenas con comportamiento

**Estado vigente19/10:** fase55 cerrada como análisis, [informe](FASE_55_ANALISIS_VARIANTES_ESCENAS.md). No añade mundos: propone reutilizar parque, retener laguna/depósito para control de nivel y postergar aeropuerto salvo arbitraje/pedidos. Primero se recomienda acordar fase56. Ninguna variante ni fase56 autorizadas para implementar. Fase54 promovida a DEV original según propietario, confirmada su integración Git, no SDK/hardware/Waveshare.

Actualización vigente: fase 54 implementada en rama desde dev1. [Teatro de Otto: reglas y entrega](FASE_54_TEATRO_OTTO.md), público acotado y dos ejemplos completos. Runtime 1.9.1 por FIFO corporal, no nuevo ABI. Integración/aceptación dev1, SDK completo, hardware y Waveshare pendientes. Main/dev2 intactos; fases 55–56 sin autorización. Las menciones inferiores a fase 54 no implementada son históricas.


Actualización vigente: fase 53 autorizada e implementada en simulación web,
en rama `codex/fase-53-estacion-meteorologica` desde dev1. Reglas aprobadas y dos
ejemplos completos: [FASE_53_ESTACION_METEOROLOGICA.md](FASE_53_ESTACION_METEOROLOGICA.md).
Pendientes integración/aceptación dev1 y Waveshare/físico; main/dev2 intactos.
Fases 54–56 no implementadas; 56 tiene plan propio. Referencias inferiores a 53 sin autorización históricas.

Estado vigente: fase 49 autorizada e implementada en simulación web, en rama
`codex/fase-49-huerta-invernadero` desde dev1. Reglas aprobadas y dos ejemplos
completos en [FASE_49_HUERTA_INVERNADERO.md](FASE_49_HUERTA_INVERNADERO.md).
Integración/aceptación dev1 y Waveshare/físico pendientes. No se modifica main/dev2
ni firmware. Las fases 50–55 siguen planificadas; referencias inferiores a 49
sin autorización son históricas.

Actualización vigente: **fase 48 autorizada e implementada en simulación web**,
en `codex/fase-48-estacionamiento` desde dev1. Reglas aprobadas, disposición,
dos ejemplos completos y alcance en [FASE_48_ESTACIONAMIENTO.md](FASE_48_ESTACIONAMIENTO.md).
Integración dev1/aceptación pendientes; no se modifica main/dev2 ni firmware.
Las menciones históricas inferiores a 48 sin autorización quedan sustituidas;
49–55 continúan planificadas, no iniciadas. Waveshare y maqueta son aceptación aparte.

Pedido y autorización: 17 de octubre de 2026. Documentar el inventario y la
propuesta completa, asignar fases y empezar por peatones. Sólo la fase 46 queda
autorizada para implementar; las siguientes se planifican, no se inician.

Actualización del mismo día: aprobadas disposición y reglas y autorizada fase
47. Detalle y alcance en [FASE_47_PASO_A_NIVEL.md](FASE_47_PASO_A_NIVEL.md):
detectores infrarrojos, circuito real entre mundo virtual y condiciones del
programa, servos no bloqueantes y accidentes persistentes. Fases 48–55 siguen
planificadas; el alcance Waveshare/físico no se da por probado.

Ampliación de fase 47 autorizada el mismo día: 1/2/4 vías configurables,
trenes simultáneos por vías independientes, dos detectores por vía y barreras
comunes hasta salir todos. Ambos ejemplos de una vía se conservan; nuevos
ejemplos 2/4 con tareas, pestañas, procesos y conteo de trenes pendientes.
Rama `codex/paso-nivel-multivia`; guía de fase 47 actualizada, sin nuevo SDK.

## Concepto

Una escena no es sólo un fondo: es un mundo acotado con actores, fenómenos,
lugares válidos e interacciones observables. El alumno programa componentes;
el mundo genera circunstancias y responde a sus salidas. No resuelve el
algoritmo ni introduce órdenes ocultas. Ejemplo: un detector detecta un auto,
un servo levanta la barrera y el auto pasa; detectar no abre automáticamente.

Separar componente electrónico, representación y actor: un mismo servo puede
representar barrera ferroviaria, puerta o desviador. Los autos, trenes,
peatones, paquetes y plantas no consumen GPIO ni se agregan al catálogo como
componentes físicos. Una bomba de riego se representa mediante una salida de
potencia existente, no conectando una bomba directamente a un GPIO.

Las restricciones necesitan una razón: un semáforo tiene carril y orientación,
una barrera una entrada y un detector un área. LED, botones y pantallas son
transversales; no prohibirlos por temática. Mantener escena libre sin reglas.
Vincular de forma explícita cada componente con el lugar y actor afectado;
poner nombre visible, selección/ayuda y explicar incompatibilidades.

## Inventario contrastado

El modelo actual tiene diez fondos: parque, taller, casa, laguna, cruce, pista
de robot, huerta, entrada, patio meteorológico y vacío. Las plantillas incluyen
Semáforo de la plaza, Robot explorador, Señal Wi-Fi, Cruce de la escuela, Pista
de reparto, Huerta inteligente, Entrada segura y Estación del clima. La oferta
visual y las recuperaciones de ramas se registran en fase 45: este inventario
del código no demuestra que cada versión remota o cada firmware los ofrezca.

Tránsito ya tiene actores, llegadas variables, espera por color, conflictos,
límites de semáforos y lugares. El resto no debe anunciarse como un mundo
completo por tener un dibujo, sensores o una plantilla. La pista actual no
ordena seguir la línea; huerta no equivale todavía a balance de agua/plantas.

## Fases y orden propuesto

| Fase | Mundo | Componentes existentes a vincular | Dinámica que falta desarrollar |
| --- | --- | --- | --- |
| 46 | Peatones del cruce escolar | Cartel peatonal, semáforo, segundero, botón opcional | Llegadas, espera, cruce, conflictos con autos, tiempo y reinicio comunes |
| 47 | Paso a nivel | Servo/barrera, LED, buzzer, infrarrojos | Trenes y autos; detección de llegada/salida, barrera realmente bloqueante y accidente simple |
| 48 | Estacionamiento | Servo, infrarrojos, contador/datos, display | Entradas/salidas, plazas ocupadas, lleno y vehículos esperando |
| 49 | Huerta e invernadero | Humedad del suelo, luz, ambiente, salida de potencia, motor y servo | Secado, riego, exceso de agua, salud de plantas, ventilación/luz |
| 50 | Casa y entrada segura | Luz, movimiento, LED, botón, servo, buzzer, teclado/identificación | Día/noche, visitantes, puerta con paso efectivo, acceso, iluminación y avisos |
| 51 | Taller y cinta transportadora | Motor, infrarrojo, color, servo, contador y balanza | Software web entregado; dos ejemplos completos y [reglas de lectura, desvío y atasco](FASE_51_TALLER_CINTA.md); actualización/aceptación/Waveshare/físico pendientes |
| 52 | Pista de robots | Robot de dos motores, distancia/color montados, meta, luces y buzzer | Software web entregado; dos ejemplos completos y [reglas](FASE_52_PISTA_ROBOTS.md); contactos recuperables sin piloto automático; actualización/aceptación/Waveshare/físico pendientes |
| 53 | Estación meteorológica | Ambiente, lluvia, luz, servo, pantalla, luces/buzzer; sin anemómetro | Software web entregado; clima gradual, detector residual, techo/mesa y dos ejemplos; [reglas](FASE_53_ESTACION_METEOROLOGICA.md); actualización/aceptación/Waveshare/físico pendientes |
| 54 | Escenario de Otto | Otto, botón, distancia, matriz, buzzer y luz | Software en rama desde dev1; público, dos ejemplos completos y FIFO corporal 1.9.1; [reglas](FASE_54_TEATRO_OTTO.md); aceptación/SDK/Waveshare/físico pendientes |
| 55 | Análisis de variantes | Parque, laguna y posible aeropuerto | Análisis cerrado: [evaluación](FASE_55_ANALISIS_VARIANTES_ESCENAS.md); candidatos retenidos, sin nuevo software ni autorización de implementación |
| 56 | Vehículo seguidor de línea | Robot diferencial y nuevo sensor reflectivo de suelo, perfil por definir | Circuitos predefinidos o dibujados, pérdida/recuperación y actividades; [propuesta pendiente de acordar](FASE_56_SEGUIDOR_LINEA.md), sin implementación autorizada |

Estado de la primera entrega: fase 46 implementada en simulación web; uso,
evidencia y límites en [FASE_46_PEATONES.md](FASE_46_PEATONES.md). DEV/usuarios
y renderer de peatones Waveshare pendientes. Fases 47–53 autorizadas y entregadas
posteriormente en software web; consultar sus guías y contexto vigente. Fases
54–56 no implementadas; 56 planificada.

El orden recomendado prioriza 46 → 47 → 48 → 49 → 51. Las demás pueden
reordenarse con autorización sin cambiar números. Aeropuerto se posterga: al
principio repetiría circulación, señales y barreras con mayor costo visual.
Parque/laguna pueden reutilizar iluminación, riego o monitoreo ambiental si
hay una actividad concreta, no necesitan motor independiente por su nombre.

## Contrato transversal de aceptación de cada mundo

- Actores acotados y azar reproducible; entradas/salidas, sin crecimiento de
  memoria sin límite. Modelos simples, no simulación científica certificada.
- Un solo reloj: velocidad, pausa y reinicio afectan todo. Reiniciar limpia
  actores/conflictos y recupera condiciones iniciales; apagar una salida no.
- Sensores ligados al mundo generan entradas tipadas, no acciones automáticas.
  Distinguir entrada virtual, manual y física; no sobrescribir hardware real.
- Configuración portable compatible con proyectos anteriores. No guardar cada
  fotograma en JSON/autoguardado. Deshacer/Cancelar conservan la composición.
- Mundo, componente y condición asociados visiblemente; no depender de color
  ni sólo de animación. Explicaciones adecuadas para 8–12 años.
- No evitar errores mágicamente: consecuencias simples y no gráficas; explicar
  qué pasó y permitir reiniciar. Separar evaluación pedagógica de física real.
- Editor, web/revisión y Waveshare deben converger; fase 45 conserva geometría,
  capas, fondos y rótulos. Llevar nuevas dinámicas a Waveshare requiere su
  implementación/prueba propia, no afirmar paridad por funcionar en navegador.
- Verificar comportamiento puro, integración real en navegador y aceptación
  humana. No compilar firmware si una entrega sólo toca simulación web.

## Fase 46: peatones del cruce

Cada cartel peatonal habilitado habilita población en el paso de su esquina
(norte, este, sur u oeste), identificado con nombre del semáforo. Sin cartel no
aparecen peatones en ese paso. Cartel apagado o «no caminar»: esperan en ambas
veredas. «Caminar»: empiezan; quien ya empezó termina aunque se cierre.
El segundero sólo informa y no libera peatones. Color vehicular independiente.

Botón opcional: es una petición de entrada que debe atender el programa;
no cambia señales por sí solo. Esta primera entrega no agrega un emparejamiento
automático botón/cruce ni inventa pulsaciones: siguen disponibles los botones
de entrada existentes. Diseñar esa interacción explícita antes de ampliarla.

Autos siguen sus reglas, sin frenar mágicamente ante el permiso peatonal;
una coincidencia espacial auto–peatón produce conflicto simple y no gráfico,
congela el mundo y explica dónde ocurrió. Señales incompatibles no equivalen
por sí solas a accidente: hacen falta actores que coincidan. El alumno debe
contemplar el despeje de la intersección antes de habilitar el paso.

Aceptación: esperar en OFF/no caminar, ambas direcciones, habilitar sólo el
paso asociado, terminar tras cambio, salida/destrucción, población máxima,
conflicto espacial, no falso conflicto en vereda, pausa/velocidad/reinicio,
JSON antiguo sin cambios y navegador. Renderer Waveshare de peatones pendiente;
esta entrega no cambia firmware ni asegura espejo de actores físicos.
