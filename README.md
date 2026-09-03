# CapiBloques para WEMOS D1 R32

Editor visual educativo para crear programas por bloques, probar su comportamiento en el navegador y generar Arduino C++ para una placa WEMOS D1 R32.

## Ejecutar localmente

Requisitos: Node.js 22.13 o posterior y npm.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Los cambios se actualizan automáticamente.

Para verificar la versión estática de producción:

```bash
npm run build
npx serve dist/client
```

## Qué incluye

- Editor visual Blockly con bucles, condicionales, comparadores y contador.
- Componentes: semáforo, LED con brillo PWM, buzzer activo/pasivo, motor DC con DRV8833, servo, botón, LDR y potenciómetro.
- Ejemplos de semáforo, contador, robot y conexión Wi-Fi.
- Simulador cooperativo en un Web Worker con ejecutar, pausar, paso, detener y velocidad variable.
- Importación y exportación de proyectos JSON versionados.
- Generación y descarga de sketches `.ino` sin esperas bloqueantes.
- Guardado automático sólo en el navegador.
- Sitio completamente estático, sin backend ni cuentas.

## Placa y toolchain

El perfil soportado es WEMOS D1 R32 con Arduino-ESP32 3.3.11:

```text
FQBN: esp32:esp32:d1_uno32
```

Asignación inicial del kit:

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
| LDR                     | A2           |      35 |
| Potenciómetro           | A3           |      34 |

El motor requiere un puente H; el servo y el motor necesitan alimentación apropiada y masa común. La placa trabaja con lógica de 3,3 V. La simulación comprueba el algoritmo, no el circuito eléctrico.

## Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio con rama `main`.
2. En GitHub abre **Settings → Pages**.
3. En **Source**, elige **GitHub Actions**.
4. Haz un push a `main` o ejecuta manualmente el workflow “Publicar CapiBloques en GitHub Pages”.

El workflow construye y publica `dist/client`. La configuración usa rutas relativas compatibles con un subdirectorio de Pages.

## Límites deliberados del MVP

- Simula comportamiento; no emula CPU, radio, tensión, corriente ni tiempos eléctricos.
- No flashea la placa desde el navegador. Descarga un `.ino` para Arduino IDE o Arduino CLI.
- Wi-Fi es simulado y las credenciales nunca se guardan en el JSON; el `.ino` usa `TU_RED` y `TU_CLAVE`.
- Buzzer activo y pasivo comparten D9 como alternativas del kit, no para uso simultáneo.
- El servo se controla por ángulo, no por “potencia”.
- El perfil del motor inicial es DRV8833; otros drivers necesitan su propio adaptador de código y cableado.

## Arquitectura

```text
Blockly → IR tipado → Web Worker (simulación)
                   └→ generador Arduino C++ cooperativo
```

El JSON guarda el workspace y sus IDs; el IR y el código se regeneran. El Worker limita instrucciones y tiempo de CPU por ciclo para que un bucle infinito no congele la interfaz.
