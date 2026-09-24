# Nuevas fases de CapiBloques

Plan elaborado el 8 de septiembre de 2026 y actualizado el 24 de septiembre de 2026. **Fases 11–14 y 29 entregadas; fases 15, 16, 27, 28, 30 y 36 terminadas en software; fase 23 en curso**. DEV está publicado en `https://capibloques.dev.nvicchi.com/`, aunque cada cierre posterior requiere su actualización explícita. La fase 19 queda ampliada por el inventario pedagógico y el bloque `según`; las fases 31–35 y 37–41 conservan las capacidades pendientes. No están autorizadas por estar documentadas. La Fase final sigue postergada. El [contexto vivo](CONTEXTO_PARA_CONTINUAR.md) conserva evidencia y operación.

La antigua fase 11 de producción pasa a llamarse **Fase final**, sin número y **postergada**. Las nuevas fases continúan con enteros consecutivos; no hay fases con letras ni entregas parciales presentadas como fases completas. La fase 10 conserva su aceptación física pendiente por falta de Wemos. Los pedidos del 23 de septiembre amplían la fase 19 y continúan hasta la fase 41 sin alterar entregas cerradas.

## Orden y cobertura

| Fase | Entrega completa | Pedidos del backlog | Dependencia |
| --- | --- | --- | --- |
| 11 | Contexto portable documentado; mantenimiento obligatorio en cada entrega | Pedido adicional del propietario | Documentación y estado verificable; sin migrar secretos ni datos |
| 12 | Entregada y verificada en DEV/CI: editor despejado, navegación de escena, sesión sin interrupciones y guía visual Wemos | 1, 6, 8 y 10; 9: Wemos | Traspaso de fase 11; pinout documentado para la guía, sin sustituir ensayo físico |
| 13 | Acceso externo persistente y seguro a DEV | 11: publicar DEV controladamente | Acceso autorizado a la VM Nginx existente; dominio/registro DNS creado por el propietario; sin tocar gateway ni host Proxmox |
| 14 | Entregada y verificada en DEV: ejecución visual en los bloques y paralelo vertical | 4, 5 y 7 | Distribución de fase 12 |
| 15 | Software entregado: componente y bloques TX/RX; aceptación Wemos pendiente | 3: TX/RX; 9: conexiones seriales | Wemos actual como primer destino; simulador y ambos generadores |
| 16 | Soporte completo ESP32-S3 DevKit y selección de placa | 2: DevKit; 9: guía visual DevKit | Modelo exacto identificado; incorporar el contrato TX/RX de fase 15 |
| 17 | Perfil Waveshare ESP32-S3 con pantalla de 5 pulgadas | 2: Waveshare; 9: guía visual Waveshare | Perfiles de fase 16 y modelo/revisión exactos identificados |
| 18 | Escena gráfica y controles locales en el display | 3: display interactivo | Perfiles de pantalla de fase 17 y ejecución/componentes existentes |
| 19 | Desafíos progresivos, herramientas pedagógicas y bloque `según` | 12 y 35 | Plan completo versionado; primeros retos sin hardware; valores tipados de fase 29 |
| 20 | Compilación y grabación guiadas, medibles y comprensibles | 15 y 17; informe externo vital 1–3 | Fase 10 aceptada físicamente para cerrar el recorrido USB; métricas sintéticas previas a optimizar |
| 21 | Claridad y ergonomía educativa del editor | Informe externo vital 4, sutiles 1–8 y futuras 1–2, 5–7 | Fases 12 y 14; reproducción previa de cada observación |
| 22 | Avatar acompañante y reacciones accesibles | 14; informe futuro 3 | Fase 19 para reacciones de desafíos y fase 20 para resultados de compilar/grabar |
| 23 | En curso: software de matriz MAX7219 implementado; aceptación física de matriz y displays pendiente | 18 y 19 | Módulos exactos identificados; fase 10 para el recorrido físico por USB |
| 24 | Panel web local para celular | 20 | Contrato Wi-Fi vigente, seguridad/emparejamiento y límites medidos |
| 25 | Compartir proyectos por enlace y QR | Informe futuro 4 | Biblioteca/permisos existentes; modelo explícito de copia, caducidad y revocación |
| 26 | Acceso de aula sin contraseña y asistencia | Informe futuro 8 | Identidad/sesiones/cursos existentes; modelo contra suplantación y equipos compartidos |
| 27 | Familia de robots HP Robots / Otto | 25 | Perfiles físicos identificados, planificador cooperativo y componentes existentes |
| 28 | Barrera infrarroja digital | 26 | Módulo exacto y entrada digital disponible |
| 29 | Datos, variables y textos dinámicos | 27 | Tipos y expresiones comunes para componentes y destinos |
| 30 | Software entregado: temporizadores y eventos cooperativos; DEV/físico pendientes | 28 | Planificador no bloqueante y modelo de valores de fase 29 |
| 31 | Procedimientos y funciones | 29 | Tipos de fase 29 y validación del grafo de llamadas |
| 32 | Estados y valores consultables de componentes | 30 | Contrato de valores de fase 29 e inventario de capacidades por componente |
| 33 | Wi-Fi AP/cliente y mensajes entre placas | 31 | Wi-Fi y Mensajes existentes; secretos privados; simulación multiplaca |
| 34 | Servicios y control remoto entre placas | 32 | Mensajería de fase 33 validada física y funcionalmente |
| 35 | Luces RGB inteligentes WS281x/SK6812 | 33 | Perfiles físicos identificados; planificador cooperativo; recursos RMT/SPI medidos por placa |
| 36 | Software entregado: firmware intérprete y ejecución directa en placa; DEV/físico pendientes | 34 | ABI común, artefactos precompilados por placa, Web Serial y suite de conformidad |
| 37 | Ayuda infantil de componentes | 36 | Perfiles, pinouts y evidencia física vigentes; activos visuales con licencia |
| 38 | Entradas y control cotidiano | 37 | Contratos de valores/eventos de fases 29–32; perfiles físicos identificados |
| 39 | Ambiente y medición | 37 | Fase 38 y ADC/I²C compartidos validados por placa |
| 40 | Movimiento e identificación | 37 | Eventos cooperativos, privacidad y buses validados |
| 41 | Actuación y medición avanzada | 37 | Planificador cooperativo, privacidad GPS y hardware concreto |
| Final | Producción, HTTPS, respaldos y piloto | Antigua fase 11 | Postergada hasta autorización explícita y validaciones de salida |

Primero se asegura la continuidad desde otra cuenta sin depender de este chat; después se atienden los problemas cotidianos del editor y se vuelve DEV accesible desde fuera mediante un servicio controlado. TX/RX se incorpora antes de las placas nuevas para tener un contrato de comportamiento que luego se valide en cada destino. Separar DevKit, Waveshare y display interactivo permite comprobar por separado placa, pantalla y aplicación gráfica: no son el mismo soporte. Los desafíos aprovechan esas funciones como recorrido educativo propio. Las fases 20–26 separan flujos de compilación, pulido de edición, motivación, periféricos, control local, intercambio e identidad de aula para no mezclar permisos o hardware distintos en una entrega inmanejable.

## Fase 11 — Contexto portable y traspaso a otra cuenta

**Objetivo:** que otra cuenta o una conversación nueva pueda continuar el proyecto leyendo el repositorio, sin necesitar el historial de este chat ni adivinar decisiones.

**Entregada:** `14c4dcc`, punto de entrada y 55 enlaces locales del contexto comprobados desde clon limpio de GitHub. El [contexto vivo](CONTEXTO_PARA_CONTINUAR.md) incorpora también la fase 12 y debe actualizarse al cerrar cada fase futura autorizada. No se transfieren credenciales, sesiones ni datos privados por Git.

Alcance:

