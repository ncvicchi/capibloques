# Fase 32 — Estados y valores consultables de componentes

**Estado:** implementada en software el 24 de septiembre de 2026. Falta desplegar DEV y hacer aceptación física.

## Resultado

La categoría **Datos** ofrece tres bloques comunes —número, texto y sí/no— que permiten elegir un componente de la escena y uno de sus datos compatibles. El selector se reconstruye cuando cambia la escena y muestra de forma visible el origen:

- **medido:** proviene de una entrada física;
- **ordenado:** es lo último que pidió el programa a un actuador, no una confirmación eléctrica o mecánica;
- **servicio:** pertenece a Wi‑Fi o Mensajes.

El registro tipado inicial cubre semáforo, LED, robot de dos motores, motor, servo, botón, barrera infrarroja, sensores analógicos, Wi‑Fi, Mensajes y todos los perfiles Otto compatibles. Los perfiles Otto sólo publican distancia o cara cuando realmente incluyen esos elementos.

## Contrato y comportamiento

`componentValue` conserva en JSON la instancia, propiedad, tipo y origen. La validación detecta una instancia borrada, una propiedad retirada o un perfil/tipo modificado y bloquea la ejecución con un mensaje accionable; no repara silenciosamente una referencia. Renombrar conserva el identificador y por eso no rompe el programa.

El simulador lee el estado actual en el mismo instante determinista del planificador. Arduino y ESP-IDF mantienen variables de estado ordenado junto a la salida física y leen directamente entradas medidas y servicios. `CapiRules` exige la capacidad `component-state`; el intérprete 1.2.0 la negocia y conserva la misma distinción.

Los valores ordenados iniciales son apagado/detenido/cero, salvo el ángulo configurado del servo y la cara inicial de Otto. En caminos paralelos, la última instrucción efectivamente ejecutada por el planificador es el valor observado.

## Verificación

La prueba `scripts/component-values.test.mjs` cubre registro, tipos/origen, referencias retiradas o desactualizadas, generación Arduino/ESP-IDF y negociación del intérprete. La batería smoke incluye además serialización, simulador y contrato fuente del firmware. La verificación física debe confirmar al menos semáforo, potencia de motor, una entrada digital y una analógica; hasta entonces no se declara hardware ensayado.
