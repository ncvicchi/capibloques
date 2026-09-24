# Fase 30 — Temporizadores y eventos cooperativos

## Estado — 24 de septiembre de 2026

**Implementada en software. Despliegue DEV y aceptación física pendientes.**

La entrega incorpora temporizadores con nombre al proyecto, bloques infantiles, simulación, JSON portable, Arduino, ESP-IDF y `CapiRules`/firmware intérprete 1.1.0. No usa la hora civil ni convierte los vencimientos en interrupciones ocultas.

## Contrato visible

- `iniciar [temporizador] por [segundos] [una vez/repetir]` comienza desde cero. El rango es 0,1 segundos a 24 horas.
- `reiniciar` vuelve a cero conservando duración y modo; si nunca fue iniciado, no hace nada.
- `pausar` congela ese reloj y `continuar` lo reanuda sin contar el intervalo pausado.
- `detener` vuelve a cero y cancela una espera pendiente.
- `esperar próximo evento` suspende únicamente ese camino. Sensores, mensajes, animaciones y otros caminos de `Al mismo tiempo` siguen ejecutándose.
- `segundos transcurridos` entrega segundos completos; `segundos restantes` redondea hacia arriba para no mostrar cero antes del vencimiento. Ambos son valores numéricos utilizables en cuentas, comparadores, variables y textos.

Los temporizadores se crean con nombres únicos de hasta 32 caracteres y quedan en `program.timers`. Hay como máximo 16 por proyecto. La categoría **Temporizadores** y sus ocho bloques pueden agregarse a Favoritos.

## Semántica cooperativa

Cada temporizador usa un reloj monotónico y diferencias sin signo resistentes al rollover de `millis()`. El planificador actualiza relojes antes de recorrer caminos y acumula eventos pendientes hasta 65.535. Si varios vencen en el mismo ciclo, se actualizan en el orden estable de la tabla del proyecto; después cada camino consume su evento según el orden determinista del planificador.

Un temporizador de una vez queda `cumplido` al vencer. Uno repetitivo conserva el resto de la vuelta aunque el planificador haya tardado más de un período, sin perder la cantidad de eventos vencidos. La pausa global del simulador congela el tiempo virtual; el intérprete actualiza y realinea los relojes al pausar/continuar.

La interfaz muestra para cada reloj nombre, estado, segundos restantes y una barra de progreso dentro del panel de ejecución. No agrega otra cabecera global.

## Salidas

- El simulador comparte la misma semántica de inicio, pausa, repetición, consumo y cancelación.
- Arduino y ESP-IDF generan una tabla fija, servicio cooperativo por ciclo y lecturas numéricas; no generan `delay()` para los eventos.
- `CapiRules` incluye la tabla de temporizadores y declara la capacidad `timers`.
- El firmware intérprete 1.1.0 negocia esa capacidad y rechaza reglas con firmware anterior o sin ella. Los proyectos nativos Arduino/ESP-IDF siguen disponibles.

## Evidencia local

- `npm run typecheck`
- `npm run lint`
- `npm run test:smoke`, incluida la prueba que demuestra que un camino avanza mientras otro espera un evento
- `npm run build`
- pruebas específicas de normalización, diagnóstico, generación Arduino/ESP-IDF, reglas deterministas y contrato del intérprete

La compilación cruzada del firmware intérprete queda a cargo de la CI ESP-IDF del commit publicado. La aceptación física requiere instalar 1.1.0 y comprobar una vez, repetición, pausa/reanudación, cancelación y dos caminos paralelos en Wemos o ESP32-S3; no se presenta como realizada.

## Límites deliberados

- No hay callbacks libres, interrupciones de usuario ni acceso a la hora/fecha.
- No existe todavía un bloque global «cuando venza» separado: el patrón explícito y legible es `Al mismo tiempo` + `esperar próximo evento`.
- No se persiste el estado en marcha al cerrar/reiniciar; sólo la definición forma parte del proyecto.
- Los temporizadores no sustituyen procedimientos ni estados de componentes, previstos en fases 31 y 32.
