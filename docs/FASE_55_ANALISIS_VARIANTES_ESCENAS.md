# Fase 55 — Análisis de parque, laguna y aeropuerto

19 de octubre de 2026. **Entrega de análisis, no implementación de mundos.**
Autorizada al aceptar revisar estas variantes después de fase 54. Rama
`codex/fase-55-analisis-escenas`, desde origin/dev1
`e9158e1949e8739a63c6e16418a7d30d83bebd38`.

El objetivo es decidir qué actividades aportan algo nuevo con los componentes
existentes. Las disposiciones y reglas siguientes son propuestas para discutir,
no reglas aprobadas ni ejemplos ya disponibles. No se agregan aquí componentes,
fondos, bloques, firmware, migraciones ni nuevas fases de implementación.

## Conclusión y prioridad

| Variante | Novedad respecto de lo existente | Recomendación |
| --- | --- | --- |
| Parque con luces y riego | Baja: repite casa (50) y huerta (49) | Actividad/variante de composición; no otro motor de mundo |
| Fuente del parque con luces y chorros | Media: secuencias sincronizadas y consumo compartido, si se define un límite real | Conservar como ampliación futura; no simular agua por cada LED ni cambiar el catálogo para ambientarla |
| Laguna con depósito de alimentación | Alta: agua que entra/sale, nivel y bombeo realimentados, derrame y marcha sin agua | Mejor candidato a próximo mundo de estas tres familias |
| Laguna con puente y barcos | Baja: vuelve a ser circulación con barrera y despeje (47) | Postergar; no duplicar paso a nivel con otra decoración |
| Aeropuerto con señales y barreras | Baja: repite tránsito/paso a nivel | No implementar por ese motivo solamente |
| Aeropuerto con solicitudes y turnos de pista | Media/alta: arbitraje de recurso único, prioridades y espera | Conservar para más adelante, sobre todo si se conecta con mensajes entre placas |

Orden recomendado: acordar e implementar primero el **seguidor de línea (56)**,
ya pedido por el propietario y con una habilidad claramente distinta. Después,
si interesa otra escena, definir la laguna con depósito. No hace falta crear
tres mundos sólo porque ya haya fondos con esos nombres.

Fase 55 se cierra como análisis documentado; **no** como software de parque,
laguna o aeropuerto entregado. Fase 56 sigue pendiente de acordar sus reglas y
autorizar implementación. Las variantes retenidas quedan trazadas en este mismo
documento/backlog, sin desaparecer ni recibir números nuevos implícitos.

## Base contrastada en el proyecto

- `lib/scene-model.ts`: park y pond son fondos existentes. La plantilla histórica
  counter usa pond: no reemplazarla ni migrarla a una simulación hidráulica.
- `components/scene-stage.tsx`: parque/laguna tienen decoración vectorial, no un
  modelo de aforo, agua, peces o aeronaves conectado con los bloques.
- `lib/educational-modules.ts`: distancia, PIR, salida de potencia, humedad de
  suelo, BME280, agua/lluvia, color y otros módulos ya tienen contratos propios.
- `lib/component-capabilities.ts`, `lib/blockly-engine.ts`, `lib/capiblocks.ts`:
  estados/valores, condicionales, temporizadores, variables, procedimientos y
  procesos cooperativos permiten expresar las actividades sin una nueva
  categoría de órdenes temáticas que programe por el alumno.
- [Huerta (49)](FASE_49_HUERTA_INVERNADERO.md),
  [casa (50)](FASE_50_CASA_ENTRADA_SEGURA.md),
  [taller (51)](FASE_51_TALLER_CINTA.md),
  [pista (52)](FASE_52_PISTA_ROBOTS.md),
  [meteorología (53)](FASE_53_ESTACION_METEOROLOGICA.md) y
  [Otto (54)](FASE_54_TEATRO_OTTO.md) ya cubren muchas combinaciones.

Sensor de agua/lluvia expone `level` y `wet`, pero su placa analógica detecta
agua sobre su superficie: **su porcentaje no es por sí mismo el nivel de una
laguna o depósito**. BME280 no mide oxígeno del agua ni viento; PIR no cuenta
visitantes distintos ni confirma una pista libre. No inventar esas capacidades.

## Parque: actividades sin otro mundo redundante

### Iluminación de senderos

Sendero con dos sectores, luz natural, detección de movimiento, dos lámparas y
pantalla opcional. El programa enciende ante movimiento y poca luz, mantiene
un temporizador desde la última detección y atenúa/apaga después. Enseña
temporizadores reiniciables, histéresis y procesos independientes.

