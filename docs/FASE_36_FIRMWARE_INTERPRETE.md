# Fase 36 — Firmware intérprete y ejecución directa en placa

## Estado de implementación — 24 de septiembre de 2026

La fase está **terminada en software**. Ya están implementados:

- `CapiRules` v1 / ABI 1: sobre binario acotado inicialmente a 32 KiB para no prometer RAM inexistente en Wemos, carga útil canónica, placa, recursos, grafo cooperativo compartido, tabla de depuración, conteos y CRC32;
- `CapiLink`: `HELLO`, negociación placa/versión/ABI/capacidades, carga fragmentada `BEGIN/CHUNK/VERIFY/COMMIT`, ejecución, pausa, continuación, detención y telemetría acotada;
- bloqueo en navegador de placa equivocada, firmware anterior a 1.0.0, ABI distinta, programa sobredimensionado o capacidad ausente;
- selector visible **Simulador / Placa conectada**, sin enviar reglas o proyectos al servidor;
- instalación/actualización Web Serial usando los mismos controles de detección, flash y verificación existentes;
- proyecto ESP-IDF del intérprete para ESP32 y ESP32-S3, dos ranuras de reglas A/B y selector NVS con conmutación posterior a escritura/lectura/verificación, arranque autónomo, scheduler con paralelo/fork-join, expresiones y variables tipadas, entradas analógicas/digitales, GPIO/LED/semaforización/motores/robot, servo, buzzers, contador y consola;
- matriz MAX7219 32 × 8 con orden/orientación configurables, dibujos, píxeles y desplazamiento cooperativo, además de `Esperar animación` explícito;
- Mensajes sobre un puerto reasignable: envío y recepción cooperativa con cabecera, tamaño, CRC16, cierre, comparación y timeout;
- familia Otto genérica con cuatro o seis servos, movimientos cooperativos, brazos, sonidos, ultrasonido y expresiones MAX7219 según el perfil configurado;
- pantallas de texto LCD 16 × 2 y 20 × 4 por PCF8574 I2C, y LCD Keypad Shield paralelo, con texto fijo/dinámico, limpieza, animaciones cooperativas y lectura de sus cinco botones;
- pantallas gráficas SSD1306 I2C e ILI9341/ILI9488 SPI con áreas de texto, fuente ASCII, dibujos propios/predefinidos y animaciones cooperativas;
- Wi‑Fi cliente con aprovisionamiento separado: alias y clave viajan directamente por Web Serial, se guardan en la NVS de la placa y nunca forman parte de `CapiRules`, del proyecto, del servidor ni del historial;
- construcción reproducible de dos artefactos estáticos, manifiestos con hash y publicación automática la primera vez que DEV recibe esta versión; los binarios generados no se guardan en Git;
- pruebas de formato determinista, corrupción, placa cruzada, framing, empaquetado, USB simulado, UI Chrome, tipos, estilo, smoke y build estático.

La compilación fijada en ESP-IDF 5.5.5 produjo y empaquetó correctamente los intérpretes de Wemos D1 R32 y ESP32-S3 en CI el 24 de septiembre de 2026. La fase **no tiene aún aceptación física**: falta publicar los artefactos en DEV y probar instalación, reinicio, carga de reglas y controladores con una Wemos/DIYmall y una ESP32-S3 reales. RGB se rechaza explícitamente porque pertenece a una fase de componente todavía pendiente; nunca se ejecuta parcialmente. Waveshare permanece fuera hasta validar su perfil exacto. Arduino y ESP-IDF por proyecto siguen disponibles.

**Estado:** software terminado; despliegue en DEV y aceptación física pendientes.

Este documento concentra la planificación completa. La entrada breve vive en [BACKLOG.md](BACKLOG.md) y la asignación de fase en [PLAN_FASES_BACKLOG.md](PLAN_FASES_BACKLOG.md).

## 1. Objetivo

