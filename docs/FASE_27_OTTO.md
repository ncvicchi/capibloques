# Fase 27 — Familia Otto

Estado: **primer perfil entregado en software; aceptación física pendiente**.

## Perfil disponible

`Otto básico` es un bípedo genérico compatible con la arquitectura de cuatro servos: pierna izquierda, pierna derecha, pie izquierdo y pie derecho. No se anuncia como certificación de HP Robots ni como compatibilidad con una controladora Otto oficial; el firmware generado apunta a las placas ESP32 admitidas por CapiBloques.

El editor permite asignar los cuatro GPIO, ajustar el centro de cada servo entre 45° y 135° e invertir su sentido. Los servos requieren alimentación externa adecuada de 5 V y masa común con el ESP32.

## Programación y simulación

El bloque `Otto básico` ofrece volver al centro, caminar adelante o atrás, girar a ambos lados y bailar, con velocidad y cantidad de repeticiones. Cada movimiento espera sólo en su propio camino del scheduler: los caminos creados con `Al mismo tiempo` continúan. La escena muestra el movimiento y su progreso.

El JSON, deshacer/rehacer, favoritos, validación del servidor y los generadores Arduino y ESP-IDF conservan la misma semántica. Un segundo camino puede reemplazar el movimiento del mismo Otto; volver al centro lo cancela.

## Verificación y límites

La prueba automática `scripts/otto.test.mjs` cubre escena, calibración, JSON, validación y ambos generadores. Falta conectar un Otto real para ajustar amplitudes, centros, sentido de servos y tiempos sin forzar la mecánica.

Quedan pendientes los perfiles posteriores: buzzer, ultrasónico, matriz/expresiones, brazos/Ninja y Wheels. Se implementarán de menor a mayor complejidad y sólo se declararán físicamente compatibles después de identificar y ensayar el hardware.
