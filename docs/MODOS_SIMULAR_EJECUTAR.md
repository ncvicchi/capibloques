# Simular en PC y ejecutar en placa

Entrega 01/11/2026 en `codex/dev3-modos-ejecucion-reglas-actuales`, desde dev3.
Ampliación del asistente de fase20 y de la usabilidad del editor.

## Comportamiento

El selector **Simulador / Placa y PC** determina el destino explícitamente.
El botón principal dice **Simular** para PC y **Ejecutar** para placa más
visualización web. Usar en placa/Detalles de placa queda como configuración
del enlace e instalación, no como un segundo botón de reproducción ambiguo.

- Simular usa sólo el worker web. Al pasar a Simulador con USB conectado se
  confirma STOP, incluso si HELLO no informó el programa autónomo anterior.
  Un error/desconexión USB posterior no detiene la simulación PC independiente.
- Ejecutar compila los bloques actuales en el momento del clic y crea las
  reglas con la escena/pines actuales. Siempre hace STOP, transferencia
  completa, VERIFY/COMMIT y RUN; no es sólo una orden RUN de lo ya guardado.
- El espejo web recibe el mismo snapshot que se confirmó en la placa. Una
  edición durante el envío queda pendiente, sin mezclar programa/escena de
  revisiones distintas.
- Reanudar/Paso comparan el checksum del último envío de esta conexión; si
  cambió, envían las reglas nuevas antes de ejecutar. Un Paso nuevo carga
  el snapshot y avanza una instrucción; no arranca el espejo continuamente.
- Al editar los bloques o abrir/cambiar la escena se solicita STOP cuando
  había ejecución física. Se indica **Cambios pendientes · se envían al ejecutar**.
  El botón vuelve a Ejecutar si hay cambios, aun si llega tarde el STOP.
- Se bloquean acciones incompatibles mientras se verifica/envía/controla.
  Cambiar a Simulador no afirma éxito si STOP falla.
- La conexión USB se puede conservar entre ambos modos. No se vuelve a pedir
  el puerto para cada edición/envío. Error o desconexión detiene el espejo y
  deja el estado del enlace explícito. Desconectar USB conserva su semántica:
  no garantiza detener el programa autónomo ya grabado.
- Si falta conexión, Ejecutar abre el asistente. Una conexión existente con
  error vuelve a mostrar el asistente para recuperarla, sin un clic silencioso.

No se envían reglas mientras se escribe: se envían al pulsar Ejecutar o al
reanudar/avanzar con cambios. Las credenciales Wi-Fi siguen fuera del JSON y
se configuran en el asistente; no se reprovisionan por editar bloques.

## Causa comprobada y pruebas

Antes, el control principal mostraba Simular incluso al controlar hardware.
Su RUN llamaba directamente `session.command('RUN')`: no enviaba reglas y
el `program` del asistente podía conservar la última compilación. El reenvío
manual era un camino separado. Ahora ambos usan la compilación al clic y
la transferencia completa; el snapshot confirmado gobierna el espejo.

Playwright con Serial simulado comprueba selección inicial, edición real de
un campo Blockly (espera1→2s), bytes del nuevo paquete, cambio de GPIO de un
LED en Armar escena, guardado/envío, ida/vuelta entre modos y una sola selección
USB. Simular no emite comandos físicos después de detener al cambiar de modo.
También se conservan los casos de reconexión tras corte e instalación→reglas.
Ver `tests/usb-reliability.spec.ts`. TypeScript y lint aprobados.

## Diagnóstico físico Wemos del propietario

COM34 respondió HELLO con intérprete1.15.0. Se respaldaron de forma privada
ambos bancos de reglas por lectura de flash; CRC correcto y ambos contenían
los grupos 26/25/17/16 y5/23/19/18, con acciones para los dos semáforos.

Una prueba temporal por CapiLink puso ambos rojo3s/amarillo3s/verde3s/OFF1s.
El propietario confirmó ambos funcionando. Se restauraron los bytes del
programa original y RUN sin reconectar; confirmó también ambos funcionando:
S1 rojo/S2 verde3s, ambos amarillo1s, S1 verde/S2 rojo3s y repetir.
Se restauró el original en ambos bancos para no conservar un diagnóstico
como versión anterior. El puerto quedó libre y el programa original corriendo.

No se modificó ni reinstaló el firmware1.15.0. La aceptación anterior prueba
la Wemos y esos dos módulos; la UI se valida aparte con dobles, no se declara
una prueba física del navegador ni de S3/inversión. Los respaldos/reglas/logs
privados permanecen en `work/`, fuera de Git.

## Operación

Activo por HMR en DEV3. Refrescar y elegir el destino. No requiere compilar
firmware ni ejecutar actualizadores del servidor. Publicar rama y dev3;
main/dev1/dev2 permanecen fuera de esta entrega.
