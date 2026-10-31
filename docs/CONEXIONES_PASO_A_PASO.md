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
