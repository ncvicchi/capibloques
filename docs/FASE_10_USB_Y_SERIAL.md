# Fase 10 — USB y monitor Serial

Autorización: «Empeza y termina la 10». **En implementación, no entregada.**

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

Registrar aquí implementación, resultados y límites al cerrar la fase. Las pruebas simuladas de transporte no sustituyen grabar una placa física.
