# Fase 62 — GorillaBot: mando web y celular

Reglas aprobadas e implementación del 20 de octubre de 2026.
Rama `codex/fase-62-gorillabot-mando-web`, creada desde `origin/dev1`
`0c71577f8acde9195a41a7081573dfef8fbd1ea7`.
El propietario confirmó instalada la 61, pero Git remoto seguía en la 60:
se incorporó por avance rápido su entrega publicada `5d10f43782b94bd543f13c9d5fe89a3236f63593`
como dependencia, sólo en la rama de tarea. No se operó ningún servidor ni
se modificaron las ramas permanentes main/dev1/dev2.

## Autoridad y alcance

Un único programa y árbitro de movimiento, en la placa. El celular pide acciones;
no genera PWM, GPIO ni trayectorias, no ejecuta una segunda copia del programa.
El panel local lo sirve el intérprete ESP32. Funciona sin Internet, cuentas ni
servidor de CapiBloques durante el control. La PC sólo se usa para preparar
el proyecto, configurar la red y enviar las reglas.

El servicio lógico «Control remoto» se habilita dentro del GorillaBot en Armar
escena: no ocupa GPIO ni agrega otra tarjeta física. Expone valores tipados
en los bloques de Datos del robot. Hasta cuatro nombres de misión, únicos,
de 1–32 caracteres. El programa decide qué hace cada número (1–4); 0 significa
ninguna. No se publican todos los procedimientos ni se pueden invocar nombres
arbitrarios desde la red. Los nombres se aplican al salir del campo, dentro del
borrador de escena; Guardar/Cancelar/Deshacer/Rehacer siguen siendo los del editor.

Esta entrega usa intérprete y reglas. Con mando activo se bloquea explícitamente
la exportación nativa Arduino/ESP-IDF: no se entrega código que omita el watchdog
o finja un servidor inexistente. Los proyectos sin mando conservan ambas salidas.
No se cierra por esto el panel web genérico de fase24, ni los mandos63/64.

## Disposición

Panel adaptable, controles grandes y sin dependencias externas:

- Identificación de robot/proyecto y conexión.
- Selección Manual / Autónomo (misiones), habilitación en reposo.
- Adelante, atrás y giros, manteniendo presionado; teclado con flechas en PC.
- Ritmo 25–100, dentro de los límites de escena y del núcleo cinemático.
- Botones con los nombres de las misiones permitidas.
- Terminar en apoyo y DETENER AHORA, siempre accesibles estando conectado.
- Movimiento/reposo, error, distancia válida/no válida y botón físico.
- Ángulos ordenados bajo un detalle desplegable; no son posiciones medidas.

Los giros requieren `gait.turnsVerified` adulto. Los ejemplos no los necesitan;
para incorporarlos se agregan explícitamente sus condiciones y bloques.
No se promete un ángulo real ni equilibrio por el giro idealizado del simulador.

## Red, transporte y acceso

En Usar mi placa, después de conectar por USB:

1. Crear AP propio `Gorilla-XXXXXX`, con los seis últimos dígitos de la MAC,
   o conectarse como cliente a la red del aula.
2. Clave Wi-Fi de 8–63 caracteres. Se envía directamente por USB y se guarda
   en NVS; no viaja al servidor, JSON portable, historial ni Git.
3. Se genera en la placa una clave aleatoria de mando de 128 bits, distinta de
   la clave Wi-Fi. El asistente muestra nombre de red, clave de mando y dirección
   local. Consultar por USB permite recuperar esos datos sin reconfigurar.
4. En el celular, unirse a esa red, abrir la dirección y copiar la clave del
   mando. En modo cliente puede hacer falta consultar de nuevo al obtener DHCP.
   Que el AP no tenga Internet es normal. No se exige mDNS ni se inventa una IP.
5. Enviar y ejecutar las reglas. El programa prepara el controlador sin pulsos;
   el mando necesita conectar y habilitar antes de solicitar movimiento.

Configurar el mando reemplaza explícitamente el perfil de pareja Wi-Fi anterior.
La pareja Waveshare y este mando no se combinan en esta entrega: el asistente
lo explica y bloquea esa combinación. Compartir mando con pantalla es fase64.