Ya es prácticamente la casa con iluminación: recomendar un ejemplo/actividad
posterior, no prometer visitantes nuevos por haber cambiado el fondo. Si se
quieren caminantes que exciten los PIR, primero hay que definir trayectorias,
zonas/retardo de detección y límites. PIR es movimiento, no aforo omnisciente.

### Parque cuidado

Luces y riego por sectores, con humedad/luz y salida de potencia. La actividad
de combinar tareas es útil, pero la dinámica de plantas ya pertenece a huerta.
No copiar ese motor ni extenderlo ahora sólo para reemplazar canteros por árboles.

### Fuente coreografiada, retenida para evaluar

Una fuente, hasta dos chorros representados por salidas MOSFET, iluminación RGB
y botón de inicio. El alumno programa secuencias, repetición, temporización y
procedimientos. Un límite de capacidad compartida podría introducir reparto
de potencia entre chorros, pero habría que definir su modelo y cómo se observa.

Sin ese límite, sería principalmente una actividad de luces/tiempos que se
puede preparar sobre componentes existentes. Con él, no mostrar caudal, presión
ni consumo como lecturas físicas sin sensores. Perfil relé sólo encendido/apagado;
PWM regulable sólo para perfiles/cargas que lo admitan. No elegir bombas ni
compatibilidad eléctrica en esta fase documental.

## Laguna: mejor candidata a un mundo nuevo

### Disposición propuesta

Vista de corte, no una laguna vista sólo desde arriba: depósito de reserva a
la izquierda, laguna a la derecha y tubería entre ambos. Una bomba transfiere
agua de reserva a laguna; salida/drenaje de laguna hacia fuera del sistema.
Lluvia aporta agua y evaporación/fuga la retiran. Flechas muestran el sentido.
Hasta dos distancias cenitales, una por recipiente, y detector de derrame en
el suelo. Actores decorativos no consumen GPIO ni exponen salud inventada.

| Función | Componente ya existente | Límite que debe quedar claro |
| --- | --- | --- |
| Distancia a la superficie | Sensor de distancia montado arriba | Más agua → menor distancia; requiere geometría/calibración, no entrega % mágico |
| Bombeo | Interruptor de potencia MOSFET | Potencia ordenada, no caudal medido |
| Drenaje | Servo representando compuerta, si se incluye | Apertura ordenada; recorrido gradual por definir |
| Agua fuera del recipiente | Agua y lluvia | Superficie mojada, no nivel del tanque |
| Aviso | LED/buzzer/pantalla | El programa decide cuándo avisar |

La lectura cenital se calcula con la misma superficie dibujada. Una maqueta
con agua exige comprobar el sensor/montaje real: no dar por certificado que
cualquier módulo o superficie entregue un eco válido. Un flotante futuro
sería otro perfil/componente, no una barrera IR renombrada.

### Reglas propuestas para acordar antes de construir

1. Agua acotada por capacidad en ambos recipientes. Balance explícito:
   reserva pierde lo que la bomba entrega a laguna; lluvia entra desde fuera;
   drenaje/evaporación/fuga salen. Sin creación de agua por PWM.
2. Bomba sólo actúa por orden del programa. Si la reserva se vacía, deja de
   transferir agua y aparece aviso de marcha sin agua; no se apaga la orden
   mágicamente ni se inventa que el alumno la detectó.
3. Un recipiente lleno puede derramar. Limitar el volumen interno a capacidad
   no debe ocultar el exceso: se muestra y acumula derrame fuera del recipiente.
4. Detector mojado depende del agua en su lugar y conserva humedad residual;
   vaciar un tanque no lo seca instantáneamente. El tiempo de secado se acuerda.
5. Sin bomba no hay transferencia; sin sensor el programa pierde esa lectura,
   no recibe una alternativa omnisciente. Sin compuerta se usa la disposición
   hidráulica fija acordada, no una orden invisible de control.
6. Un control de prueba añade lluvia, fuga o recarga de reserva; no reemplaza
   manualmente la lectura de los sensores automáticos. Condiciones guardables
   separadas de ensayos transitorios, con el editor/undo habitual.
7. Un reloj para agua, bomba, compuerta y programa. Pausa/Paso/velocidad/reset
   comunes. Errores recuperables, sin peces muertos ni alarmas eléctricas reales.

Valores de capacidad, caudal, evaporación, fuga, respuesta de compuerta y tiempos
todavía **sin fijar**. Evitar usar números arbitrarios como física certificada.

### Qué enseñaría y dos ejemplos futuros

- Distancia inversa al nivel, conversión/calibración y comparación de umbrales.
- Control con histéresis; temporizador de tiempo máximo de bomba; estados
  «llenando / esperando / reserva insuficiente», sin agregar acciones mágicas.
