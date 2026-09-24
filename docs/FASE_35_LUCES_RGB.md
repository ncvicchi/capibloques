# Fase 35 — Luces RGB inteligentes

Estado: **terminada en software el 24 de septiembre de 2026; actualización de DEV y aceptación física pendientes**.

## Entrega

- Componente único **Luces RGB inteligentes** para WS2812B/WS2812 y SK6812 RGB de 800 kHz.
- Formas tira, aro y matriz, de 1 a 256 luces. Las matrices configuran ancho, alto, primera esquina y recorrido progresivo o zigzag.
- Bloques para conjunto, píxel, tramo, coordenada, degradado, dibujos corazón/sonrisa/damero y animaciones arcoíris/persecución/parpadeo/pulso.
- Las animaciones avanzan como tareas cooperativas. El camino continúa inmediatamente; `esperar a que termine` sincroniza sólo cuando se lo agrega. Una salida estática o una animación nueva cancela la anterior.
- Simulador, JSON, validación cliente/servidor, deshacer/rehacer de escena, ficha infantil, guía de conexiones y dato lógico de brillo ordenado.
- Generación Arduino con Adafruit NeoPixel 1.12.3, ESP-IDF 5.5.5 con RMT y firmware intérprete CapiLink 1.4.0 con capacidad negociada `smart-lights`.
- Estimación visible de consumo máximo según cantidad y brillo. Es una estimación, no una medición; la guía exige fuente adecuada, DIN y masa común.

## Verificación de software

- `npm run typecheck`
- `npm run lint`
- `npm run test:smoke`
- `npm run build`
- generación de sketch Arduino representativo;
- generación, empaquetado, extracción, CRC y SHA-256 de los doce fixtures ESP-IDF, incluido `smart-lights`;
- prueba backend incorporada para el contrato portable, a ejecutar en CI/DEV porque el Python local no contiene Django/pytest.

La CI y el despliegue DEV compilan además el sketch, el proyecto ESP-IDF y los dos intérpretes. Los binarios generados no se versionan.

## Pendiente físico

No se afirma compatibilidad física todavía. Falta probar al menos una tira y una matriz reales en Wemos D1 R32 y ESP32-S3: color RGB/GRB, orientación/zigzag, refresco con Wi‑Fi/audio/PWM, recuperación al detener, consumo y límites prácticos. WS2811 y RGBW permanecen fuera de este perfil hasta contar con hardware y contratos específicos.