HTTP local de mismo origen: página GET `/`, órdenes POST `/control`, JSON
acotado a 512 bytes, respuesta con estado y ACK. Se eligió petición/respuesta
con una sola solicitud en vuelo; no se necesita WebSocket para estas órdenes
discretas. Renovación aproximadamente cada 100 ms, nunca una animación por cuadro.
No se agrega un segundo protocolo de mensajes de aplicación a fase33: el mando
alimenta las mismas solicitudes tipadas que deberán reutilizar63/64.

La página se abre separadamente en la dirección local, no mediante `fetch` HTTP
desde el editor HTTPS público (contenido mixto/red privada). Sin CDN ni librerías
de Internet. Sin CORS, se comprueba Origin contra Host cuando está presente,
sin caché, sin incrustación en marcos y sin claves en URL o almacenamiento web.

La clave identifica un mando autorizado, no una cuenta infantil ni propiedad
exclusiva del robot. Sólo un controlador activo; otro obtiene rechazo y no toma
el control. Clave incorrecta, sesión ajena u orden inválida no renuevan el lease.
HTTP no cifra la LAN: usar AP WPA2 o red de aula confiable. No abrir puertos ni
publicar este panel en Internet; no es un control remoto por Internet.

## Reglas de movimiento y caducidad

- Cada adquisición comienza neutral y deshabilitada, con sesión aleatoria nueva.
- Secuencia estrictamente creciente y ticket aleatorio renovado por respuesta.
  Un ticket sólo es válido 500 ms desde su emisión en la placa. Las órdenes viejas,
  duplicadas, demoradas o de otra sesión no reviven movimiento ni actualizan el plazo.
- Plazo de conexión de 500 ms reales, medido por el robot, no por el celular.
  En el simulador también es tiempo real: cambiar velocidad no lo estira.
- Mantener una dirección: se solicita marcha mientras el programa la autorice.
  Soltar o pedir terminar elimina la solicitud; se bajan los pies en la posición
  horizontal actual, sin seguir empujando el cuerpo. No se salta al origen.
- El ritmo modifica el siguiente ciclo completo: fase efectiva =
  `faseEscena + (2000-faseEscena)*(100-ritmo)/75`, redondeada, entre la fase de
  escena y 2000 ms. 100 es el ritmo máximo configurado, no una velocidad física
  medida; las guardas cinemáticas pueden alargar aún más una transición.
- Cambiar modo o invertir una dirección sin pasar por reposo deshabilita el
  mando: termina en apoyo y exige habilitación neutral. No hay dos dueños de motores.
  Si se pulsa de nuevo antes de terminar el apoyo, se exige habilitar al terminar.
- DETENER AHORA interrumpe sin trayectoria de apoyo y conserva PWM en la última
  posición ordenada. Queda enclavado hasta habilitar neutral, sin movimiento pendiente.
  No corta energía ni certifica una postura estable. No reemplaza un corte físico.
- Desconexión, celular bloqueado, página oculta/fuera de foco o cierre: dejan de
  renovar; el watchdog de placa termina en apoyo. No depende de recibir `pointerup`.
  Reabrir/reconectar nunca reanuda ni retransmite una orden anterior.
- Toda misión iniciada por este mando también necesita conexión viva. Las misiones
  autónomas locales de61 siguen funcionando sin celular en proyectos sin este mando.
- STOP/PAUSE por USB invalidan el control; RUN/RESET no heredan la sesión anterior.
- Sólo preparar, marcha con mando/condición y solicitar finalizar se admiten con
  mando habilitado en el proyecto. Banco/posturas/N ciclos libres se prueban sin mando:
  no se permite una orden libre que ignore las guardas de desconexión.

El reloj de seguridad y el estado HTTP se separan de los bloques. El servicio de
robot comprueba caducidad y fin aunque el programa esté esperando otra condición.
El panel no impone detección invisible: sensores, distancias y misiones siguen
siendo decisiones visibles del programa. Un sensor frontal no protege marcha atrás.

## Bloques, datos y simulación

Nuevo bloque «caminar con mando hasta que… máximo… segundos», cuatro direcciones,
con guardas de permiso, fin en apoyo y máximo 1–120 s. Conserva condición y árbitro
de61; no agrega un planificador. En reglas es `gorilla/walk` con `remote:true`.

Datos derivados, nunca persistidos en `config.values`:
`remoteConnected`, `remoteArmed`, `remoteStopped`, `remoteDirection` (quieto,
adelante, atrás, izquierda, derecha), `remoteMode` (manual/autónomo),
`remoteRhythm`, `remoteMission`. El resultado de marcha conserva `walkOutcome`.
El simulador publica ticket/secuencia sólo para su mando transitorio, no en JSON.

