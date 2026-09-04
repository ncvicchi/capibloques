# CapiBloques para WEMOS D1 R32

CapiBloques es un entorno visual educativo para que chicos de 8 a 12 años armen una escena, programen sus componentes con bloques, prueben el comportamiento en el navegador y descarguen Arduino C++ compatible con una WEMOS D1 R32.

Es una aplicación completamente estática: no necesita backend, cuentas ni base de datos y se puede publicar en GitHub Pages.

## Qué se puede construir

Una escena ya no es una pantalla fija. El editor permite partir de cero, repetir una plantilla o mezclar varias. Por ejemplo:

- dos o más semáforos;
- un semáforo junto a un robot;
- varios LED, motores, servos o buzzers independientes;
- entradas como botones, sensores de luz y potenciómetros;
- un nodo Wi-Fi y widgets visuales de contador.

Cada componente se puede agregar, seleccionar, mover, rotar, renombrar, duplicar o eliminar. El editor trabaja sobre un borrador: permite deshacer y rehacer, guardar cambios de un objeto, cancelarlos y salir sin alterar la escena original. También se pueden elegir los GPIO manualmente o usar la asignación automática de pines seguros. El validador señala pines repetidos, incompatibles o faltantes antes de generar el sketch.

Las plantillas prácticas incluidas —semáforo, robot, Wi-Fi y contador— son puntos de partida, no límites. Se pueden añadir varias veces a la misma escena y después personalizarla.

## Programación por bloques

El editor Blockly incluye:

- inicio, esperas, repetición y bucles;
- condicionales, comparadores y lógica;
- contador y mensajes;
- control de semáforos y brillo de LED por PWM;
- movimiento de robot y potencia/dirección de motores;
- posición de servos;
- buzzer activo y notas con buzzer pasivo;
- lectura de botón, sensor de luz y potenciómetro;
- conexión Wi-Fi simulada.

Cuando hay más de un componente del mismo tipo, el bloque muestra un selector con el nombre de la instancia. Así, “Semáforo norte” y “Semáforo sur” pueden ejecutar acciones distintas. Si se elimina un componente usado por un bloque, el editor conserva la referencia para poder corregirla y el generador informa el problema.

Se pueden colocar varios bloques de inicio. Cada uno se convierte en un programa independiente y todos avanzan de forma concurrente. El simulador y el sketch generado usan el mismo orden cooperativo y el mismo presupuesto de instrucciones para que una condición no cambie de resultado al pasar del navegador a la placa.

## Simulación en el navegador

La simulación representa cada instancia de la escena por separado: luces, brillo, motores, robots, servos, buzzers, sensores y estado de Wi-Fi. Los controles permiten ejecutar, pausar, avanzar un paso, detener y cambiar la velocidad.

El motor de simulación corre en un Web Worker con un planificador cooperativo. Las esperas y los distintos programas no bloquean la interfaz, y se aplican límites de instrucciones, mensajes y tiempo por ciclo para que un bucle infinito no congele la página. Las entradas simuladas de sensores, botones y Wi-Fi se conservan al ejecutar o reiniciar. Los sonidos se administran por dispositivo y se detienen al pausar, detener o reiniciar. Se simula el algoritmo y su comportamiento visible; no se emulan la CPU, el radio, la corriente ni los tiempos eléctricos del ESP32.

## Proyectos JSON

Un proyecto exportado usa el esquema JSON v2 e incluye:

- metadatos y nombre del proyecto;
- la escena completa, con posiciones, configuración, instancias y pines;
- el workspace Blockly y los identificadores de sus bloques;
- la velocidad elegida para la simulación.

El programa intermedio y el Arduino C++ se regeneran a partir de esos datos. La aplicación importa proyectos v2 y migra automáticamente los JSON v1 anteriores, incluyendo las escenas predefinidas y las referencias de bloques a su primera instancia compatible. Antes de reemplazar el proyecto, valida el esquema, los tipos e identificadores de bloques, la profundidad y la cantidad de nodos. Una importación dañada se rechaza sin borrar el trabajo abierto.

El guardado automático y el botón **Guardar** quedan solamente en el almacenamiento local del navegador. La exportación JSON sigue siendo la copia transportable. Las credenciales Wi-Fi no se guardan en el proyecto: el sketch generado utiliza los marcadores `TU_RED` y `TU_CLAVE`.

## Ejecutar localmente

Requisitos: Node.js 22.13 o posterior y npm.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. El servidor de desarrollo actualiza la página al guardar cambios.

Comprobaciones disponibles:

```bash
npm run typecheck
npm run lint
npm run test:smoke
npm run test:e2e
npm run build
```

Para probar exactamente los archivos estáticos de producción:

```bash
npx serve dist/client
```

## Generación para WEMOS D1 R32

El destino soportado es WEMOS D1 R32 con el core Arduino-ESP32 3.3.11:

```text
FQBN: esp32:esp32:d1_uno32
```

El generador toma los GPIO de cada instancia de la escena, emite diagnósticos de cableado y crea un sketch `.ino` con un planificador cooperativo. No usa `delay()` para las esperas de los bloques, por lo que un semáforo puede esperar mientras el robot u otro programa continúa avanzando.

