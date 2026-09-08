# Fase 10 — USB y monitor Serial

Autorización: «Empeza y termina la 10». **Software implementado y desplegado en DEV. La fase no se cierra: queda pendiente la aceptación física.** El propietario confirmó el 8 de septiembre de 2026 que no dispone de una Wemos ahora; no se sustituye esa prueba por simulación ni se inicia fase 11.

## Alcance

- Chrome/Edge de escritorio, Web Serial con selector explícito en localhost/HTTPS. USB conecta la placa a la PC del navegador, no a Proxmox.
- Programar un firmware privado listo de fase 9 sin descargar archivos intermedios. Validar ZIP/manifiesto, SHA-256 y permisos antes de cualquier escritura; conservar framework/versión y aviso de cambios posteriores.
- Detectar ESP32 y capacidad flash; confirmar Wemos D1 R32 y reemplazo del firmware. El conversor USB no identifica por sí solo la placa. Rechazar S3/otros chips. No borrar toda la flash por defecto.
- Un único propietario del puerto; monitor real de lectura a 115200 separado de simulación, acotado y sin enviar mensajes al servidor. Liberarlo antes de grabar y recuperarlo después; cierres/cortes/sesiones revocadas no deben dejar lectores o escrituras colgados.
- Progreso de transferencia y verificación física, con cancelación explícita que advierte firmware incompleto. Reinicio autónomo después de carga verificada; cerrar el navegador o detener la simulación no detiene la placa.
- Pruebas de parser, transporte, puerto ocupado, permiso cancelado, desconexión, placa incompatible, hash incorrecto, revocación y recuperación; Chrome/Edge contra DEV. Prueba física de Arduino e IDF requiere Wemos identificada, cable de datos y actuadores desconectados.

No implementar controles de actuadores en vivo, TX/RX de bloques, ESP32-S3, UI del backlog, OTA ni producción. Mantener límites y privacidad de fase 9.

## Fuentes técnicas

