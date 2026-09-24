# Fase 20 — Uso guiado de la placa

Estado al 24 de septiembre de 2026: **terminada en software y pendiente de aceptación física**. El propietario redefinió la fase para que el recorrido cotidiano sea instalar el firmware intérprete precompilado y enviar reglas localmente. La compilación Arduino/ESP-IDF por proyecto se conserva como herramienta avanzada, pero deja de competir con la acción principal.

## Decisión de producto

El recorrido infantil es:

1. probar el proyecto en el simulador;
2. elegir **Usar en placa**;
3. conectar y comprobar la placa;
4. si está vacía, tiene otro programa o una versión incompatible, instalar el firmware CapiBloques correspondiente;
5. enviar las reglas y ejecutarlas mediante una única acción.

Las reglas se generan en el navegador. No usan la cola de compilación, no envían el proyecto al servidor y una transferencia incompleta no reemplaza las últimas reglas válidas. Antes de transferir se comprueban placa, versión mínima, ABI, capacidades, tamaño y recursos. Un firmware incompatible no ofrece continuar de todos modos.

## Interfaz entregada

- **Usar en placa** es una acción visible junto a los controles del simulador. Ya no hace falta cambiar un selector global que inutilizaba Paso, Detener y Reiniciar.
- El diálogo presenta tres pasos: **Conectar**, **Preparar** y **Enviar y ejecutar**.
- Una placa sin intérprete puede prepararse directamente, sin provocar primero un error obligatorio.
- **Enviar reglas y ejecutar** sustituye la secuencia manual de dos botones. Pausar, continuar, detener, telemetría y aprovisionamiento Wi-Fi permanecen disponibles después de conectar.
- La instalación explica que reemplaza el programa actual y conserva las tres confirmaciones físicas previas. Al terminar vuelve al recorrido de conexión y reglas.
- Exportar JSON y guardar una copia local siguen a la vista. Fuentes Arduino/ESP-IDF, compilación específica y monitor Serial viven en **Herramientas avanzadas para adultos**. No se borraron sus APIs, permisos, cola, artefactos ni pruebas.

## Compatibilidad y límites

- El firmware intérprete publicado es 1.4.0, ABI 1, para Wemos D1 R32 y DIYmall ESP32-S3 DevKitC N16R8.
- La Waveshare SKU 28117 no se presenta como destino del intérprete mientras su pantalla/controladores no estén cubiertos de manera real.
- Si un proyecto usa una capacidad que el intérprete no declara, se bloquea antes de enviar reglas y se explica la actualización necesaria.
- Web Serial requiere Chrome o Edge de escritorio y HTTPS o localhost. USB pertenece a la PC del navegador, no al servidor.
- Arduino/ESP-IDF específicos siguen siendo una salida válida para diagnóstico, estudio o componentes todavía no cubiertos. Ocultarlos no autoriza retirar compatibilidad.

## Verificación

- `npm run typecheck` y `npm run lint` correctos.
- 22/22 recorridos Chromium afectados correctos: entrada principal a placa, compilación avanzada, USB/monitor, permisos, hash, interrupciones, revocación y diseño móvil.
- Suite smoke completa correcta, incluido `CapiRules`, protocolo `CapiLink`, contrato fuente del intérprete, perfiles, componentes y generadores.
- Build estático correcto con sus diez rutas verificadas; permanece únicamente el aviso conocido de tamaño de chunks.
- Regresión final de experiencia: 7/7 recorridos Chromium correctos, incluido que las herramientas nativas no aparezcan en el menú principal y sí dentro del panel avanzado.

## Aceptación física pendiente

Para cerrar hardware hace falta, en cada placa autorizada: instalar el intérprete desde una placa con otro programa, reconectar, enviar reglas, ejecutar, pausar/detener, reiniciar sin PC, actualizar desde una versión anterior y provocar una transferencia interrumpida. Compilar y empaquetar los artefactos no sustituye esa prueba.