El simulador y el sketch avanzan los programas en intervalos lógicos de 16 ms, con un presupuesto acotado de instrucciones por turno para mantener la interfaz y la placa disponibles. El contador usa enteros de 32 bits: al llegar a −2.147.483.648 o 2.147.483.647 se mantiene en el límite, sin desbordarse ni cambiar de signo. La posición inicial configurada del servo también se aplica al encender la placa.

La vista previa del código siempre queda disponible para aprender y corregir problemas. La descarga del `.ino` se habilita sólo cuando no quedan errores de pines o referencias a componentes y se completó la revisión guiada del cableado. La guía reúne en una sola tabla la placa, todos los GPIO, resistencias, drivers, alimentación externa y masa común.

Los bloques de salida digital avanzada también aparecen en la guía, incluso sin componentes en la escena. Agregar o cambiar sus GPIO exige revisar nuevamente las conexiones. Los botones deben usar pull-up interna; los proyectos importados con otra polaridad pueden simularse, pero se bloquea la descarga hasta resolver esa configuración.

La asignación automática usa un conjunto conservador de pines de la Wemos y evita pines de arranque conflictivos para las salidas. Como referencia, el kit original utilizaba:

| Componente              | Header Wemos |    GPIO |
| ----------------------- | ------------ | ------: |
| Semáforo rojo           | D2           |      26 |
| Semáforo amarillo       | D3           |      25 |
| Semáforo verde          | D6           |      27 |
| Motor izquierdo DRV8833 | D4 / D5      | 17 / 16 |
| Motor derecho DRV8833   | D11 / D12    | 23 / 19 |
| LED PWM                 | D13          |      18 |
| Servo                   | D7           |      14 |
| Buzzer activo o pasivo  | D9           |      13 |
| Botón                   | A1           |       4 |
| Sensor de luz (LDR)     | A2           |      35 |
| Potenciómetro           | A3           |      34 |

Esta tabla es sólo un punto de partida. Al combinar varias plantillas, cada salida necesita un GPIO libre y compatible; el editor puede reasignarlos automáticamente.

## Seguridad eléctrica

La WEMOS D1 R32 usa lógica de **3,3 V**. No conectes una señal de 5 V directamente a un GPIO del ESP32.

- Los motores DC deben conectarse mediante un driver o puente H, como el DRV8833; nunca directamente a la placa.
- Motores y servos deben usar una fuente apropiada para su corriente. No los alimentes desde un GPIO.
- Si se usa una fuente externa para motores o servos, su masa (`GND`) debe estar unida a la masa de la Wemos.
- Verifica tensión, corriente, polaridad y datasheet de cada módulo antes de conectarlo.
- La simulación valida el comportamiento lógico y algunos conflictos de pines, pero no puede certificar que el circuito sea eléctricamente seguro.
- El editor admite un buzzer pasivo por sketch. Generar tonos independientes en varios buzzers requiere una asignación explícita de temporizadores LEDC y queda bloqueado para evitar un resultado engañoso.

## Publicar en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy-pages.yml`.

1. Sube el proyecto a un repositorio con rama `main`.
2. En GitHub abre **Settings → Pages**.
3. En **Source**, elige **GitHub Actions**.
4. Haz un push a `main` o ejecuta manualmente el workflow **Publicar CapiBloques en GitHub Pages**.

La acción instala las dependencias, ejecuta pruebas de núcleo y navegador en Chromium, compila dos circuitos de prueba para `esp32:esp32:d1_uno32` que ejercitan todas las operaciones y condiciones del generador, construye el sitio y publica `dist/client`. La construcción corrige las rutas para que funcionen desde el subdirectorio asignado al repositorio en Pages.

Las pruebas de interfaz cubren arrastre de bloques y objetos, guardar/recargar, importación JSON, revisión previa a la descarga, confirmaciones y deshacer/rehacer. Incluyen pantallas de 390×844 y 568×320. Para ejecutar también en Chrome y Edge instalados, en PowerShell:

```powershell
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
npm run test:e2e -- --workers=3
```

## Arquitectura

```text
Escena componible ─┬─> asignación y validación de GPIO
                  └─> instancias disponibles en los bloques

Blockly ─> programa tipado multi-hilo ─┬─> Web Worker de simulación
                                      └─> Arduino C++ cooperativo

Escena + workspace + metadatos ─> proyecto JSON v2
```

La escena describe **qué existe y cómo está conectado**; los bloques describen **qué debe hacer cada instancia**. Mantener esas dos partes separadas permite combinar componentes sin duplicar pantallas ni fijar un único circuito en el código.

## Límites actuales

- La aplicación descarga el `.ino`, pero no flashea la placa desde el navegador.
- Wi-Fi se simula y el usuario completa las credenciales antes de compilar o subir el sketch.
- El perfil de motor generado está pensado para un puente H DRV8833; otros drivers pueden requerir cambios de cableado y código.
- Un servo se controla por posición entre 0° y 180°; la interfaz simplifica los motores y LED a potencia o brillo porcentual.
- La disponibilidad física de GPIO impone un límite: una escena puede simularse aunque todavía tenga conflictos o pines sin asignar, pero no estará lista para descargar al hardware hasta corregirlos.
- El contador es una variable global del programa y la escena admite un único marcador visual para evitar dos pantallas que aparenten ser contadores independientes.