- [esptool-js de Espressif](https://github.com/espressif/esptool-js).
- [Web Serial, permisos y liberación de lectores](https://developer.chrome.com/docs/capabilities/serial).

Las pruebas simuladas de transporte no sustituyen grabar una placa física.

## Implementación y uso

1. Guardar el proyecto, revisar el cableado y abrir **Exportar → Compilar y descargar firmware**. Elegir Arduino o ESP-IDF y esperar el estado Listo.
2. En ese pedido, elegir **Programar mi Wemos**. Se muestra nombre, versión, herramienta y vencimiento; cambios posteriores del editor se advierten explícitamente. No se descarga un ZIP intermedio a disco.
3. Identificar la Wemos, desconectar actuadores y confirmar el reemplazo del programa. **Elegir Wemos y grabar** abre el selector nativo del navegador dentro del gesto del usuario. No se seleccionan puertos Bluetooth u otras placas automáticamente.
4. Se verifica SHA-256 del ZIP y de cada segmento, estructura ZIP_STORED acotada, perfil, receta, offsets y sectores no superpuestos. Se detectan chip y flash antes de revalidar acceso al pedido. La biblioteca no puede suponer 4 MB si desconoce la memoria.
5. esptool-js 0.6.1 escribe bootloader/particiones/aplicación (y boot_app0 en Arduino), conserva los encabezados compilados y comprueba MD5 de cada segmento contra la flash. MD5 aquí es control de transferencia del protocolo, no firma ni sustituto de SHA-256. No hay borrado total automático. Tras verificar se solicita reinicio; la UI pide comprobar que el programa arrancó, no da por observada la ejecución.
6. **Elegir puerto y abrir monitor** abre lectura a 115200. También se accede sin compilar desde **Exportar → USB y monitor Serial**. Es el Serial real, distinto de la consola simulada. Limpiar y seguir mensajes son controles locales; no hay envío de comandos ni control físico en vivo.

Monitor y grabación se excluyen. Para cambiar, cerrar primero el monitor: se cancela la lectura aunque la placa esté silenciosa y se espera el cierre del puerto. Web Locks evita otra conexión de CapiBloques en pestañas del mismo origen; el sistema operativo sigue controlando la exclusividad con otras aplicaciones. Si no se puede confirmar el cierre, no se habilita otro propietario silenciosamente: desconectar el cable y cerrar/reabrir la pestaña.

Cancelar durante escritura puede dejar el firmware incompleto y exige volver a grabarlo entero. Cerrar la ventana está bloqueado mientras usa USB; recarga/salida del navegador advierte una operación activa. Cancelar el selector nativo puede requerir hacerlo en la propia ventana del navegador. El plazo máximo de conexión/grabación es cuatro minutos después de descargar; una operación bloqueada no libera el puerto por fingir que un timeout terminó la E/S.

La identidad se comprueba de nuevo antes de abrir el monitor y periódicamente mientras el diálogo está abierto. Cambio/revocación/cierre de sesión o pérdida conocida de acceso cancela USB y retira mensajes de la UI. Mantener la conexión al servidor durante la operación; una interrupción de acceso durante la grabación puede exigir repetirla. Las promesas viejas no pueden empezar otra escritura ni reutilizar el puerto de otra cuenta.

Los binarios preparados viven sólo en memoria de la pestaña; al terminar se limpian los segmentos utilizados. No se escriben en localStorage, IndexedDB ni historial. Los mensajes Serial se limitan a 200 líneas/32 KiB, se muestran como texto y no se envían al servidor. Ni el trazado interno de esptool ni sus errores imprimen bytes privados. Esto no promete borrado forense de RAM/swap, del firmware de la placa o de descargas que el usuario haga por separado.

## Verificación del software

- `npm run test:usb`: 15 grupos de parser, autorización, ciclo de conexión, cancelación y memoria; cinco comprobaciones del adaptador de Espressif. Incluyen el `writeFlash` real de la biblioteca con respuestas de flash simuladas: un MD5 distinto rechaza la grabación. Writer rechazado libera el lock; un `open()` tardío tras cancelar se cierra; el puerto no se reasigna si su cierre falló. Los textos UTF-8 se acotan por bytes sin partir emojis.
- Tipos, lint, smoke de editor/worker/programación/pantallas/historial/autoguardado, generador ESP-IDF, drivers C++ de pantalla/IDF y build de diez páginas estáticas correctos. `npm audit`: cero vulnerabilidades reportadas.
- [CI general de implementación](https://github.com/ncvicchi/capibloques/actions/runs/34188535092), commit `a9d69a3`: cuatro jobs correctos, **165 pruebas Chromium**, backend, siete programas Arduino y siete ESP-IDF compilados. Sus pruebas USB sustituyen explícitamente el dispositivo/adaptador por dobles; no son evidencia física.
- [CI general final de ciclo USB](https://github.com/ncvicchi/capibloques/actions/runs/34189286101), commit `8dd4676`: cuatro jobs correctos. Después, `c1e469b` acota la consola por bytes UTF-8 sin dividir emojis: verificado con los 15 grupos y cinco comprobaciones de `test:usb`, tipos/lint y **6/6 casos Chrome/Edge** de monitor, interrupción y revocación contra DEV (37 segundos). No se atribuye el CI anterior a ese ajuste posterior; la comprobación del ajuste fue dirigida a su alcance.
- Chrome/Edge reales en esta PC contra DEV mediante el túnel: **30/30** casos de USB/compilación, repetidos **30/30** tras `8dd4676` (2,4 minutos). Permiso rechazado, navegador no disponible, confirmaciones, firmware anterior, ZIP corrupto, chip incompatible, revocación, error de verificación, interrupción, monitor silencioso, reapertura, cambio de sesión y layout de 390 px. No se arrancó un servidor local alternativo ni se modificaron proyectos reales para estas pruebas.
- Compilación real de fixture Arduino en DEV: **91,9 s**, pico **534,8 MiB**, sin OOM; ZIP privado **309.339 bytes**, cuatro segmentos. Descarga autorizada y parser USB verificaron hashes y offsets `0x1000/0x8000/0xe000/0x10000`.
- Compilación real de fixture ESP-IDF en DEV: **418,3 s**, pico **532,3 MiB**, sin OOM; ZIP privado **188.640 bytes**, tres segmentos. Descarga autorizada y parser USB verificaron hashes y offsets `0x1000/0x8000/0x10000`. El parser se ejecutó en un contenedor temporal restringido con sólo ese artefacto de prueba y checkout montados de lectura, sin red.
- Ambas cuentas/proyectos sintéticos se retiraron mediante el probe y sus UUID exactos. Cero cuentas de esos probes y cero pedidos en cola/compilando al comprobar el cierre. Editor/API/DB saludables; compilador activo, concurrencia/techo 1, sin pausa. No se cambió imagen/receta del compilador, recursos, PRD, gateway, Proxmox ni Nginx. La VM conserva aproximadamente 11 GiB libres.

Son pruebas de software y contratos de transporte, no mediciones de un aula ni prueba de ejecución en ESP32. Los ZIP producidos con la imagen inmutable de fase 9 conservan su nota histórica sobre USB; el flujo vigente de grabación es el documentado aquí y disponible en la web.

Código publicado con commit/push y desplegado en DEV; esta actualización de resultados sólo cambia documentación. No quedan pruebas ni compilaciones de prueba ejecutándose. Se conserva el túnel de navegación y los servicios normales. El pedido de no revalidar sesión al recuperar el foco se agregó como entrada 8 del backlog, **sin implementarlo** ni modificar los disparadores de sesión existentes.

## Aceptación física pendiente

Al preparar esta fase, Windows sólo mostraba cuatro puertos Bluetooth; no había una Wemos identificada para sobrescribir. No se abrió ni programó ninguno de esos puertos. El selector nativo exige elección explícita del usuario y no se evade su permiso.

Para cerrar la fase hay que conectar una **Wemos D1 R32 concreta**, con cable de datos y actuadores desconectados, y confirmar que se puede reemplazar su programa. Probar Arduino y ESP-IDF por la web, comprobar sus mensajes reales, cerrar la pestaña y comprobar funcionamiento autónomo. Verificar también monitor cerrado/reabierto, desconexión y recuperación de una carga interrumpida sobre esa placa de prueba. La fase 11 permanece sin iniciar.
