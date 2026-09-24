# Fase 31 — Procedimientos y funciones

## Estado — 24 de septiembre de 2026

**Implementada en software. Despliegue DEV y aceptación de uso pendientes.**

La categoría **Mis bloques** permite definir y reutilizar:

- una **tarea**, que ejecuta acciones;
- una **función número**, **función texto** o **función sí/no**, que produce un valor reutilizable.

Cada definición tiene nombre y hasta tres datos de entrada tipados. Los datos recibidos son locales a esa llamada y se leen con los bloques `dato recibido 1/2/3`. Las llamadas muestran hasta tres conectores; la validación exige la cantidad y tipos exactos definidos.

## Decisiones

- No hay recursión ni círculos entre llamadas. Se aceptan hasta 24 definiciones, tres parámetros por definición y ocho niveles de llamadas.
- La primera versión no agrega variables locales mutables: los parámetros son valores locales e inmutables. Las variables normales siguen siendo del proyecto y se distinguen visualmente.
- Antes de simular o generar código, las definiciones se expanden a un grafo acotado. Esto conserva una única semántica para simulación, Arduino, ESP-IDF y `CapiRules`, sin pila dinámica en la placa.
- La llamada de una tarea deja marcadores de entrada y retorno con el identificador del bloque de llamada, para que el resaltado vuelva al programa principal.
- Definiciones, llamadas y parámetros forman parte del workspace/JSON, historial, deshacer/rehacer, copiar/pegar y autoguardado existentes.

## Validaciones

- nombres de tarea/función únicos y de hasta 32 caracteres;
- nombres de parámetros únicos dentro de cada definición;
- coincidencia de cantidad y tipo de argumentos;
- coincidencia del tipo devuelto por funciones;
- definición retirada, recursión, ciclos y profundidad excesiva.

## Evidencia

Pasaron typecheck, smoke completo, pruebas de expansión y errores, generación Arduino/ESP-IDF, `CapiRules`, runtime C++ nativo y build estático. Falta prueba de uso exploratoria en DEV con Blockly y chicos/docentes; no es una aceptación física.
