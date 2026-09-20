# Fase 28 — Barrera infrarroja digital

## Estado

Implementada en software el 20 de septiembre de 2026. La escena, Blockly, simulación, JSON, validación del servidor y generación Arduino/ESP-IDF comparten el mismo contrato. La aceptación física permanece pendiente hasta identificar y medir el detector disponible; compilar no demuestra niveles eléctricos ni polaridad reales.

## Contrato infantil

**Barrera infrarroja** representa como una sola pieza al emisor y al detector. Para programar sólo existen dos estados:

- **Libre:** nada corta el haz.
- **Interrumpida:** un objeto corta el haz.

No se presenta una lectura analógica ni se obliga al alumno a trabajar con 0 y 1. El bloque `Barrera infrarroja 1 está interrumpida/libre` produce un dato de tipo **sí/no**: puede encastrarse directamente en `si / si no`, guardarse en una variable booleana o compararse mediante los bloques generales de datos.

## Escena y simulación

Cada instancia tiene nombre, posición, un GPIO de entrada digital y la opción **Señal cuando el haz se interrumpe**. Esa opción permite elegir nivel bajo (0) o alto (1) según el detector físico y vive únicamente en la escena; los bloques continúan diciendo libre/interrumpida.

La pestaña Estado ofrece dos botones explícitos, **Libre** e **Interrumpida**, y la escena muestra el estado con texto además del cambio visual. La entrada se conserva al ejecutar o reiniciar. La evaluación es inmediata y cooperativa: no espera, sondea ni bloquea otros caminos.

Se admiten varias barreras con nombres y GPIO distintos. Al eliminar una, sus bloques conservan la identidad huérfana y muestran el diagnóstico habitual; nunca se reasignan silenciosamente a otra instancia.

## Firmware y conexiones

Arduino configura el GPIO como `INPUT`; ESP-IDF usa una entrada sin pull-up interno. Ambos leen el nivel digital en el momento de evaluar la condición y aplican la polaridad configurada para obtener el mismo estado lógico. La guía lista **Salida digital del detector**, muestra el GPIO sobre la placa elegida y recuerda compartir GND.

Antes del ensayo físico hay que identificar tensión de alimentación, tensión/tipo de salida —push-pull, colector abierto u otra— y polaridad real. Si el módulo necesita polarización o adaptación de nivel, se resolverá en el circuito y se documentará para ese modelo sin cambiar el lenguaje infantil.

## Verificación

- prueba de modelo, GPIO digital, JSON y validación de programa;
- simulador aislado con entrada interrumpida y bifurcación observable;
- generación Arduino con `INPUT` y comparación `HIGH/LOW`;
- generación ESP-IDF con entrada digital y comparación `1/0`;
- validación backend de componente, configuración exacta y bloque portable;
- recorrido Playwright de alta/edición de polaridad y de libre/interrumpida actuando sobre un LED;
- fixture nativo de firmware ampliado para que CI compile la condición.

## Pendiente físico

Con el módulo exacto conectado hay que verificar alimentación, masa común, nivel de salida, polaridad, estabilidad ante haz libre/interrumpido y funcionamiento en Wemos D1 R32 y/o la placa autorizada que se vaya a usar. Hasta entonces la fase queda **entregada en software, con aceptación física pendiente**.