Evitar que cada cambio de bloques requiera compilar Arduino o ESP-IDF en el servidor. Cada modelo de placa tendrá un **firmware CapiBloques precompilado** que interpreta un programa portable de reglas. La web descarga y graba ese firmware sólo la primera vez o al actualizarlo; en el uso cotidiano genera las reglas localmente y las envía directamente a la placa conectada.

El alumno podrá elegir:

- **Ejecutar en el simulador**.
- **Ejecutar en la placa conectada y seleccionada**.

Arduino, ESP-IDF y la exportación de fuentes continúan disponibles como modo nativo y alternativa para capacidades todavía no incluidas en el intérprete.

## 2. Decisiones de arquitectura

1. El servidor **no compila por proyecto** en el recorrido normal del intérprete. Publica artefactos inmutables precompilados por placa y versión.
2. El navegador transforma el mismo programa normalizado que usa el simulador en reglas/bytecode compacto; no envía C/C++ ni código nativo arbitrario.
3. La instalación o actualización del intérprete usa Web Serial y el flujo de grabación existente. La actualización cotidiana de reglas usa un protocolo de aplicación, sin entrar al bootloader.
4. Antes de generar o transferir reglas, la web consulta placa, versión de firmware, ABI y capacidades. Un firmware obsoleto o incompatible **bloquea la carga de reglas**: se ofrece actualizarlo o cancelar, sin opción «continuar de todos modos».
5. La placa valida, almacena y activa las reglas de forma atómica. Una transferencia incompleta conserva el último programa válido.
6. El programa queda almacenado y continúa autónomamente si se cierra la página o se desconecta USB.
7. Las operaciones sensibles al tiempo —PWM, servos, audio, WS281x, displays y buses— permanecen en controladores nativos precompilados. El intérprete ordena acciones de alto nivel; no genera pulsos en bytecode.
8. Simulador, intérprete y generadores nativos comparten tipos, validaciones y semántica observable. No se mantienen tres lenguajes diferentes por accidente.

## 3. Alcance inicial

El primer alcance debe ejecutar:

- inicio único, secuencias, bucles, condicionales y `Al mismo tiempo`;
- números, texto, sí/no, comparadores, contadores y variables;
- temporizadores/eventos y procedimientos cuando sus fases estén entregadas;
- componentes digitales, PWM, motores, servos, buzzers, sensores y barrera infrarroja;
- Mensajes, consola, pantallas, MAX7219, Otto y luces RGB sólo cuando cada controlador esté incluido y declarado por el firmware;
- almacenamiento acotado de dibujos, textos y tablas necesarios por el proyecto;
- telemetría de bloques, caminos, variables, temporizadores, componentes y errores.

Una capacidad ausente se rechaza antes de transferir. No se degrada silenciosamente ni se interpreta como otro componente.

## 4. Fuera de alcance inicial

- Ejecutar C/C++ o bibliotecas arbitrarias recibidas desde el navegador.
- Reemplazar inmediatamente Arduino/ESP-IDF nativo.
- Control físico remoto permanente desde Internet.
- Prometer el mismo máximo de memoria, componentes o velocidad en todas las placas.
- Actualizar firmware sin acción visible y confirmada del usuario.
- Guardar credenciales Wi‑Fi dentro del JSON portable o el bytecode compartible.

## 5. Firmwares precompilados

Habrá un artefacto explícito por perfil físico soportado, como mínimo:

- Wemos D1 R32 / ESP32 clásico.
- DIYmall ESP32-S3-DevKitC V1.0 N16R8.
- Waveshare ESP32-S3 Touch LCD 5 de revisión identificada.

No se infiere compatibilidad por compartir familia de CPU. Flash, PSRAM, particiones, USB, display integrado, pines reservados y revisión de placa pueden exigir artefactos distintos.

Cada publicación contendrá:

- identificador estable de placa y revisión;
- versión del firmware y ABI de reglas admitida;
- bootloader, tabla de particiones, aplicación y direcciones de grabación;
- lista de capacidades, controladores y límites;
- tamaño, hashes criptográficos y metadatos de construcción reproducibles;
- versión mínima de la web compatible y política de actualización/reversión.