- Crear una entrada única, `docs/CONTEXTO_PARA_CONTINUAR.md`, enlazada desde README y AGENTS, con un mensaje inicial listo para copiar a la nueva conversación y un orden de lectura. Enlazar las guías existentes en lugar de duplicar instrucciones que puedan divergir.
- Documentar producto, público, decisiones y motivos; arquitectura, mapa de carpetas, contratos críticos, herramientas y versiones fijadas; flujo desde bloques/JSON hasta simulación, Arduino/ESP-IDF, compilación y USB.
- Inventariar fases entregadas, pendientes y postergadas; problemas conocidos y backlog completo. Distinguir explícitamente implementación, compilación, pruebas simuladas y aceptación física: la falta de Wemos de fase 10 sigue abierta.
- Registrar un corte fechado: rama, commit de código verificado, estado del árbol, pruebas/CI y resultados, versión desplegada conocida por entorno y fuentes de evidencia. Si un dato remoto no se vuelve a verificar, señalar su fecha y que debe comprobarse, sin declararlo vigente por suposición.
- Explicar desarrollo local y DEV, túnel dedicado y acceso LAN/salto mediante configuración privada, servicios, despliegue, compiladores, diagnóstico, respaldos y recuperación. Separar comandos de consulta de los que cambian datos o reinician servicios; conservar los procedimientos ya probados.
- Recoger directivas del propietario: una fase completa por vez, avances frecuentes, commit/push, no adelantar producción, recursos limitados, prohibición de modificar el gateway y límites sobre Proxmox/router/Nginx. Las autorizaciones previas no habilitan acciones nuevas al cambiar de cuenta.
- Enumerar lo que no viaja con Git: credenciales, sesiones, permisos de GitHub/SSH, configuración privada, base de datos, artefactos temporales y borradores del perfil del navegador. Indicar qué debe aportar o autenticar el propietario por un canal privado, sin copiar valores, rutas de claves, datos de alumnos ni secretos al repositorio.
- Incluir pendientes inmediatos, bloqueos reales, riesgos y próxima acción autorizada; una lista de comprobación para retomar sin reinstalar ni borrar datos y un procedimiento para mantener actualizado el contexto al cerrar futuras fases.

Aceptación:

- Desde un checkout limpio se encuentra el punto de entrada y se reconstruyen estado, alcance, reglas, arquitectura y próximos pasos sin leer el chat. Todos los enlaces y comandos de consulta documentados tienen un destino verificable; las operaciones sensibles están identificadas.
- Revisar coherencia con plan, backlog, README y AGENTS; no confundir la nueva fase 11 con la antigua fase de producción. Verificar que los archivos del traspaso no contienen credenciales ni información privada infantil.
- Entregar contexto y mensaje inicial mediante commit/push. La nueva cuenta necesita permisos propios verificados antes de operar; no se promete transferir automáticamente chats, memoria, autenticación o sesiones de herramientas.

Esta fase documenta y prepara continuidad: no migra usuarios de CapiBloques, no crea cuentas externas, no cambia contraseñas y no despliega producción.

## Fase 12 — Editor despejado y sesión sin interrupciones

**Objetivo:** recuperar espacio para programar y armar escenas, poder explorar la escena con desplazamiento/zoom y mantener una sesión que no interrumpa cada cambio de ventana.

**Entregada y verificada en DEV/CI:** [guía de entrega y evidencia](FASE_12_MESA_DE_TRABAJO.md), código `668be43`. Altura útil medida 54,9 % → 80,6 % a 1366 × 768, cámara separada del proyecto, Wemos y sesiones periódicas. La guía distingue la verificación software del ensayo físico pendiente de fase 10. Los criterios siguientes conservan el alcance acordado.

Alcance:

- Reorganizar encabezados, acciones de proyecto/cuenta y controles secundarios. Guardar/estado de guardado, deshacer/rehacer, ejecutar y detener deben seguir accesibles; no ocultar errores o cambios pendientes.
- Como objetivo de diseño en 1366 × 768: no más de dos filas de controles globales y al menos 70 % de altura del editor dedicada a bloques/escena. Medir antes/después; adaptar móvil y zoom sin sacrificar legibilidad para cumplir una cifra.
- Separar visual y funcionalmente catálogo de componentes y programa. El catálogo podrá ser un panel temporal superpuesto con cierre claro; arrastrar desde él debe seguir funcionando en Chrome/Edge y con alternativas de teclado.
- Agregar cámara de escena con desplazamiento, zoom hacia una zona y controles «Ver toda la escena»/restablecer, tanto al editar como al simular y revisar en modo docente de sólo lectura. Distinguir herramienta «Mano» o gesto de navegación de mover objetos/accionar controles; incluir botones +/−, ratón, teclado y táctil sin secuestrar el scroll o zoom accesible de la página.
- Mantener la cámara separada del modelo: navegar no altera posiciones, dimensiones lógicas, simulación, firmware, JSON, autoguardado ni historial. Aplicar la transformación inversa al seleccionar/arrastrar, conservando cuadrícula y límites; respetar permisos y Guardar/Cancelar. El encuadre permanece durante ejecutar/pausar/pasos, sin seguimiento automático de objetos; ofrecer límites y recuperación explícita de la vista completa.
- Complementar el listado de conexiones con una imagen fiel de la Wemos D1 R32, pines/conectores etiquetados y resaltado por componente. Abrir/ampliar la guía bajo demanda, sin ocupar permanentemente el espacio de programación. Listado e imagen comparten los datos validados del proyecto, distinguen GPIO de etiqueta física y conservan advertencias eléctricas; no dibujar una conexión directa cuando se requiere resistencia, driver o alimentación externa. Usar un recurso propio o autorizado y contrastar el mapa con documentación de la placa, no con un pinout inventado.
- Eliminar comprobaciones de sesión disparadas exclusivamente por `focus`, `blur` o cambio de visibilidad. Propuesta inicial: chequeo periódico centralizado cada 60 segundos, discreto, sin desmontar el editor ni mostrar una pantalla de validación si sigue vigente; deduplicar solicitudes y temporizadores atrasados.
- Mantener expiración conocida, señales explícitas de cambio de cuenta/cierre y revocaciones. Cada operación remota conserva autorización en servidor; las guardas de acceso fresco a proyectos, descargas y grabación USB no se eliminan para reducir peticiones.
- En errores de red, conservar el trabajo y distinguir conexión perdida de contraseña incorrecta o sesión revocada. No introducir autenticación offline ni cambiar silenciosamente de cuenta.

Aceptación:

- Cambiar repetidamente de pestaña dentro del intervalo no produce peticiones de sesión por foco, pantalla intermedia, reinicio del simulador ni pérdida de selección/borradores.
- Comprobar vencimiento real, revocación, cuenta cambiada, temporizador vencido mientras la pestaña estaba suspendida y red lenta/cortada. No se duplican verificaciones ni se autoriza una operación con permisos retirados.
- Probar catálogo, arrastre, escenas, guardado manual/automático, recuperación y deshacer/rehacer con ratón y teclado en Chrome/Edge; escritorio de altura limitada, móvil y zoom.
- Probar navegación de escena ampliada y desplazada: seleccionar/mover sin saltos, controles simulados sin gestos ambiguos, revisión sin edición, ajuste al redimensionar y retorno a vista completa. Navegar no modifica el JSON ni crea operaciones de guardado/deshacer; ejecutar conserva el encuadre y el resultado lógico, sin perder borradores.
- Verificar que imagen y listado Wemos coinciden al cambiar conexiones, agregar/quitar componentes, importar y deshacer/rehacer. Pines, orientación y etiquetas deben corresponder a la placa documentada; conflictos y conexiones incompletas se identifican sin sugerir un montaje válido. La guía visual no sustituye la aceptación física pendiente de fase 10.

No incluye todavía progreso dentro de bloques, cambio de disposición de paralelo ni nuevas placas/componentes. Esos pedidos tienen su fase propia.

## Fase 13 — Acceso externo persistente a DEV · entregada

**Objetivo:** usar el entorno de desarrollo desde una red externa mediante una URL HTTPS estable, sin depender del túnel SSH de la PC y sin convertir DEV en producción.

La [guía específica](FASE_13_ACCESO_EXTERNO_DEV.md) registra topología, límites, operación, pruebas y reversión de la entrega verificada.

Alcance:

- Reutilizar la **VM Nginx existente dentro de Proxmox** como proxy inverso. Antes de modificarla, identificar inequívocamente la VM, obtener acceso autorizado, inspeccionar su configuración y respaldar sólo los archivos que se tocarán. No instalar ni configurar Nginx en el host Proxmox y no ejecutar comandos en el gateway, que continúa siendo exclusivamente un salto SSH.
- Publicar un nombre dedicado de DEV con HTTPS válido. El propietario elige el nombre y crea en GoDaddy el registro exacto que se le indique; las credenciales de GoDaddy nunca se comparten ni se guardan en Git. No crear registros comodín, AAAA sin IPv6 operativo ni nuevas reglas del router por suposición.
- Mantener aplicación y API bajo el mismo origen. Preparar en `capi-dev` un runtime estable y versionado, separado del servidor con HMR: arranque automático, reinicio controlado, healthcheck y logs acotados. Un navegador público no se conecta directamente a `vinext dev` ni a un puerto de administración.
- Exponer hacia la LAN sólo el origen interno indispensable y permitirlo únicamente desde la IP de la VM Nginx mediante firewall. PostgreSQL, Docker, compilador y SSH no se publican. El acceso por túnel localhost se conserva como vía administrativa y de recuperación.
- Configurar en Django una lista exacta de hosts/orígenes, cookies `Secure`, CSRF para el dominio y confianza limitada en las cabeceras del proxy. Preservar límites de login sin tratar a todos como la IP del proxy ni confiar en una IP enviada por el cliente. En Nginx, TLS, headers, límites y timeouts deben admitir guardado y descarga de firmware sin abrir CORS ni filtrar errores internos.
- Mantener DEV con datos ficticios. Acordar antes de publicar una barrera adicional de acceso en el proxy para el equipo de desarrollo —recomendada, con secreto fuera de Git— o documentar explícitamente la alternativa elegida; si se pretende dar acceso directo a docentes/alumnos, debe redefinirse el alcance porque DEV no reemplaza el piloto de producción.
- Documentar instalación, actualización, estado, logs, certificado/renovación, reinicio y rollback. Ningún secreto, IP privada sensible o configuración específica de otros sitios compartidos entra al repositorio.

Aceptación:

- Desde una conexión realmente externa, Chrome y Edge abren la URL HTTPS sin advertencias ni contenido mixto; logo, login/logout, sesión, guardado/autoguardado, importación/exportación, simulación, compilación y descarga funcionan bajo el mismo origen. Web Serial reconoce el contexto seguro, sin dar por cerrada la prueba física de fase 10.
- Reiniciar `capi-dev` recupera automáticamente el servicio y la URL vuelve a estar saludable sin iniciar una terminal. La configuración Nginx valida antes de recargar; la renovación del certificado tiene una prueba no destructiva. Reiniciar una VM compartida de Nginx requiere autorización específica, no es una prueba implícita.
- Sólo el proxy público acepta tráfico web externo. El origen DEV rechaza clientes distintos del proxy y no quedan expuestos PostgreSQL, Docker, compilador, SSH, endpoints de depuración ni listados de archivos.
- Se comprueba la protección de acceso acordada, los errores 401/403/404/429/5xx sin filtraciones, archivos grandes permitidos dentro de la cuota, desconexión/reconexión y persistencia tras actualización. El túnel localhost sigue funcionando como recuperación.
- Se registra dominio elegido, tipo de DNS sin credenciales, certificado, commit desplegado, servicios, pruebas externas, cambios exactos y rollback. Código/documentación se prueban, se hacen commit/push y se actualiza el contexto vivo de fase 11.

No incluye producción, datos reales de alumnos, cambios del router, host Proxmox o gateway, ni soporte de nuevas placas. El monitoreo básico del servicio pertenece a esta fase; backups externos, carga de aula, alertas operativas y piloto completo permanecen en la Fase final.

## Fase 14 — Ejecución visual y paralelo vertical

**Objetivo:** entender qué está pasando mirando el propio programa, sin que el lienzo se desplace solo.

**Entregada y verificada en DEV:** código funcional `897c6e0`, assets complementarios hasta la revisión desplegada `c681af2` y [guía de entrega](FASE_14_EJECUCION_VISUAL.md). Las pruebas externas específicas pasaron 4/4 en Chrome y Edge; la admisión y el planificador quedaron activos después del despliegue. Los criterios siguientes conservan el alcance acordado.

Alcance:

- Cambiar la presentación de «Al mismo tiempo» a la disposición vertical pedida, con hilos visualmente distinguibles. Al comenzar esta fase, fijar la orientación exacta con una propuesta visual para evitar interpretar de maneras distintas «vertical» y «en paralelo»; no cambiar su semántica fork/join.
- Mantener posición y escala del programa durante ejecutar, pausar y avanzar pasos. El resaltado no desplaza el lienzo; centrar un bloque, si se ofrece, es una acción manual.
- Mostrar en cada delay el tiempo restante con número y barra; en acciones que lo permitan, iteración/estado local. No inventar porcentajes para acciones sin duración conocida.
- Cada hilo muestra su propio avance. La cabecera conserva sólo estado global/controles y errores relevantes; la información pedagógica detallada se traslada a su bloque o dispositivo.
- El progreso es transitorio: no modifica el JSON, no dispara autoguardado, no crea pasos de deshacer ni se copia como parte de un favorito. Limpiar indicadores al detener, reiniciar o cambiar de proyecto.

Aceptación:

- Programas largos y varios caminos con delays distintos, bucles, condiciones y contadores compartidos: progreso legible sin saltos de scroll/zoom.
- Pausa, velocidad y modo guiado conservan el reloj lógico y las trazas de resultados. No hay progreso de un hilo atribuido a otro ni animaciones que sigan ejecutándose después de Stop.
- Compatibilidad al abrir proyectos existentes y deshacer/rehacer cambios de bloques; prueba visual de la disposición acordada y del contraste/movimiento reducido.

No incorpora seguimiento físico de bloques ni cambia la lógica del firmware para imitar una animación de la web.

## Fase 15 — TX/RX serial programable

**Objetivo:** que el programa pueda enviar mensajes y tomar decisiones según mensajes recibidos por un puerto serial configurable.

**Estado:** software implementado; aceptación física Wemos pendiente. Ver [contrato, protocolo y pruebas](FASE_15_MENSAJES.md).

Alcance:

- Componente **Mensajes**, con modos Enviar, Recibir o ambos, pines válidos para el perfil y velocidad inicial 9600 configurable sólo en la escena.
- Bloque de envío y bloque de recepción condicional con contenedores igual/distinto/no llegó. La comparación usa mensajes prearmados completos.
- Trama automática con cabecera, versión, tamaño, UTF-8, CRC-16 y cierre; máximo 120 bytes. Un paquete dañado se descarta y no ejecuta «distinto».
- Buffers y colas acotados, política visible para mensajes excesivos, cancelación al detener y tratamiento determinista cuando más de un hilo usa el mismo puerto.
- Simular recepción mediante botones creados desde una lista editable previa, sin texto libre durante la ejecución, y visualizar lo enviado. Generar el equivalente autónomo para Arduino y ESP-IDF, inicialmente en Wemos.
- Guardar/restaurar configuración y bloques con el proyecto; actualizar validación de servidor, exportación/importación, compilación y guía de conexiones. Reservar/rechazar puertos en conflicto con programación o consola según el perfil.
- Reflejar TX/RX y sus reasignaciones tanto en el listado como sobre la imagen de la placa de fase 12, con la misma validación de pines y conflictos.

Aceptación:

- Ejemplo de robot que recibe «AVANZAR» y ejemplo de semáforo que recibe una orden. Probar igualdad, diferencia, ausencia, timeout, fragmentación, varios mensajes juntos, texto largo y concurrencia.
- El resto de los bloques sigue avanzando mientras RX espera. Resultados del simulador y firmware concuerdan; ambas salidas compilan y se validan en una Wemos identificada con un emisor serial de prueba.
- Consola USB/monitor y UART del componente no se confunden. No se agrega envío de órdenes desde el monitor web de fase 10: esto es comunicación del programa autónomo, no control remoto de la placa desde el navegador.

## Fase 16 — ESP32-S3 DevKit y perfiles de placa

**Estado:** entregada en software el 19 de septiembre de 2026 para la unidad DIYmall ESP32-S3-DevKitC V1.0 N16R8 identificada físicamente. Falta grabación/ejecución física autorizada; ver [cierre y evidencia](FASE_16_ESP32_S3_DEVKIT.md). No extender esta identificación a otra DevKit S3.

**Objetivo:** elegir explícitamente el destino y completar para DevKit el recorrido proyecto → simulación → fuentes → compilación → USB.

Requisito antes de fijar el perfil: modelo y revisión exactos, módulo/memoria, conexiones USB y documentación del fabricante. No asumir que el nombre «ESP32-S3 DevKit» define una placa única ni elegir una compra por el usuario.

Alcance:

- Introducir identidad/capacidades de placa coherentes en proyecto, componentes, pines, generadores, cola, caché, manifiesto y grabador. Los proyectos existentes siguen siendo Wemos D1 R32; no se convierten automáticamente en S3.
- Selector de placa con confirmación y diagnóstico de conexiones incompatibles. Cambiar/cancelar/deshacer no pierde dispositivos ni reasigna pines a escondidas.
- Adaptar la guía visual de conexiones a una imagen técnica fiel de la DevKit exacta, con pines accesibles, orientación y etiquetas verificadas. Cambiar placa debe cambiar imagen y mapa conjuntamente; conservar el listado y no mostrar el pinout Wemos sobre una S3.
- Validar GPIO, entradas analógicas, PWM, servos, buzzers, pantallas existentes y UART según el perfil confirmado. Mostrar limitaciones antes de compilar, no después de cablear.
- Compilar Arduino y ESP-IDF para el destino correcto, con herramientas fijadas. Comprobar espacio y memoria de DEV antes de extender la imagen; conservar cola, cupos, aislamiento y privacidad, sin aumentar recursos por suposición.
- En USB, detectar el chip y distinguir el mecanismo de conexión de la placa real; gestionar reinicio/reselección si corresponde. Direcciones de grabación y tamaño salen de metadatos de compilación validados para ese perfil, no de copiar el mapa Wemos.

Aceptación:

- Un mismo ejemplo se prueba en Wemos y DevKit con conexiones válidas para cada una; ambas herramientas generan/compilan y los proyectos anteriores siguen abriendo.
- Listado e imagen de conexiones concuerdan con el perfil físico y siguen sincronizados al cambiar/cancelar/deshacer la selección de placa o modificar pines; el recurso gráfico tiene procedencia y permiso de uso documentados.
- Un firmware de otra placa, memoria desconocida o rango inválido se rechaza. Guardar/cachear una compilación nunca mezcla destinos, cuentas o credenciales.
- Grabación y ejecución autónoma verificadas en la DevKit concreta, incluidas consola, PWM y un caso TX/RX. Registrar por separado pruebas de software y de hardware; no cerrar soporte físico sólo con mocks.

## Fase 17 — Waveshare ESP32-S3 de 5 pulgadas

**Objetivo:** incorporar el perfil real de la Waveshare, su pantalla y las entradas disponibles antes de construir una aplicación gráfica interactiva.