- Causas combinadas: una bomba encendida no alcanza si la fuga supera su aporte.
- Ejemplo directo completo: mantener nivel entre dos umbrales leyendo distancia.
- Ejemplo modular completo: misma regulación, reserva, aviso y pantalla en tareas
  separadas; un único responsable de cada actuador. No están implementados aquí.

No agregar química, pH, oxígeno, alimentación de peces, potabilidad ni filtración
efectiva: faltan componentes/modelos adecuados y no hacen falta para el objetivo.

## Aeropuerto: sólo si el problema es compartir una pista

### Disposición propuesta

Una pista, dos puntos de espera de salida y una zona de salida de pista;
vista superior y movimientos terrestres simplificados. Aviones son actores,
no robots con GPIO. Para empezar, sin vuelo 3D, meteorología aeronáutica,
combustible, simulador de torre real ni múltiples pistas.

Dos botones piden turno, dos luces o carteles dan permiso. Detectores infrarrojos
fijos señalan paso por sus zonas; no deducen por sí solos que toda la pista está
vacía. Una demostración con ocupación persistente requeriría definir el estado
entre detección de entrada y salida y su tratamiento ante detecciones faltantes.

### Problema didáctico y reglas a discutir

- El programa arbitra un recurso único: quién entra, quién espera y cómo evitar
  que un grupo quede esperando indefinidamente. Llegadas variables, no pilotos
  que obedecen al sensor sin pasar por el programa.
- Separar petición, concesión y ocupación. Un permiso no es una medición de
  pista libre. Retirarlo no detiene en seco a quien ya fue admitido.
- Permisos incompatibles no causan accidente por sí solos: hace falta coincidencia
  espacial; si ocurre, conflicto simple no gráfico y reset común como tránsito.
- Definir la cobertura de detectores, despegue/salida, tiempo de ocupación,
  poblaciones y colas acotadas antes de animar aviones.
- No agregar un bloque «despegar seguro» que resuelva arbitraje por el alumno.

La versión local por botones tiene bastante solapamiento con el tren/parking;
no es prioridad. La variante distribuida es más interesante: placas solicitan
turno por mensajes y un coordinador responde; enseñar identidad de solicitud,
confirmación, timeout, reintento y respuesta tardía. **Depende** de definir y
validar el canal Wi-Fi y sus límites; no declarar resuelto el emparejamiento/
canal autenticado de [fase 34](FASE_34_PANTALLA_CENTRAL_WIFI.md).
Mensajes sólo cambian entradas tipadas del programa, no ejecutan código remoto.

Dos ejemplos futuros si se aprueba: alternancia local secuencial y planificador
modular con cola/prioridad acotada. Antes hay que comprobar que la representación
de cola sea expresable con los bloques actuales; no prometer listas/arbitraje
distribuido ya implementados. Una versión sin cola compleja puede usar dos
banderas de pedido pendientes y alternar la prioridad tras cada turno.

## Condiciones de aceptación para cualquier variante retenida

- Acordar con el propietario disposición, reglas, sensores reales, límites y
  consecuencias; recién después autorizar una fase de implementación numerada.
- Un aporte pedagógico comprobable frente a 47–54. Si sólo cambia decoración,
  tratarlo como variante/composición, no otro motor completo.
- Identidades/roles visibles, restricciones explicadas, sensores automáticos sin
  controles competidores y ningún estado físico nuevo sin componente asociado.
- Geometría única entre editor/render/lecturas; memoria y azar acotados; un reloj.
- Proyecto JSON portable, validación frontend/backend, guardar/cancelar/undo/redo
  y dos ejemplos realmente ejecutables (directo/modular), no consignas vacías.
- Pruebas puras y worker con los workspaces reales, navegador y aceptación
  infantil/docente. Arduino/IDF/intérprete revisados si se toca un componente;
  no compilar SDK por cambios documentales o por un fondo web nuevo.
- Waveshare y maqueta física son aceptaciones separadas. No asumir que construir
  el mundo web actualiza el renderer del firmware ni garantiza montaje físico.

## Entrega de esta fase

Sólo este análisis y referencias en backlog/planes/contexto. Revisión de fuentes
y enlaces relativos, diff sin errores; no pruebas de simulación, builds o firmware
porque no cambia código ejecutable. Commit/push a rama documental desde dev1;
sin merge, despliegue ni operación remota. No hace falta actualizar la web para
leer el documento en GitHub. El propietario puede integrar la documentación en
dev1 con el flujo compartido si lo desea, sin promover main ni tocar dev2.