Los artefactos se construyen en un recorrido de mantenimiento/CI, no al ejecutar un proyecto. La web obtiene el manifiesto y los binarios como archivos estáticos; esa descarga no ocupa la cola de compilación de usuarios.

## 6. Formato de reglas

El formato será binario, acotado y versionado. Debe admitir inspección mediante una herramienta de diagnóstico, pero no necesita ser editable manualmente.

Contenido lógico:

1. **Cabecera:** magia, versión, tamaño total, placa objetivo, ABI, identificador/hash del proyecto y checksum.
2. **Recursos:** componentes, pines, perfiles, límites, cadenas, dibujos y constantes.
3. **Programa:** caminos, instrucciones, saltos validados, eventos, procedimientos y expresiones.
4. **Estado inicial:** variables, contadores y configuración que forma parte del proyecto.
5. **Tabla de depuración:** relación compacta entre instrucción y bloque para telemetría y errores.

No contiene:

- identidad de cuenta, curso o permisos del servidor;
- contraseñas, tokens o claves Wi‑Fi portables;
- punteros, direcciones de memoria o código ejecutable nativo;
- datos innecesarios del historial o del editor.

Los secretos necesarios se provisionan en una operación separada, privada y explícita. Las reglas sólo pueden referirse a una configuración local autorizada.

## 7. Runtime de la placa

El firmware se divide en módulos claros:

- **protocolo de enlace:** identificación, capacidades, carga, ejecución y telemetría;
- **validador:** estructura, ABI, tamaños, referencias, tipos, pines y recursos;
- **gestor de componentes:** reserva GPIO, PWM, RMT, I2C, SPI, timers y memoria;
- **máquina virtual:** instrucciones acotadas, pila/frames con máximos estáticos y sin recursión inicial;
- **planificador cooperativo:** caminos, eventos, timers y servicios no bloqueantes;
- **controladores nativos:** hardware soportado por ese perfil;
- **almacenamiento atómico:** programa activo y candidato, con versión/checksum;
- **diagnóstico:** watchdog, código de error, bloque responsable y reinicio seguro.

No habrá asignación sin límites ni bucles internos que impidan servir watchdog, mensajes o controladores. El presupuesto de instrucciones por turno evita que un camino monopolice la placa.

## 8. Transferencia y almacenamiento atómicos

Protocolo mínimo:

1. `HELLO`: placa, firmware, ABI, capacidades y programa activo.
2. `BEGIN`: metadatos y tamaño; la placa reserva una ranura candidata.
3. `CHUNK`: fragmentos numerados con integridad y reintento idempotente.
4. `VERIFY`: validación completa sin activar.
5. `COMMIT`: activa atómicamente el candidato y conserva recuperación acordada.
6. `RUN`, `PAUSE`, `RESUME`, `STOP`, `RESET_PROGRAM` y consulta de estado.

Una desconexión antes de `COMMIT` descarta o deja inválida sólo la ranura candidata. El firmware nunca ejecuta parcialmente una transferencia. Se fijarán tamaño máximo, timeout, frecuencia de comandos y backpressure; no se confía en campos provistos por el navegador.

## 9. Experiencia en la web

El control principal mostrará un destino inequívoco:

```text
Ejecutar en: [ Simulador ]
             [ Placa conectada: Wemos D1 R32 ]
```

Flujo de placa:

1. Elegir puerto mediante gesto del usuario.
2. Identificar chip y consultar el firmware CapiBloques si responde.
3. Comparar placa elegida, hardware detectado, firmware, ABI y capacidades.
4. Si falta, está desactualizado o no admite la ABI/capacidades requeridas, bloquear generación y transferencia y ofrecer **Instalar/actualizar firmware CapiBloques** con placa y efecto claramente indicados, o cancelar.
5. Repetir el `HELLO` después de actualizar y comprobar la nueva versión/capacidades; no confiar en que la grabación exitosa implica compatibilidad.
6. Validar escena/programa en el navegador.
7. Generar reglas localmente y comparar su hash con el programa activo.
8. Si no cambió, ejecutar/reiniciar sin retransmitir; si cambió, transferir y confirmar.
9. Mostrar bloques y estados reales enviados por la placa.

