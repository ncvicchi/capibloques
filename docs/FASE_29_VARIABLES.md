# Fase 29 — Datos, variables y textos dinámicos

Estado: **implementada en software**. Falta únicamente la aceptación física incluida en las fases de placa/componentes; las variables no agregan hardware propio.

## Resultado

La categoría **Datos** incorpora un modelo común para conservar y reutilizar información sin crear un bloque especial para cada destino. Cada variable pertenece al proyecto completo y tiene uno de tres tipos visibles:

- **número**: comienza en `0`, se puede asignar, sumar o restar;
- **texto**: comienza vacío y admite hasta 120 caracteres en ejecución;
- **sí/no**: comienza en `no` y se usa directamente como condición.

Los botones **Crear número**, **Crear texto** y **Crear sí/no** piden un nombre amigable. Blockly conserva su identidad en el JSON aunque el nombre cambie. Los nombres son únicos sin distinguir mayúsculas ni tildes y el servidor acepta como máximo 32 variables por proyecto.

## Valores y expresiones

Los bloques de valor se encastran dentro de acciones, cuentas, comparaciones y textos:

- literales número, texto y sí/no;
- lectura de una variable del tipo correspondiente;
- valor del contador;
- valor de sensor de luz o potenciómetro;
- botón, botones del LCD Keypad y estado Wi-Fi como sí/no;
- último mensaje recibido por un componente **Mensajes**;
- suma, resta, multiplicación y división entera segura —dividir por cero produce `0`—;
- **armar texto**, que concatena valores y convierte números o sí/no a una representación infantil;
- **comparar datos**, con igualdad/desigualdad para tipos iguales y orden sólo para números.

El ejemplo que originó la fase se construye con `armar texto ["El contador está en "] [valor del contador]`. El resultado puede ir a la consola, a **enviar usando Mensajes** o a **escribir en Pantalla de texto**. La entrada dinámica convive con los textos fijos anteriores, por lo que los proyectos existentes no se reescriben.

## Simulación y concurrencia

La pestaña **Estado** muestra las variables por nombre, icono de tipo y valor actual. **Reiniciar** vuelve a `0`, vacío o `no`. El simulador procesa asignaciones y lecturas como instrucciones cooperativas; una asignación termina antes de ceder el turno, también para texto. Los caminos de **Al mismo tiempo** comparten las variables y se ejecutan con el orden determinista del planificador ya documentado en fase 14. No hay variables privadas por hilo ni operaciones de incremento atómicas entre varias instrucciones: para actividades infantiles, cada bloque individual es la unidad indivisible.

El último mensaje de cada componente comienza vacío y cambia solamente después de una recepción válida. Los paquetes dañados y los timeouts no lo reemplazan.

## Firmware y límites

Arduino y ESP-IDF generan la misma semántica:

- números `int32_t` con la saturación vigente del contador;
- booleanos nativos;
- texto en buffers fijos de 121 bytes —120 útiles más terminador—, sin asignación dinámica;
- concatenación y composición para pantallas también acotadas;
- almacenamiento por componente del último mensaje recibido;
- lectura real de GPIO/ADC y estado Wi-Fi cuando la expresión lo solicita.

No se ofrece la posición simulada del robot como dato físico: la Wemos/ESP32 no conoce su posición sin un sensor o sistema de localización. Mostrarla como variable portable haría que navegador y placa mintieran de forma distinta.

## Compatibilidad y validación

El workspace Blockly serializa las variables con `name`, `id` y tipo Blockly (`Number`, `String`, `Boolean`). El programa intermedio usa los tipos `number`, `text` y `boolean`. El importador sigue aceptando proyectos sin `variables`; se interpretan como una lista vacía.

Antes de simular o generar se detectan variables eliminadas, cambios de tipo, sensores o Mensajes inexistentes, cuentas con datos no numéricos, comparaciones incompatibles y asignaciones del tipo incorrecto. El backend permite los nuevos bloques y rechaza tipos desconocidos, identidades/nombres repetidos y más de 32 variables.

## Verificación reproducible

Durante el cierre se verificaron:

- `npm run typecheck` y `npm run lint -- --deny-warnings`;
- `npm run test:smoke`, con variables, composición, comparación y último mensaje recibido;
- `npm run test:idf-driver`, que compila y ejecuta localmente el C++ nativo generado;
- `npx playwright test tests/variables.spec.ts --project=chromium --workers=1 --retries=0`, con creación, importación, ejecución, inspector, texto dinámico y exportación;
- las pruebas unitarias de `backend/tests/test_programming_validation.py` con configuración mínima aislada.

La compilación real completa de Arduino/ESP-IDF se ejecuta una sola vez en CI al cerrar la fase. No sustituye la aceptación física de Wemos, S3, pantallas o Mensajes.
