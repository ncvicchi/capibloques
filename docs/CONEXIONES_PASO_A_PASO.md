# Conexiones paso a paso — DEV3

Entrega del 31/10/2026 en `codex/dev3-conexiones-paso-a-paso`, desde `dev3`.
Ampliación de la guía de conexiones; no sustituye el listado existente.

En Más herramientas → Ver conexiones aparece **Paso a paso**. Para cada
componente muestra preparación/alimentación, GND y una señal por pantalla.
Atrás y Siguiente recorren todos los componentes; al terminar vuelve al
listado y al chequeo adulto, sin marcarlo automáticamente. Se puede salir
en cualquier momento y volver sin perder las casillas ya seleccionadas.

Los GPIO salen de `getPinRequirements` y de los pines actuales de la escena,
incluidos perfiles opcionales y salidas avanzadas. No se deduplican cables
de módulos que comparten un bus. Usa nombres configurados y serigrafía del
mapa de placa. No reasigna pines, modifica proyectos ni envía órdenes USB.

El contacto del paso tiene aro naranja y flecha; los usados son amarillos
con borde oscuro. Etiquetas con contorno blanco contrastan sobre la placa.
La mejora también se aplica a la vista completa. El estado simulado sigue
siendo optativo allí; el recorrido usa marcas fijas para mostrar cableado.

Seguimiento: el recorrido muestra **componente y placa juntos**, con el
contacto del componente rotulado y un cable hasta el contacto seleccionado
de la placa. Hay dibujos propios para semáforo, LED, matriz, pantalla, servo,
motor/driver y botón; los demás usan un módulo esquemático con su icono y
nombre de catálogo. No son fotografías ni prometen el orden físico de bornes.
En semáforo se destaca la luz correspondiente; los pasos de LED incluyen la
resistencia dibujada. El cable se recalcula al cambiar paso o dimensiones,
incluido el diseño apilado de pantallas pequeñas. No se dibuja un cable a la
placa si la señal no tiene destino válido. Preparación muestra ambos sin cable.

Referencia de semáforo confirmada por foto del propietario:
[foto original](references/traffic-light-module.png). Se representa su PCB
horizontal, tres LED, resistencias y conector de cuatro pines; de arriba hacia
abajo **GND, R, Y, G**. El aro y el origen del cable se ubican sobre el pin
físico correspondiente. G significa verde, no GND. Este modelo incorpora
resistencias; la guía distingue este módulo de LED sueltos. Los carteles
MAX7219 opcionales conservan su dibujo separado. Esta referencia sí fija el
orden del conector de este modelo; otros componentes siguen siendo esquemas
genéricos. Caso Playwright recorre los cuatro pines en Chromium/Chrome/Edge.

## Límites

- GPIO vacío/no localizado/no habilitado: explica el problema sin inventar destino.
- Alimentación: conserva consejo y ayuda específicos; no asigna VCC a 5 V/3,3 V
  automáticamente porque depende del módulo real.
- GND: destaca los contactos de la placa y explica masa común del componente,
  driver y fuente externa. LED/semáforo incluyen polaridad y resistencia por luz.
- Waveshare principal: botón deshabilitado con explicación visible, porque
  sus componentes son virtuales y no llevan GPIO locales.
- Avanzar no certifica cables reales ni completa la revisión adulta.
- Cambiar placa/nombres/pines/configuración reinicia el recorrido. Cerrar y
  reabrir vuelve a la vista completa. La cámara y los pasos no se guardan en JSON.

## Validación y operación

TypeScript y lint aprobados. Cuatro casos Playwright contra DEV3 en Chromium,
Chrome y Edge (12 aprobados): Wemos/S3, ida/vuelta, pin exacto, conservación
del chequeo sin aprobarlo, señal sin asignar y Waveshare. Capturas revisadas.

El caso histórico `workbench.spec.ts` «Wemos: pines...» tiene un fixture
desactualizado: espera Semáforo 1 en el proyecto inicial, que ahora es Seguidor
de línea básico. Falló al buscar esa opción; no es una regresión del selector.
La nueva prueba carga su propio proyecto y comprueba selector/mapa/tabla sin
depender del ejemplo inicial. No se declara aprobada toda la suite histórica.

Archivos sincronizados explícitamente a la VM y activos por HMR en
`http://localhost:3003/`. No requiere compilar/grabar firmware ni usar
`update-dev.sh`. Rama publicada sin integrar automáticamente main/dev1/dev2.
Aceptación del propietario pendiente.