No se mezclan los conceptos **instalar firmware**, **enviar programa** y **ejecutar**. Los errores dicen en cuál falló y qué permanece grabado.

## 10. Telemetría y ejecución guiada

La placa podrá informar, con frecuencia y volumen acotados:

- inicio/fin/pausa/error de ejecución;
- bloque y camino activos;
- progreso de esperas, movimientos y animaciones;
- variables, contadores y temporizadores seleccionados;
- lecturas y estados lógicos de componentes;
- advertencias de recursos, watchdog y reinicios.

La interfaz diferencia **estado simulado**, **estado lógico informado por la placa** y **medición física**. Un LED ordenado como encendido no prueba corriente real; un servo sin realimentación sólo informa la posición solicitada.

La telemetría no es requisito para que el programa continúe. Si USB desaparece, el firmware reduce o descarta la salida según backpressure y sigue ejecutando.

## 11. Compatibilidad y versionado

La negociación usa tres identidades distintas:

- versión del sitio/editor;
- versión/ABI del formato de reglas;
- versión y perfil del firmware.

Reglas:

- La web puede generar únicamente una ABI declarada por la placa.
- La política publicada por el manifiesto define la versión mínima vigente por perfil. Una versión inferior bloquea toda carga de reglas aunque entienda una ABI antigua; actualizar o cancelar son las únicas salidas.
- Un firmware puede admitir un rango acotado de ABI, no conversiones ilimitadas.
- Cambios incompatibles exigen actualización visible del firmware o uso del modo nativo.
- Proyectos JSON siguen siendo la fuente portable; el bytecode es derivado y regenerable.
- El caché de reglas se identifica por proyecto normalizado, placa, ABI, capacidades y configuración sin secretos.

## 12. Seguridad y permisos

- Web Serial requiere selección explícita del puerto; reconectar no concede permisos de cuenta o proyecto.
- Antes de enviar, se revalidan sesión, propiedad/curso y estado guardado según el flujo vigente.
- La placa acepta sólo instrucciones conocidas, referencias válidas y recursos dentro del manifiesto.
- No hay escritura arbitraria de memoria, GPIO no declarado, particiones o registros.
- La instalación de firmware muestra el modelo objetivo y advierte que reemplaza la aplicación actual.
- Firmware y manifiesto se verifican por hash; antes de producción se define firma/autenticidad y reversión.
- Logs y telemetría no incluyen secretos. Wi‑Fi usa aprovisionamiento separado.
- Un proyecto malicioso o corrupto no debe eludir límites, watchdog ni reservas de pines.

## 13. Recursos y controladores

Cada firmware publica un inventario concreto: GPIO permitidos/reservados, PWM, timers, RMT, buses, RAM, flash y cantidades máximas por controlador. Navegador y placa validan el mismo contrato, pero la placa es la autoridad final.

Conflictos como tono/temporizador, servo/PWM, WS281x/RMT, display/SPI o Wi‑Fi/RMT no se resuelven por prioridad oculta. El proyecto se rechaza con una explicación y alternativas. Incorporar un componente nuevo exige agregar su controlador al firmware, publicar capacidades y probar el nuevo artefacto; no obliga a recompilar proyectos ya compatibles.

## 14. Convivencia con compilación nativa

La interfaz mantendrá:

- **Ejecución rápida en intérprete:** recorrido recomendado para aprendizaje y componentes soportados.
- **Arduino nativo:** fuente, compilación y binario cuando se solicite.
- **ESP-IDF nativo:** fuente, compilación y binario cuando se solicite.
- **Exportar JSON/fuentes:** sin depender de que la placa esté conectada.

