# Fase 21 — Claridad y ergonomía educativa

Entrega de software del 7 de octubre de 2026, autorizada por «Vamos con la 21».
No modifica firmware, ABI, migraciones ni permisos. DEV lo actualiza el propietario.

## Observaciones contrastadas y decisiones

| Pedido | Evidencia y resolución |
| --- | --- |
| Bloques superpuestos | Los grupos libres podían soltarse sobre otro grupo. Al terminar el arrastre se busca espacio debajo de los obstáculos, en unidades del workspace, sólo dentro de la misma pestaña. Se mueve el grupo soltado, no sus conexiones ni los otros grupos. Separación y movimiento comparten Deshacer/Rehacer. Importar y ejecutar no reacomodan coordenadas. |
| Bloques fuera del programa | Antes faltaba una indicación textual permanente. Ahora hay borde discontinuo, atenuación moderada, advertencia por grupo y texto accesible. Se identifica una raíz distinta de Al comenzar o de una definición de procedimiento/función. Una definición no se considera un bloque suelto; una rama que no se ejecutó tampoco. No se deshabilitan ni eliminan bloques. |
| Nombre editable | El lápiz ya existía. Se agrega subrayado del campo y foco visible. Se reproduce y corrige una regla antigua que ocultaba el nombre a menos de 900 px; sigue editable en móvil/tablet. |
| Colores en español | La lectura del estado devolvía RED/YELLOW/GREEN. Ahora muestra Rojo/Amarillo/Verde/Apagado y el tooltip del semáforo usa el mismo vocabulario. Los valores portables internos no cambian. |
| Advertencias cerrables | Ya existe el diálogo Qué hay que revisar, con texto, botón de cierre, navegación al bloque/escena y ayuda. Se mantiene el botón de detalles: cerrar no equivale a resolver ni elimina conflictos eléctricos. No se añade un segundo tooltip. |
| Avatar | Ya hay botones amplios Seleccionar avatar / No cambiar mi avatar, selección por teclado, guardado y cancelación. Se conservan sin duplicar controles. Reacciones corresponden a fase 22. |
| Wi-Fi en segundos | El bloque vigente ya dice segundos. Se conserva su serialización y tiempo. |
| Chincheta del pin | Evaluada y descartada: una chincheta puede confundirse con fijar una ventana. Se conserva pin/GPIO escrito y la guía visual de placa; no se depende de un emoji para reconocerlo. |
| Saludo y privacidad | Hola, nombre visible, igual para alumno/docente/admin. No se agrega alias ni rol al encabezado; el alias sigue disponible al abrir Mi cuenta. El nombre ya era visible antes. No se exportan identidades al proyecto por esta mejora. |
| Desplegables y números | Desplegables con fondo claro, contorno y flecha; números con borde diferenciado. Los comparadores numéricos, de datos, contador y sensores presentan palabras junto al símbolo. EQ/LT/etc. siguen iguales en JSON y generadores. Temporizadores ya usaban palabras. |
| Emojis | Se conservan acompañados de texto; no se aumenta globalmente su tamaño ni se cambia la fuente porque podría deformar bloques entre plataformas. La lectura accesible describe el bloque y su pertenencia al programa. |
| Auto-conectar en borrador | El guardado del inspector bloqueaba la acción. Ahora utiliza la vista previa completa y aplica pines y propiedades al borrador en una operación deshacible. Actualiza el inspector inmediatamente; no publica ni guarda el proyecto. Cancelar escena conserva la escena original. |
| Movimiento con propiedades pendientes | Se podía arrastrar un objeto limpio, pero no uno con campos pendientes. Ahora se mueve el seleccionado dentro del inspector pendiente, conservando sus campos. Guardar/Cancelar cambios siguen controlando esa edición; no se aplica silenciosamente. Para mover otro objeto se mantiene la decisión explícita sobre el pendiente. |
| Encabezados y teclado | Se conserva Crear/Probar y Más de fase 42. Navegación Blockly se desactiva al llevar foco fuera del editor para no interferir con campos/menús. La fidelidad geométrica de escena no se redefine aquí: sigue en fase 45. |

## Vista optativa de pines

Más herramientas → Ver conexiones → Ver estado simulado de los pines.
El diagrama Wemos/DIYmall colorea contactos y la tabla incluye su equivalente
textual. Semáforo y salida digital: 0/1; LED: porcentaje PWM; servo: ángulo;
buzzer: encendido/tono; entradas analógicas: 0–4095 con intensidad proporcional;
botón/barrera: estado lógico sin inventar la polaridad eléctrica.

Sólo se representan señales modeladas. Buses, drivers de motores y otros
protocolos sin modelo de señal muestran Sin lectura simulada, no un supuesto
voltaje. La Waveshare como pantalla virtual no recibe esta opción GPIO.
No hay realimentación física, osciloscopio ni certificación de cableado. La vista
no cambia el proyecto, el reconocimiento de seguridad ni el firmware.

## Verificación y operación

- Pruebas puras de búsqueda de espacio, vocabulario y estados de pines, incluidas
  en la suite smoke existente.
- Contratos navegador: importación sin reordenado, campos reconocibles, arrastre
  con separación, Deshacer/Rehacer, edición del título en tablet con movimiento
  reducido, borrador pendiente, auto-conexión, cancelación y pines optativos.
- Los contratos antiguos de mesa/editor se actualizan de Ejecutar a Simular,
  el nombre vigente anterior a esta fase. Importaciones confirman explícitamente
  el reemplazo cuando hay un borrador; no se retira esa confirmación de la app.
- Para revisar sólo lectura se usa una escena válida actual. Se conserva el
  fixture histórico backend cuyo semáforo fuera del cruce ya es rechazado.

Resultados: tipos, estilo, suite smoke completa, build y 10 rutas estáticas
aprobados; 26 regresiones Chromium y 9 contratos específicos (tres recorridos
en Chromium, Chrome y Edge) aprobados. Capturas inspeccionadas; se agrega
comprobación del contraste del texto desplegable. Resultados también se
registran en el contexto vivo. No se han probado alumnos,
docentes ni lectores de pantalla reales; la aceptación humana queda pendiente.
Tampoco se afirma que DEV esté actualizado por una prueba local.

```bash
cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast
```

## Prueba breve del propietario

1. Soltar un bloque libre encima de otro: se separa. Deshacer/Rehacer debe
   conservar el conjunto; un encastre correcto no debe separarse.
2. Abrir Armar escena, cambiar el nombre de un LED sin aplicarlo, moverlo y
   Auto conectar. Deshacer/Rehacer y Cancelar deben preservar el original.
3. Abrir Conexiones, activar el estado simulado y contrastar con el simulador.
   No interpretar esos colores como lectura de una placa conectada.
4. Abrir en pantalla pequeña: título editable, acciones bajo demanda y sin
   pérdida de controles. Confirmar comprensión con un docente y alumnos.
