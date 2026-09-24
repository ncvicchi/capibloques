# Fase 40 — Movimiento e identificación

Estado: **terminada en software; aceptación física pendiente**.

Se agregaron MPU6050, lector PN532 y teclados 3×4/4×4. La simulación ofrece inclinación, movimiento, tarjetas con alias predefinidos y teclas; no solicita ni publica UID reales. Sus valores tipados participan en condiciones, variables, textos y procedimientos mediante el bloque común de valor.

Escena, perfiles, pines, ayuda, cableado, JSON, validación del servidor y ambos generadores están cubiertos. Los controladores físicos I²C y el barrido de teclado conservan aceptación pendiente con hardware; un UID de tarjeta nunca se presenta como autenticación segura.

Pruebas comunes: `npm run test:modules`, smoke, tipos, lint y build.