El modo nativo cubre bibliotecas externas, optimizaciones o hardware todavía ausente del runtime. No se simula compatibilidad: si el proyecto usa una capacidad no publicada, la web ofrece modo nativo o explica qué falta.

## 15. Orden interno de construcción

Esta es una sola fase; los puntos son hitos de trabajo, no subfases independientes:

1. Congelar la semántica mínima y especificar ABI, instrucciones, manifiesto y límites.
2. Construir un intérprete de referencia ejecutable en pruebas de escritorio contra fixtures del simulador.
3. Crear runtime Wemos con enlace, almacenamiento atómico, scheduler y componentes mínimos.
4. Integrar instalación de firmware precompilado y ejecución en placa desde la web.
5. Agregar telemetría y resaltado real.
6. Portar a ESP32-S3 DevKit y luego Waveshare, publicando diferencias de capacidades.
7. Incorporar controladores restantes con pruebas de conformidad por componente.
8. Medir y documentar límites, fallos, recuperación y comparación frente al modo nativo.

## 16. Verificación

Pruebas obligatorias:

- conformidad: el mismo programa produce el mismo orden observable en simulador, VM de referencia y placa;
- validación negativa: bytecode truncado, checksum erróneo, ABI desconocida, referencias/pines inválidos y exceso de recursos;
- transferencia: corte en cada etapa, duplicados, reintento, puerto retirado y recuperación del programa anterior;
- scheduler: bucle intensivo, paralelo, timers, mensajes, animaciones y watchdog sin inanición;
- persistencia: reinicio, pérdida de energía durante carga/commit y selección inequívoca de versión;
- capacidades: proyecto válido para una placa e inválido para otra con explicación;
- actualización obligatoria: firmware vigente, antiguo, desconocido, grabación cancelada/fallida y nueva consulta posterior; ninguna variante obsoleta recibe reglas;
- telemetría: backpressure, desconexión y reconexión sin detener el programa;
- seguridad: fuzzing del parser, tamaños extremos, comandos fuera de estado y ausencia de secretos;
- hardware: Wemos, S3 DevKit y Waveshare exactas antes de declarar sus artefactos soportados.

## 17. Criterios de aceptación

- Tras instalar el firmware una vez, modificar bloques y ejecutar en placa no dispara compilación ni cola del servidor.
- Antes de cargar reglas se comprueba la versión contra el manifiesto vigente; firmware viejo ofrece actualización o cancelación y no puede recibir el programa.
- Un proyecto pequeño se valida, transfiere y comienza en segundos, con métricas reales publicadas y sin ETA ficticia.
- Ejecutar sin cambios reutiliza el programa activo; enviar cambios es atómico y recuperable.
- La placa continúa autónomamente al cerrar la web.
- El bloque resaltado y los estados mostrados corresponden a telemetría real, no a una simulación paralela fingida.
- Simulador e intérprete superan una suite común de conformidad; las diferencias de hardware quedan explícitas.
- Arduino y ESP-IDF nativos siguen disponibles y no pierden compatibilidad con los proyectos existentes.
- La instalación de un firmware incorrecto se previene cuando sea detectable y nunca se presenta el nombre elegido por el usuario como detección física suficiente.

## 18. Riesgos y decisiones pendientes

- Tamaño real del firmware completo en Wemos y estrategia si no caben todos los controladores.
- Cantidad de ranuras y partición de recuperación frente a espacio disponible.
- Representación final del bytecode y presupuesto de instrucciones por turno.
- Protocolo de firma de artefactos antes de producción.
- Alcance de pausa/paso a paso en hardware: detener actuadores puede ser inseguro o semánticamente distinto.
- Política para firmware antiguo sin ABI compatible y funcionamiento cuando el servidor de artefactos no está disponible.
- Límites de telemetría en proyectos con muchos eventos.
- Aprovisionamiento privado de Wi‑Fi separado de proyectos/reglas.

Estas decisiones se resuelven con prototipos y mediciones al iniciar la fase; no invalidan la arquitectura general ni autorizan su implementación anticipada.
