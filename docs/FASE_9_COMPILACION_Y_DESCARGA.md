# Fase 9 — Compilación y descarga

Autorización: «Vamos con el 9». **En implementación; no entregada.**

## Alcance y decisiones de implementación

- Compilar una instantánea guardada de un proyecto propio. Los docentes hacen una copia personal antes de compilar un trabajo ajeno. El servidor carga el documento: no recibe fuentes, ZIP, CMake, rutas o flags arbitrarios del navegador.
- Cola persistente en PostgreSQL, fuera de las peticiones HTTP; estados, cancelación de pedidos en cola, idempotencia, cuotas, turno entre usuarios y cupo global compartido por Arduino/ESP-IDF.
- Configuración administrativa con Guardar/Cancelar, revisión optimista, auditoría, pausa separada y un techo operativo según recursos reales. Bajar el límite no mata trabajos activos.
- Planificador confiable separado de los compiladores. Ejecuciones efímeras sin red, secretos, volúmenes de proyectos ni socket Docker; CPU/RAM/swap/procesos/disco/tiempo y logs limitados. Toolchains y dependencias permitidas se preparan antes, nunca a pedido del cliente.
- Lease/heartbeat con intento identificado. Un lease vencido no libera un cupo ni autoriza duplicar ejecución: primero comprobar/terminar el contenedor anterior. Resultado sólo del intento vigente. Reinicios no relanzan sin esa comprobación.
- Artefactos privados temporales separados de proyectos, con caducidad, hashes y manifiesto de direcciones extraídas del build real. Entregar ZIP de firmware completo para Wemos D1 R32; no confundir `app.bin` con una imagen suficiente para una placa vacía.
- Mantener editor/simulación utilizables durante la espera; identificar versión compilada y avisar si el editor cambió. JSON y las fuentes de fase 8 siguen disponibles.
- Validación con PostgreSQL real, pruebas de aislamiento/cola/reinicio, compilación Arduino/ESP-IDF real y Chrome/Edge contra DEV. Medir frío/caliente y respuesta de API mientras compila. Usar sólo documentos sintéticos.

DEV verificado al iniciar: 1 vCPU, 1967 MiB RAM, 2047 MiB swap y 22 GiB libres. Empezar con una compilación y un proceso interno; no es una promesa de capacidad. Si los recursos no alcanzan, conservar proyectos y pausar compilaciones.

Fuera de fase: grabación/monitor USB y configuración de red desde la PC (10), producción/HTTPS/piloto (11), ESP32-S3, control físico en vivo y backlog de interfaz. No enviar claves Wi-Fi al servidor ni incrustarlas en artefactos sin una decisión explícita del propietario; el tratamiento de Wi-Fi se confirma antes de habilitar su firmware descargable.