Unidad identificada: **Waveshare ESP32-S3-Touch-LCD-5, SKU 28117**, ESP32-S3-WROOM-1-N16R8, display RGB de 5 pulgadas y táctil capacitivo GT911 por I2C. La inspección física sin escritura confirmó ESP32-S3 rev. 0.2, flash Quad 16 MiB y PSRAM 8 MiB; coincide con la [documentación oficial](https://docs.waveshare.com/ESP32-S3-Touch-LCD-5). Antes de implementar todavía hay que fijar la resolución de la unidad —el producto admite 800 × 480 o 1024 × 600— y contrastar revisión, serigrafía y esquema. No asignar un controlador ILI: es un panel RGB paralelo.

Alcance:

- Extender perfiles de fase 16 con los recursos y pines reservados de esta placa; rechazar conexiones incompatibles y revisar consumo de memoria.
- Incorporar la imagen de la Waveshare ESP32-S3 de 5 pulgadas exacta en la guía de conexiones, además del listado. Señalar conectores/pines realmente disponibles y los reservados, con la cara/orientación necesaria para localizarlos; validar contra documentación del modelo/revisión y registrar procedencia/permiso del recurso gráfico. No representar un GPIO interno como conector accesible ni reutilizar el mapa de DevKit.
- Inicialización y refresco no bloqueante de su pantalla para Arduino y ESP-IDF. Integrar los mensajes y zonas de texto existentes; conservar **una sola pantalla por proyecto**.
- Si la unidad tiene táctil, incorporar lectura, orientación/coordenadas y una prueba local de entrada. Esto valida el dispositivo de entrada, no agrega aún controles de actuadores ni un diseñador de escenas gráficas.
- Ejemplos mínimos de mensajes/zonas y entrada, simulación acorde al perfil, JSON portable, fuentes, compilación privada y grabación USB específica.

Aceptación:

- La unidad real muestra texto/zonas correctamente, conserva orientación y registra entradas si tiene táctil. El refresco y entradas no detienen delays, UART o PWM.
- Presupuesto medido de memoria/tiempo, errores comprensibles y validación de pines ocupados; ambas herramientas y USB probados sin romper Wemos/DevKit ni las pantallas anteriores.
- Contrastar imagen, listado y unidad física de Waveshare: las marcas identifican el conector correcto para cada componente y se actualizan ante cambios de proyecto, sin ocultar conflictos con pantalla/táctil u otros recursos reservados.

La escena gráfica y la interacción con dispositivos se entregan en fase 18. Esta fase entrega soporte de placa/pantalla, no promete un tablero interactivo antes de implementarlo.

## Fase 18 — Escena y controles locales en pantalla

**Objetivo:** representar la escena en una pantalla gráfica y permitir accionar sus dispositivos desde controles locales del display.

Alcance:

- Vista gráfica adaptada a la resolución: posiciones, nombres/representaciones y estados de los componentes. No ejecutar el editor web dentro del ESP32 ni prometer una copia pixel a pixel del navegador; el display no se dibuja recursivamente a sí mismo.
- Configurar controles de los dispositivos existentes: acciones y velocidad/potencia según corresponda, mensajes y zonas de texto integradas. Mantener una pantalla por proyecto y una edición con Guardar/Cancelar, deshacer/rehacer e importación/exportación.
- Simular la misma interacción en la web. En hardware, los controles son locales a la placa/pantalla con una entrada compatible, no órdenes desde el navegador por Wi-Fi/USB.
- Resolver explícitamente quién controla un actuador cuando hay bloques y controles manuales: proponer un modo manual por dispositivo, con prioridad y transición de vuelta al programa visibles y deterministas. No permitir que dos escritores se pisen sin explicación.
- Usar una representación compartida de escena/controles para simulador y generadores Arduino/ESP-IDF, con límites de elementos, memoria y refresco medidos. Los perfiles sin entrada táctil no ofrecen controles físicos inoperables; las LCD de texto mantienen sus mensajes, no una escena gráfica.

Aceptación:

- Escena de dos semáforos y escena de semáforo con robot, mensajes y controles de potencia. Probar interacción manual/programada, cambio de modo, guardar/cancelar/recargar y diferencias de tamaño de pantalla.
- Equivalencia lógica entre simulación y firmware; capacidad gráfica declarada por perfil, compilación en ambos frameworks y ensayo físico en la Waveshare identificada. No extender automáticamente esa certificación a otro display sin probar su adaptación.
- Arranque y salida de modo manual seguros para el montaje verificado; no presentar el control gráfico como paro de emergencia ni confundir cerrar la pestaña con detener la placa.

## Fase 19 — Desafíos progresivos

**Objetivo:** ofrecer un recorrido de retos atractivos y cada vez más complejos para aprender a usar CapiBloques y desarrollar conceptos de programación mediante la práctica.

**Plan ampliado:** [FASE_19_HERRAMIENTAS_PEDAGOGICAS.md](FASE_19_HERRAMIENTAS_PEDAGOGICAS.md) es la fuente detallada e incorpora las dos revisiones de Pilas Bloques —incluidos la versión 3.0.2, su creador y recursos docentes—, el bloque `según`, paletas por desafío, programas iniciales con intención pedagógica, variantes/semillas, expectativas funcionales y conceptuales, depuración, autoría docente, pistas, accesibilidad, modelo de datos, progreso y pruebas. No autoriza copiar contenidos ajenos.

Alcance:

- Crear una sección de desafíos con niveles o tramos visibles, objetivos concretos, dificultad creciente y un catálogo inicial suficiente para recorrer desde una secuencia simple hasta bucles, condiciones, sensores, contadores, concurrencia, mensajes y pantallas. Los primeros tramos deben poder completarse enteramente en el simulador.
- Cada desafío parte de una escena y, cuando ayude, de un proyecto inicial copiado a la biblioteca personal. Abrir, reiniciar o volver a intentar nunca sobrescribe el enunciado ni otro proyecto del alumno.
- Validar el comportamiento observable, admitiendo soluciones distintas. Usar varios escenarios o entradas para condiciones y sensores; no aprobar sólo porque coincide la forma de los bloques o una salida fija casual.
- Incorporar pistas graduales, explicación del concepto practicado y devolución comprensible sobre qué condición falta. La solución completa no se muestra antes de completar el reto salvo una decisión explícita de diseño educativo.
- Guardar avance por cuenta, versión del desafío e intentos necesarios para retomar, con privacidad y permisos consistentes con cursos y proyectos. No agregar rankings públicos ni exponer resultados de otros alumnos.
- Versionar el catálogo y sus validadores. Una corrección futura no borra un logro anterior sin explicación; proyectos creados desde una versión vieja siguen siendo proyectos portables normales.
- Integrar accesibilidad por teclado, texto ampliado, móvil, modo sin movimiento innecesario y recuperación ante desconexión. Diferenciar claramente reto completado, progreso sólo local, sesión vencida y fallo del validador.

Aceptación:

- Un alumno puede descubrir la sección, elegir un desafío adecuado, crear su copia, guardar/salir/retomar, simular, pedir pistas y validar sin perder el proyecto. Completar uno habilita o recomienda el siguiente de forma comprensible, sin encerrar al alumno si el docente elige otro orden.
- El catálogo inicial cubre dificultad creciente y tiene pruebas para la solución esperada, alternativas válidas y respuestas incorrectas cercanas. Condiciones, bucles y paralelo se prueban con entradas distintas; detener o reiniciar no produce un logro falso.
- Progreso aislado por cuenta, reintentos idempotentes, revocación y cambio de cuenta; docentes y administradores sólo ven lo permitido por una regla definida, no por su rol global por sí solo.
- Chrome y Edge, teclado, móvil y texto ampliado permiten recorrer el flujo. Los desafíos sin hardware funcionan en DEV; los que exijan una placa identifican ese requisito y nunca confunden compilación con validación física.

No incluye una competencia pública, chat o tutor de IA, creación libre de desafíos por cualquier usuario ni soporte de hardware que no haya sido entregado y validado en su fase correspondiente. La cantidad exacta y los contenidos del catálogo inicial se fijan al autorizar la fase.

## Fase 20 — Compilación y grabación guiadas, medibles y comprensibles

**Objetivo:** convertir el recorrido ya seguro de guardar, compilar y grabar en un asistente secuencial para chicos, alimentado por estados reales y mediciones del compilador.

La fase también debe reducir al mínimo razonable la latencia: comparar workers calientes, cachés por receta/placa/toolchain, compilación incremental y componentes precompilados. Toda reutilización conserva aislamiento, reproducibilidad y exclusión de credenciales Wi-Fi; se elige por p50/p95 y consumo bajo concurrencia, no por intuición.

Alcance:

- Documentar y medir con fixtures sintéticos validación, cola, reserva, preparación, generación, compilación, enlace, empaquetado y publicación; registrar espera, duración, CPU, RAM y disco en frío/caliente.
- Exponer estados verificables, tiempo transcurrido y última actividad. Posición o tiempo restante sólo se muestran cuando pueden calcularse honestamente; no inventar porcentajes.
- Crear un asistente grande «Paso N de M» que integre Guardar, revisión de cableado, opciones/Wi-Fi privado, cola, resultado, conexión USB, confirmaciones, grabación y resultado final, sin duplicar operaciones ni quitar permisos, cuotas, consentimiento o idempotencia.
- Dar jerarquía al proyecto todavía local o con cambios, permitir Guardar desde el flujo y reanudarlo después de ACK/conflicto.
- Investigar y validar con la Wemos real el reinicio posterior a la grabación y la capacidad DTR/RTS. Si no es confiable, conservar una instrucción física clara; no presentar compilación o transferencia como ejecución observada.
- Agregar una vista administrativa de etapas, tiempos y fallos agregados, sin abrir fuentes, proyectos, credenciales o logs crudos.

Aceptación:

- Doble clic, recarga, desconexión, ACK perdido, cancelación, lease vencido y reinicio del planificador no duplican trabajos ni liberan cupo antes de terminar el ejecutor.
- Un alumno completa el recorrido con teclado, táctil, lector de pantalla y texto ampliado, pudiendo cancelar o retomar sin perder el proyecto.
- Toda mejora de rendimiento se compara con línea base y conserva techo, aislamiento sin red, privacidad y concurrencia configurada. Para cerrar la grabación y reinicio se requiere la aceptación física de fase 10.

## Fase 21 — Claridad y ergonomía educativa del editor

**Objetivo:** resolver en una entrega comprobable las observaciones de comprensión y manipulación del editor que quedaron fuera del alcance original de fases 12 y 14.

Incluye evaluar una vista accesible del estado lógico simulado de los pines sobre el diagrama de la placa: 0/1, color del componente, intensidad PWM y nivel analógico, siempre rotulado como simulación y nunca como medición eléctrica.

Alcance:

- Reproducir y evitar superposición accidental de bloques sin alterar conexiones, coordenadas portables, Deshacer ni un encastre en curso.
- Hacer reconocible la edición del nombre; traducir colores en ejecución; mejorar advertencias de cableado cerrables; ampliar acciones del selector de avatar; escribir «segundos»; evaluar el pin `📌`; saludo con privacidad; y distinguir bloques desconectados sin depender sólo del color.
- Distinguir menús desplegables de campos numéricos, expresar operadores con palabras cuando mejore comprensión y revisar tamaño/contraste de emojis con alternativas accesibles.
- Hacer que Auto-conectar y el movimiento de componentes tengan una vista previa coherente dentro del borrador de escena, manteniendo Guardar/Cancelar, historial y autoguardado separados.
- Auditar nuevamente encabezados y acciones con el público infantil objetivo, pantallas pequeñas, texto ampliado y teclado. Una simplificación nueva se mide; no elimina estados ni controles críticos.

Aceptación:

- Cada observación se reproduce primero o se descarta con evidencia. Los cambios pasan Chrome/Edge, móvil, teclado, zoom y movimiento reducido.
- Importar, arrastrar, deshacer/rehacer, Guardar/Cancelar y recuperación no cambian silenciosamente el modelo ni pierden trabajo.
- Una revisión breve con usuarios representativos o, mientras no estén disponibles, pruebas moderadas documentadas distingue preferencias de problemas reales; no se declaran resultados infantiles inventados.

## Fase 22 — Avatar acompañante y reacciones accesibles

**Objetivo:** convertir el avatar elegido en acompañante visual breve y no invasivo ante desafíos, compilación y grabación.

Alcance:

- Reacciones diferenciadas para éxito, fallo recuperable, placa ausente y error de compilación/grabación; nunca avergonzar al alumno ni confundir etapas.
- Reproducir una sola reacción por resultado idempotente, con texto accesible, opción de omitir, sin audio automático y equivalente estático con movimiento reducido.
- Resolver el avatar desde la cuenta activa y limpiar estado ante cambio/revocación. No guardar reacciones en proyecto, historial o firmware.
- Reutilizar los conceptos 2D detallados/simples y preparar piezas coherentes para una futura adaptación, sin afirmar que son STL o modelos 3D listos.

Aceptación:

- Desafío, compilación y grabación disparan exactamente la reacción correspondiente; reintentos o refrescos no repiten celebraciones indebidamente.
- Teclado, lector de pantalla, foco, contraste y movimiento reducido mantienen el resultado comprensible aunque la animación esté desactivada.

## Fase 23 — Displays físicos y matriz MAX7219

**Objetivo:** cerrar la validación de los perfiles de pantalla existentes e incorporar la matriz LED 32 × 8 solicitada como componente completo.

**Estado:** el [componente Matriz LED](FASE_23_MATRIZ_LED.md) está implementado en software con una unidad 32 × 8, simulación y ambos generadores. Pantalla de texto también permite animaciones, figuras predeterminadas y dibujos infantiles en OLED/TFT. La fase no está cerrada: faltan el ensayo eléctrico de la matriz y la aceptación física de LCD/OLED/TFT.

Alcance:

- Identificar y probar físicamente LCD PCF8574 16×2/20×4 —incluido el Winstar/2004A y su mochila—, OLED SSD1306 128×64 y unidades TFT ILI9341/ILI9488 concretas; documentar dirección, mapeo, tensión, controlador y límites sin crear perfiles duplicados.
- Agregar la matriz de cuatro MAX7219 encadenados: cantidad, orden, orientación, brillo, píxel, fila/columna, iconos/patrones y texto desplazable dentro de límites definidos.
- Integrar escena, simulador, JSON, bloques, cableado, Arduino y ESP-IDF con refresco cooperativo y buffers acotados.
- Mantener la ampliación educativa de displays: texto animado en todos los perfiles y, en los gráficos, figuras predeterminadas o hasta 12 dibujos de 16 × 8 creados por el alumno. Velocidad en la escena; efecto en el bloque; sin edición libre durante la ejecución.
- Documentar alimentación, masa, corriente, desacoplo y nivel lógico; no alimentar la matriz desde GPIO ni confundirla con I2C/RGB.

Aceptación:

- Los perfiles existentes muestran y limpian texto en el hardware identificado con ambos frameworks; una dirección/controlador equivocado produce diagnóstico comprensible y no bloquea indefinidamente.
- La matriz física confirma orden/orientación, brillo y patrones/texto, sin detener delays, UART, sensores o PWM. La cantidad máxima encadenable se fija por medición, no por suposición.

## Fase 24 — Panel web local para celular

**Objetivo:** permitir que un único celular emparejado observe la escena y aporte entradas programables al ESP32 dentro de la misma LAN.

Alcance:

- Separar «Red Wi-Fi de la placa» del nuevo «Panel web para celular». Sin nube, Internet, punto de acceso propio ni editor React alojado en la placa.
- Dos vistas: Escena de sólo lectura y Controles generados únicamente a partir de inputs/outputs virtuales relacionados por bloques.
- Botón, interruptor, deslizador, joystick, número y texto; indicadores y mensajes. Ningún actuador obtiene control directo fuera del programa.
- Emparejamiento temporal/revocable, exclusión de segundo cliente, identidad/orden por ejecución, QR/IP, límites de frecuencia/tamaño y backpressure.
- Definir estados seguros y política de desconexión; proyectos con panel esperan «Ejecutar» desde el celular, los demás conservan arranque autónomo.
- Contrato equivalente en simulación, Arduino y ESP-IDF, medido en RAM, flash y latencia.

Aceptación:

- Robot, semáforo, texto y brillo funcionan mediante bloques con conexión tardía, reconexión, eventos rápidos, dos clientes y pérdida de Wi-Fi.
- El celular no puede editar proyecto/escena ni agregar controles/código en ejecución. Desconexión libera controles momentáneos y aplica la política segura documentada.

## Fase 25 — Compartir proyectos por enlace y QR

**Objetivo:** compartir una copia o vista autorizada de un proyecto sin convertir su UUID en permiso ni publicar trabajos infantiles por defecto.

Alcance:

- Definir quién puede crear enlaces, para qué revisión, con modo vista/copia, caducidad, revocación y límite de usos; cursos y proyectos personales conservan permisos diferentes.
- QR representa el mismo enlace autorizado, no contiene proyecto, sesión ni credenciales. Abrir como copia crea identidad propia y nunca edita el original.
- Evitar indexación, enumeración, filtración de metadatos y reutilización después de revocar; registrar eventos mínimos sin exponer contenido.

Aceptación:

- Enlace válido, vencido, revocado, reutilizado y abierto por otra cuenta producen resultados coherentes; perder membresía revoca lo que corresponda.
- Compartir/exportar explica que una copia descargada no puede revocarse. No aparecen proyectos privados en listados públicos.

## Fase 26 — Acceso de aula sin contraseña y asistencia

**Objetivo:** ofrecer ingreso rápido supervisado para alumnos en clase sin debilitar las cuentas normales ni permitir suplantación silenciosa.

Alcance:

- Rediseñar el ingreso para que el logo y el nombre de la institución sean el centro visual antes del formulario; CapiBloques queda como identidad de producto secundaria y el estado sin logo conserva una composición deliberada.
- Diseñar una sesión de aula creada por docente autorizado, acotada a curso, duración y dispositivo, con revocación inmediata y alternativa de alias/contraseña.
- Definir selección/confirmación de identidad en equipos compartidos, prevención de reutilización y límites de intentos. Un código común no debe permitir elegir cualquier alumno sin control adicional.
- Registrar asistencia como evento explícito y revisable, diferenciando ingreso técnico de presencia confirmada; definir visibilidad, correcciones y retención.
- Conservar UUID, propiedad, borradores por cuenta, cierre seguro y autorización fresca. No crear cuentas automáticamente ni almacenar contraseñas recuperables.

Aceptación:

- Logo ausente/presente, nombre corto/largo, móvil, texto ampliado, teclado, lector de pantalla, carga y error de autenticación conservan la identidad institucional claramente visible y el formulario utilizable.
- Curso incorrecto, sesión vencida/revocada, segundo dispositivo, cambio de alumno y equipo compartido no exponen proyectos ni atribuyen trabajo a otra persona.
- Docente sólo opera sus cursos; administrador conserva gestión global sin convertirse en docente implícito. Se prueban revocación, auditoría, privacidad y recuperación.

## Fase 27 — Familia de robots HP Robots | Otto

**Estado: software genérico entregado; aceptación física pendiente.** Hay cinco configuraciones progresivas: bípedo, sonido, explorador, expresivo y humanoide expresivo. Incluyen seis servos como máximo, buzzer, ultrasonido, MAX7219, 17 movimientos, brazos, sonidos, expresiones y distancia como dato. Ninja y Wheels siguen pendientes como variantes específicas. Contrato y límites en [FASE_27_OTTO.md](FASE_27_OTTO.md).

**Objetivo:** programar configuraciones Otto desde el mismo editor de CapiBloques, con acciones infantiles de alto nivel y acceso didáctico opcional a sus piezas.

Alcance:

- Inventariar los modelos físicos disponibles y construir una matriz verificable de controlador, servos, buzzer, ultrasonido, matriz/ojos, botones, comunicación y alimentación.
- Modelar cada Otto como un componente compuesto con perfil explícito; no duplicar pines ni permitir una combinación que no existe físicamente.
- Incorporar movimientos, giros, bailes, sonidos, expresiones, lectura de distancia y detención mediante un planificador cooperativo, cancelable y compatible con `Al mismo tiempo`.
- Separar calibración mecánica —centro, inversión y límites por servo— de los bloques infantiles. Ofrecer una vista educativa para revelar los componentes sin exigir que el alumno coordine cada articulación desde el comienzo.
- Mantener simulación, JSON, deshacer/rehacer, Arduino y ESP-IDF con la misma semántica. Un controlador Otto que no sea ESP32 queda fuera hasta decidir y validar expresamente ese target.

Aceptación:

- Cada variante identificada sólo ofrece capacidades presentes y rechaza perfiles/pines incompatibles de manera comprensible.
- Caminar, girar, detener, bailar y reaccionar a distancia no bloquean otros caminos; detener/reiniciar deja los servos en el estado seguro acordado.
- La postura simulada, el código generado y el robot físico coinciden en dirección, velocidad relativa, calibración y duración dentro de tolerancias documentadas.
- Proyectos sin Otto y componentes individuales conservan JSON, simulación y código previos.

## Fase 28 — Barrera infrarroja digital

**Estado: implementada en software el 20 de septiembre de 2026; aceptación física pendiente.** Ver [FASE_28_BARRERA_INFRARROJA.md](FASE_28_BARRERA_INFRARROJA.md).

**Objetivo:** incorporar una barrera infrarroja como sensor binario comprensible, simulable y portable a Arduino y ESP-IDF.

Alcance:

- Un componente de escena con nombre editable, GPIO de entrada y polaridad configurable, presentado como «libre / interrumpida» y no como valor analógico.
- Una condición encastrable en cualquier bloque condicional para consultar ambos estados, sin esperas bloqueantes ni un flujo propio obligatorio.
- Control explícito en la simulación, representación visual del haz y estado accesible sin depender sólo del color.
- Validación de pines, cableado, JSON compatible y generación equivalente para Arduino y ESP-IDF.

Aceptación:

- Un proyecto puede simular una pieza que cruza y libera la barrera, exportarse/importarse y producir el mismo resultado lógico con ambas polaridades.
- Las dos salidas compilan para los perfiles de placa autorizados. El modelo físico disponible se identifica y ensaya antes de afirmar compatibilidad eléctrica.

## Fase 29 — Datos, variables y textos dinámicos

**Estado: implementada en software el 20 de septiembre de 2026.** Ver [FASE_29_VARIABLES.md](FASE_29_VARIABLES.md).

**Objetivo:** ofrecer un modelo único y comprensible para guardar, transformar, comparar y comunicar datos del programa y sus componentes.

Alcance:

- Variables de proyecto tipadas como número, texto o sí/no, con nombre, valor inicial, asignación, lectura y cambio numérico.
- Bloques de valor para datos de componentes autorizados —por ejemplo contador, sensores, botones, conexión, mensajes y posición— sin duplicar una acción por cada destino.
- Un bloque «armar texto» con fragmentos fijos y valores dinámicos, reutilizable por consola, Pantalla de texto, Mensajes y futuros destinos textuales.
- Reglas claras para nombres, alcance entre caminos de `Al mismo tiempo`, conversiones explícitas, límites de texto/memoria y comportamiento al reiniciar.
- JSON compatible, inspector de valores en simulación, progreso local, deshacer/rehacer y generación equivalente para Arduino y ESP-IDF.

Aceptación:

- Se puede construir «El contador está en [contador]», mostrarlo y enviarlo sin bloques especiales para el contador; el mismo mecanismo acepta al menos un sensor y un mensaje recibido.
- Tipos incompatibles, nombres repetidos y valores fuera de límites producen una explicación infantil antes de simular o generar código.
- Caminos paralelos y reinicios tienen semántica determinista documentada; proyectos anteriores mantienen su contador y comportamiento.

## Fase 30 — Temporizadores y eventos cooperativos

**Estado: implementada en software el 24 de septiembre de 2026; despliegue DEV y aceptación física pendientes.** Ver [contrato, semántica y evidencia](FASE_30_TEMPORIZADORES.md).

**Objetivo:** medir tiempo y reaccionar a vencimientos sin bloquear el programa.

Alcance:

- Temporizadores con nombre y acciones iniciar, reiniciar, pausar, continuar y detener.
- Valores transcurrido/restante utilizables en expresiones y comparadores, con unidades visibles y conversiones explícitas.
- Eventos de una vez o repetitivos ejecutados por el planificador cooperativo; no son interrupciones libres ni cadenas de `delay()`.
- Orden determinista de vencimientos simultáneos, reinicio y acceso desde `Al mismo tiempo`; reloj monotónico resistente al rollover.
- Simulación, progreso local en el bloque/componente, JSON y semántica equivalente Arduino/ESP-IDF.

Aceptación:

- Un proyecto mantiene dos temporizadores mientras sensores, mensajes y animaciones continúan respondiendo.
- Comparar un temporizador y reaccionar a su evento producen el mismo orden observable en simulación y hardware.
- Pausa, reinicio, repetición y vencimientos simultáneos no duplican ni pierden eventos.

La prueba física de esos criterios queda abierta; las pruebas locales cubren simulador, JSON, generación nativa y reglas del intérprete.

## Fase 31 — Procedimientos y funciones

**Objetivo:** reutilizar comportamiento visual sin copiar cadenas de bloques.

Alcance:

- Procedimientos para acciones y funciones para obtener valores número, texto o sí/no.
- Parámetros tipados, nombres infantiles, variables locales y llamadas visualmente rastreables durante la ejecución.
- Prohibir recursión y ciclos de llamadas en la primera versión; límites estáticos adecuados para ESP32.
- Definiciones y llamadas en JSON, historial, copiar/pegar, deshacer/rehacer, simulación y ambos generadores.

Aceptación:

- Una tarea con parámetros puede llamarse desde dos caminos y una función puede alimentar un comparador o `armar texto`.
- Tipos erróneos, parámetros faltantes, nombres repetidos y ciclos se explican antes de ejecutar o generar código.
- El resaltado permite entrar y volver de una llamada sin perder la ubicación del programa principal.

## Fase 32 — Estados y valores consultables de componentes

**Objetivo:** usar en condiciones y expresiones los datos relevantes de sensores, actuadores y servicios mediante un contrato común.

Alcance:

- Registro tipado de capacidades por perfil e instancia; cada componente publica sólo estados/valores que realmente tienen sentido.
- Valores medidos para entradas y estados lógicos ordenados para actuadores, diferenciados en texto, ayuda y código.
- Estados enumerados como semáforo rojo/amarillo/verde/apagado, además de números, texto y sí/no.
- Selectores que se actualizan al agregar, renombrar, cambiar perfil o borrar un componente, sin referencias huérfanas silenciosas.
- Semántica determinista entre caminos paralelos, simulación, inspector, JSON y Arduino/ESP-IDF.

Aceptación:

- Una condición puede consultar el estado de un semáforo y un texto puede combinar una lectura de sensor con la potencia ordenada a un motor.
- La interfaz nunca presenta una orden de software como medición física; perfiles sin realimentación lo explican claramente.
- Importar, renombrar o eliminar componentes conserva o repara referencias de forma explícita y reversible.

## Fase 33 — Wi-Fi AP/cliente y mensajes entre placas

**Objetivo:** comunicar varias placas sin router mediante una placa que crea la red y clientes que se conectan, usando mensajes seguros y comprensibles.

Alcance:

- Roles infantiles «Crear una red» y «Conectarse a una red», con límites de clientes medidos y configuración fuera de los bloques.
- Mensajes de texto predefinidos, identidad de placa y recepción reutilizable en condiciones/eventos; no control remoto implícito.
- Protocolo versionado con longitud, integridad, identificador, orden/deduplicación, timeout, reconexión y backpressure acotada.
- Credenciales excluidas de JSON, historial, Git y logs; compilación privada según el contrato vigente.
- Red virtual en simulación y generación equivalente Arduino/ESP-IDF, seguida de ensayo físico con al menos un AP y dos clientes.

Aceptación:

- Un cliente se desconecta y reconecta sin congelar el programa ni repetir una acción confirmada.
- El AP distingue clientes, rechaza tramas inválidas y ejecuta caminos distintos por mensaje y timeout.
- Simulación y tres placas físicas conservan orden, límites y recuperación documentados antes de declarar soporte.

## Fase 34 — Servicios y control remoto entre placas

**Objetivo:** permitir que una placa solicite operaciones explícitamente publicadas por otra, apoyándose en la mensajería ya validada.

Alcance:

- Servicios con nombre y comandos tipados autorizados por el autor del proyecto; sin escritura GPIO arbitraria.
- Descubrimiento, identidad, permiso, confirmación, idempotencia, límites de frecuencia y estados de error.
- Consulta de capacidades/estados de fase 32 y solicitudes de cambio cuya decisión final pertenece al programa receptor.
- Simulación multiplaca, auditoría comprensible y equivalencia Arduino/ESP-IDF.

Aceptación:

- Un proyecto receptor puede autorizar cambiar su semáforo y rechazar una operación no publicada o de una placa no admitida.
- Pérdida de red, reintentos y comandos duplicados no dejan estados ambiguos ni ejecutan dos veces una acción confirmada.
- La fase puede postergarse sin impedir la mensajería de fase 33: los mismos casos siguen resolviéndose con mensajes y lógica local.

## Fase 35 — Luces RGB inteligentes WS281x/SK6812

**Objetivo:** controlar tiras, aros, barras y matrices RGB direccionables desde un mismo componente, con simulación fiel y animaciones no bloqueantes.

Alcance:

- Un componente **Luces RGB inteligentes** con geometrías tira/cadena, aro/barra/figura y matriz; cantidad libre dentro de límites medidos.
- Primera compatibilidad WS2812B/WS2812 y SK6812 RGB a 800 kHz. WS2811 y RGBW requieren perfiles declarados para no confundir tensión, agrupación ni canales.
- Configuración de GPIO, cantidad, orden de color, brillo máximo y mapeo. Matrices: ancho/alto, esquina inicial, filas/columnas y progresivo/zigzag.
- Acciones sobre conjunto, píxel, tramo y coordenada; colores, degradados, dibujos y animaciones predefinidas cooperativas/cancelables.
- Simulación, JSON, deshacer/rehacer y generación equivalente Arduino/ESP-IDF mediante backend temporizado soportado.
- Estimación visible de corriente y guía de DIN/DOUT, masa común y alimentación externa. No presentar una estimación como medición ni alimentar matrices grandes desde la placa.
- Medir memoria, frecuencia de refresco, latencia y coexistencia con Wi‑Fi, audio, PWM y otros usuarios de RMT/SPI en Wemos D1 R32 y ESP32‑S3 antes de fijar máximos.

Aceptación:

- Una tira, un aro y matrices progresiva/zigzag conservan índice/coordenada, orientación y color entre simulación y hardware.
- Arcoíris, persecución, pulso, degradado y texto/dibujo matricial continúan mientras sensores y otros caminos responden; iniciar otra salida o detener cancela limpiamente.
- Arduino y ESP-IDF producen la misma imagen y orden RGB/GRB para cada perfil probado, sin conflictos silenciosos de periféricos.
- Límites por placa y advertencias de alimentación se basan en mediciones y perfiles, no en una cifra universal inventada.

## Fase 36 — Firmware intérprete y ejecución directa en placa

**Estado:** terminada en software el 24 de septiembre de 2026; despliegue en DEV y aceptación física pendientes. ABI/reglas, protocolo, selector de destino, actualización Web Serial, almacenamiento atómico, runtime Wemos/S3, telemetría, Wi-Fi privado y los controladores actuales están implementados. Ambos intérpretes compilan y se empaquetan con ESP-IDF 5.5.5; el firmware declara capacidades y la web bloquea cualquier proyecto no cubierto.

**Objetivo:** convertir la compilación nativa en una alternativa y no en el recorrido cotidiano: instalar desde la web un firmware CapiBloques precompilado por placa y enviar luego reglas locales compactas para ejecutar en segundos.

Alcance resumido:

- Artefactos precompilados/versionados para cada perfil físico, servidos como archivos estáticos sin ocupar la cola de compilación por proyecto.
- Chequeo obligatorio de versión/ABI/capacidades antes de generar o cargar reglas; firmware viejo bloquea la operación y sólo ofrece actualizar o cancelar.
- ABI de reglas con componentes, pines, programa, recursos y tabla de depuración; sin C/C++ nativo, identidad remota ni secretos portables.
- Intérprete, planificador cooperativo, controladores nativos, reservas de recursos, almacenamiento atómico y recuperación en la placa.
- Selector **Simulador / Placa conectada**, instalación/actualización visible del firmware, transferencia directa y reutilización por hash.
- Telemetría real para bloques, caminos, variables, tiempos, componentes y errores, sin detener la ejecución al desconectar la web.
- Convivencia completa con Arduino, ESP-IDF y exportación de fuentes nativos.

El diseño completo, orden interno, protocolo, seguridad, versionado, validación y criterios están en [FASE_36_FIRMWARE_INTERPRETE.md](FASE_36_FIRMWARE_INTERPRETE.md). Ese documento es la fuente de alcance; esta sección no lo reemplaza.

## Fase 37 — Ayuda infantil de componentes

**Objetivo:** que cada componente/perfil pueda comprenderse, simularse y conectarse mediante una ayuda contextual apropiada para chicos de 8 a 12 años.

Alcance resumido:

- Qué es, para qué sirve, cómo funciona, qué valores/estados ofrece y qué bloques habilita.
- Piezas necesarias, alimentación/cuidados y guía de conexión sobre la placa/pines actuales.
- Fotografía exacta con procedencia o imagen explícitamente ilustrativa; variantes claramente separadas.
- Primer programa, prueba en simulador, problemas frecuentes, límites y compatibilidad verificada.
- Acceso desde catálogo, escena, cableado, bloques y errores; contenido en capas infantil/docente.
- Modelo versionado, activos locales/licenciados, accesibilidad y verificación automática de cobertura.

El contrato completo está en [FASE_37_AYUDA_COMPONENTES.md](FASE_37_AYUDA_COMPONENTES.md).

## Fase 38 — Entradas y control cotidiano

**Objetivo:** incorporar los componentes de mayor retorno para interacción, eventos, distancia y control de cargas didácticas.

Incluye Sensor de distancia —HC-SR04/VL53L0X—, Detector de movimiento PIR, Palanca de control, Encender aparato mediante MOSFET/relé de baja tensión y Perilla infinita. Debe completar escena, simulación, valores/eventos, ambos generadores, firmware intérprete, ayuda y aceptación física por perfil. Se prohíbe el uso guiado de relés con tensión de red.

## Fase 39 — Ambiente y medición

**Objetivo:** trabajar con magnitudes ambientales y analógicas calibrables mediante contratos y unidades comprensibles.

Incluye Sensor ambiental BME280, Humedad de tierra capacitiva, Sensor de color, Nivel de sonido sin capturar audio y Detector de agua/lluvia. Debe distinguir medida, estimación, umbral y estado derivado, y no presentar estos módulos como dispositivos de seguridad.

## Fase 40 — Movimiento e identificación

**Objetivo:** incorporar orientación, identificación de objetos y entrada matricial mediante eventos tipados y privacidad explícita.

Incluye Sensor de movimiento e inclinación MPU6050, Lector de tarjetas PN532 y Teclado de números y teclas 4 × 4/3 × 4. Debe simular gestos y tarjetas predefinidas, evitar registrar identificadores reales innecesarios y no equiparar el UID de una tarjeta con autenticación segura.

## Fase 41 — Actuación y medición avanzada

**Objetivo:** completar periféricos que requieren planificación cooperativa, calibración o privacidad adicional.

Incluye Motor de pasos 28BYJ-48/ULN2003, Balanza HX711 y Ubicación GPS. El motor no bloquea otros caminos; la balanza separa calibración y lectura; GPS usa recorridos ficticios en simulación y nunca accede o publica ubicación real del alumno por defecto.

El alcance transversal, orden, perfiles, componentes postergados y fuentes de las fases 35 y 38–41 están centralizados en [COMPONENTES_A_IMPLEMENTAR.md](COMPONENTES_A_IMPLEMENTAR.md). Esa lista evita duplicar componentes por fabricante y exige separar software terminado de aceptación física.

## Fase final — Producción y piloto, postergada

Es la antigua fase 11, renombrada por decisión del propietario. No se ejecuta como consecuencia de terminar una fase del backlog.

Conserva su alcance: despliegue de producción en la VM correspondiente, dominio/HTTPS, secretos separados, permisos operativos, copias externas y restauración ensayada, reaplicación de registros de eliminación al restaurar respaldos antiguos, límites de compilación, carga representativa, monitoreo y reversión del despliegue. Validar el recorrido con administrador, docentes y alumnos de prueba antes de introducir datos reales o abrir el piloto.

Antes de iniciarla: nueva autorización explícita, inventario/acceso vigentes, decisión de qué perfiles integran el piloto y cierre físico de la fase 10 y de los perfiles/componentes que se vayan a ofrecer. No omitir incompatibilidades ni anunciar como soportado hardware no ensayado. Confirmar con el propietario cualquier cambio del alcance del piloto.

El gateway sigue siendo sólo un salto SSH, con prohibición de cambios. Tampoco se modifican Proxmox, router o Nginx sin la autorización específica correspondiente. No se aumenta capacidad de las VMs ni se reactiva Pages/Sites.

## Cómo se trabaja y qué falta decidir

- Una fase completa autorizada por vez, con implementación, pruebas proporcionales, entrega en DEV y commit/push. Informar avances con evidencia y pendientes; no inventar porcentajes ni tiempos exactos.
- **Fases 11–14 y 29 entregadas; fases 15, 16, 27, 28 y 36 terminadas en software; fase 23 en curso.** Actualizar la documentación viva al cerrar cada entrega solicitada. No ejecutar las fases restantes, completar la aceptación física ni avanzar a producción sin autorización y hardware correspondientes.
- Para fase 17 hace falta el modelo Waveshare exacto antes de fijar drivers/pines; para cerrar las aceptaciones físicas de 15, 16 y 23 hace falta autorización para reemplazar firmware y los montajes correspondientes.
- La fase 14 fija el paralelo como un contenedor con caminos apilados de arriba hacia abajo y mantiene fork/join. Desafíos y `según` se especifican en 19; display en 18; UX en 21; displays/matriz en 23; datos en 29; temporizadores en 30; procedimientos en 31; estados en 32; red en 33; servicios remotos en 34; RGB en 35; intérprete en 36; ayuda de componentes en 37 y el catálogo ampliado en 38–41. Son decisiones dentro de esas fases, no nuevas fases con letras.
- No hay estimaciones horarias comprometidas: hardware, alcance de la adaptación gráfica y mediciones en la VM condicionan el esfuerzo. No retrasar ahora la planificación esperando esos datos, ni prometer implementaciones específicas de un modelo no identificado.