En la pestaña Escena aparece «Mando remoto · ensayo en simulador»: conectar,
habilitar, mantener direcciones, ritmo, modo/misión, fin, STOP y pérdida de conexión.
Deshabilitado durante el espejo físico: nunca inyecta órdenes a la placa por error.
La escena del editor no reproduce la teleoperación Wi-Fi ni es realimentación del
robot; el estado del mando físico se consulta en su propio panel local.
Reiniciar limpia robot, mundo, mando y sesión; pausa congela la simulación sin
convertir la renovación de mando en tiempo acelerado.

## Dos ejemplos completos

1. **GorillaBot: mando desde el celular** (`gorillaRemote`): preparar y bucle
   que consulta dirección, responde adelante/atrás y espera cooperativamente.
   Sin sensores ni obstáculos simulados. Una pestaña, sin autopiloto oculto.
2. **GorillaBot: mando y misión con sensores** (`gorillaRemoteMissions`):
   tres procedimientos y pestañas Principal/Mando/Autonomía. Manual o misión
   «Explorar el corredor»: avance hasta 3 cm virtuales, botón, falta de eco,
   desconexión o máximo30s. Monitor paralelo, misión atendida una sola vez por
   solicitud mantenida. No hay retroceso automático ni giro oculto.

Los dos se importan/exportan completos y caben en 32 KiB (aprox4/11KiB).
Los ejemplos58–61 se mantienen. Cambiar los nombres de misión no crea código:
si se agregan misiones2–4, hay que programar sus condiciones y procedimientos.

## Runtime, actualización y evidencia

Intérprete **1.16.0**, ABI1, capacidad `gorilla-remote`, sólo Wemos/DevKit.
Se agrega el componente oficial `esp_http_server` ya provisto por ESP-IDF;
sin paquetes npm/Python ni migraciones SQL. Se conservan objetos SDK y cachés
incrementales. La actualización de DEV prepara el bundle; instalar después
el firmware nuevo en la placa desde el asistente, antes de enviar estas reglas.

Pruebas reproducibles:

- `scripts/gorilla-remote.test.mjs`: configuración estricta, sesión exclusiva,
  secuencia/ticket, órdenes inválidas, caducidad/rollover, STOP/rearme TS/C++.
- `scripts/remote-driver.test.mjs`: adaptadores HTTP/runtime reales compilados
  con HAL y `-Wall -Wextra -Werror`, separados de un build de SDK.
- `scripts/gorilla-remote-worker.test.mjs`: ambos workspaces Blockly reales,
  JSON/reglas, marcha/soltar, pérdida de conexión, STOP, misión de un solo disparo,
  sin contacto, velocidades1×/4×.
- `scripts/remote-panel.test.mjs`: HTML que sirve el firmware, probado en Chromium
  con transporte simulado: mantener/soltar, STOP/rearme, modo/misión y pérdida de foco.
- `tests/gorilla-remote.spec.ts`: editor real con ambos proyectos y mando de simulación.
- Validación backend del perfil nuevo y rechazo de secretos/estados derivados en JSON.

Resultados locales: typecheck/lint y smoke completo aprobados; build de las diez
páginas estáticas aprobado (aviso ya existente de chunks >500KiB); ocho tests de
validación backend y empaquetado aprobados; dos recorridos Chromium del editor y
el panel HTML real con transporte simulado aprobados. El watchdog real compilado
con HAL caduca, inicia un único apoyo sin esperar bloques y respeta STOP.

Aceptación pendiente: build completo con ESP-IDF/placa, red AP y cliente reales,
latencia sostenida y consumo/recursos medidos, varios celulares, red de aula,
calibración/estabilidad física del robot sostenido y luego en pista. Compilar
contra HAL o probar Chromium no demuestra estos resultados. Empezar con motores
desconectados o robot sostenido, y confirmar desconexión/STOP antes de apoyarlo.
Sensores de suelo61, mando físico63 y Waveshare64 siguen pendientes.

El propietario integra/actualiza sólo dev1 con `~/.local/bin/capi-dev --env dev1
--branch codex/fase-62-gorillabot-mando-web --commit SHA40` (en una línea).
No promover main ni actualizar dev2 implícitamente.
