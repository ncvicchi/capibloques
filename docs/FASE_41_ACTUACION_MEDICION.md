# Fase 41 — Actuación y medición avanzada

Estado: **terminada en software; aceptación física pendiente**.

Se agregaron 28BYJ-48 con ULN2003, balanza HX711 y GPS NMEA. La escena configura velocidad/calibración/puerto, la simulación permite probar posición, movimiento, peso, señal y recorridos ficticios, y los valores se integran con condiciones, variables y textos. GPS inicia sin señal y usa una ubicación ficticia; no consulta la ubicación del navegador.

El modelo, JSON, ayuda, cableado, simulación, validación y generación Arduino/ESP-IDF están cubiertos. El movimiento físico cooperativo del motor, adquisición HX711 y parser NMEA deben aceptarse con módulos reales antes de declararlos comprobados en hardware.

Pruebas comunes: `npm run test:modules`, smoke, tipos, lint y build.
