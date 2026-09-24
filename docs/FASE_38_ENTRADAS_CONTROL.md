# Fase 38 — Entradas y control cotidiano

Estado: **terminada en software; aceptación física pendiente**.

Se incorporaron componentes concretos para HC-SR04/VL53L0X, PIR HC-SR501, joystick KY-023, MOSFET/relé de baja tensión y encoder KY-040. Cada uno tiene perfil, pines, ayuda infantil, guía de conexión, valores tipados, controles de simulación y persistencia JSON. `Encender aparato` dispone de bloque de potencia; en perfil relé cualquier potencia mayor que cero se convierte en encendido.

Los valores aparecen en el bloque general `valor de componente`, por lo que pueden compararse, guardarse en variables y combinarse con textos. Arduino y ESP-IDF generan contratos y estado tipado; PIR y joystick actualizan lecturas físicas directamente. La verificación física de cada perfil —incluidos distancia y encoder— sigue abierta y no debe confundirse con la simulación aprobada.

Pruebas: `npm run test:modules`, `npm run test:smoke`, `npm run typecheck`, `npm run lint`, `npm run build`.
