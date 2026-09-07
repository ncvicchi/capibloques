# CapiBloques para WEMOS D1 R32

CapiBloques es un entorno visual educativo para que chicos de 8 a 12 años armen una escena, programen sus componentes con bloques, prueben el comportamiento en el navegador y descarguen Arduino C++ compatible con una WEMOS D1 R32.

El editor exige ingreso con alias y contraseña. En la VM de desarrollo corren Django + PostgreSQL, el [acceso y sesiones de fase 2A](docs/FASE_2A_ACCESO.md) en `/cuenta/` y el [ABM de usuarios de fase 2B.1](docs/FASE_2B1_USUARIOS.md) en `/gestion/usuarios/`, exclusivo del administrador. Cursos, membresías y proyectos personales se guardan en servidor. La [biblioteca de fase 3A](docs/FASE_3A_BIBLIOTECA.md) se abre con **Mis proyectos** en el editor. El alojamiento elegido es Proxmox; GitHub Pages deja de utilizarse. El frontend permite exportación estática, pero necesita la API del mismo origen. La [fase 4A](docs/FASE_4A_AUTOGUARDADO.md) incorpora autoguardado y [4B.1](docs/FASE_4B1_RECUPERACION.md) recuperación local del proyecto y su envío pendiente. La [fase 4](docs/FASE_4_RECUPERACION_E_HISTORIAL.md) agrega salida en equipos compartidos, continuidad local durante cortes, recuperación de escenas e historial restaurable. Revisión docente visual y ESP-IDF siguen pendientes.

El alcance está en [el plan de implementación](docs/PLAN_MULTIUSUARIO_PROXMOX.md) y el estado de preparación en [fase 0: servidores](docs/FASE_0_SERVIDORES.md). Trabajamos una fase por vez, con pruebas, commit/push y aprobación del propietario antes de avanzar.

La [fase 2B.2](docs/FASE_2B2_COLEGIO.md) incorpora nombre y logo del colegio antes del ingreso. Se configuran desde **Mi cuenta → Configurar colegio**, con vista previa y Guardar/Cancelar, sólo para administradores. Acepta PNG/JPEG/WebP con validación y optimización; nombre e imagen quedan en PostgreSQL y su volumen persistente. No se necesita un logo para ingresar.

La [fase 2B.3](docs/FASE_2B3_CURSOS.md) agrega **Mi cuenta → Gestionar cursos** y **Mis cursos**. El administrador prepara grupos, asigna docentes/alumnos y archiva/reactiva con Guardar/Cancelar. Los alumnos no reciben padrones. Las bajas y cambios de rol incompatibles exigen retirar previamente las membresías.

La [fase 3B](docs/FASE_3B_CURSOS_Y_BAJAS.md) permite al alumno elegir el curso de cada proyecto guardado. Sus docentes asignados pueden listar y descargar esos trabajos desde Mis cursos, sin modificar originales ni acceder a proyectos personales. Duplicar/importar crea una copia personal. Retiradas y archivo se revalidan en servidor; la revisión visual y los comentarios siguen pendientes de fase 5.

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

**Guardar** sube el proyecto a la cuenta. Después del primer guardado confirmado, el **autoguardado al servidor** envía cambios al dejar de editar durante 1,5 segundos (o a los 10 segundos de edición continua, sujeto a pausas). Se puede desactivar en Mis proyectos; la opción se recuerda por cuenta/navegador. Guardar manual sigue disponible. La escena conserva su Guardar/Cancelar; mientras se arma no se sube su borrador.

**Mis proyectos** permite abrir, buscar, renombrar, duplicar, exportar y enviar a una papelera recuperable. Se comprueba la revisión para no pisar cambios de otra pestaña. Importar y cargar un ejemplo crean trabajos independientes; antes de reemplazar cambios se ofrece Guardar, **Conservar copia local y abrir**, Descartar o Cancelar. **Copias en esta computadora** permite recuperar, exportar y quitar con confirmación otros borradores de la misma cuenta. Guardar conserva la operación pendiente en IndexedDB antes de enviarla, para reintentar tras una recarga o reinicio del navegador sin duplicar el envío. No es una cola de todas las acciones: sólo se sincroniza el proyecto abierto. Durante un corte se puede continuar localmente con un proyecto ya cargado y una sesión no vencida, previa elección explícita. Reconectar revalida cuenta y permisos antes de enviar.

La exportación JSON es la copia transportable, sin ID de cuenta o servidor. Los borradores locales no protegen frente a acceso al perfil del navegador. Los borradores anteriores a las cuentas se conservan sin asignar y pueden recuperarse desde Mi cuenta. Las credenciales Wi-Fi no se guardan: el sketch utiliza `TU_RED` y `TU_CLAVE`.

**Armar escena** conserva el inspector y el borrador por separado del proyecto confirmado. Al volver, **Revisar escena pendiente** ofrece recuperarlo; Cancelar lo descarta explícitamente sin publicarlo. **Exportar con escena pendiente** permite transportar ambos en un JSON de recuperación (hasta 4 MiB, proyecto interno de hasta 2 MB); se abre desde Importar JSON como copia personal y ofrece recuperar la escena. El JSON estándar v1/v2 sigue incluyendo sólo la escena confirmada. Detalles y límites en la [guía de fase 4](docs/FASE_4_RECUPERACION_E_HISTORIAL.md).

Límites del servidor: 100 proyectos y 50 MB actuales por cuenta, incluida la papelera, más 50 MB de historial. Se conservan hasta 20 versiones recientes y las referenciadas; puntos manuales y automáticos cada cinco minutos. Papelera protegida 30 días; luego purga individual confirmada desde Historial, sin cron automático en DEV. Recuperación local: 30 copias y 50 MiB por cuenta/origen, sin expulsión automática; el navegador puede imponer un límite menor. Los cambios se agrupan durante 350 ms y el almacenamiento puede perderse: no sustituye un respaldo. Restaurar una versión crea una revisión nueva en el servidor, sin reemplazar el editor abierto. En [3B](docs/FASE_3B_CURSOS_Y_BAJAS.md), la baja administrativa de una cuenta inactiva y sin membresías exige conteo, respaldo ZIP de sus trabajos y confirmaciones. Incluye papelera e historial con sus conteos, pero no contraseñas ni borradores locales; recuperar implica importar los JSON como proyectos nuevos, no restaurar la cuenta original. Desactivar sigue siendo la alternativa sin pérdida de trabajos. [Límites y validación de recuperación](docs/FASE_4B1_RECUPERACION.md).

## Ejecutar localmente

Para el frontend: Node.js 22.13 o posterior y npm. Para ingresar también se necesita Django + PostgreSQL, preparados según la guía de fase 1. Un frontend solo no permite abrir el editor.

```bash
npm install
npm run dev
```

Con la API disponible, definir `CAPIBLOQUES_API_TARGET` con su URL interna antes de iniciar el frontend; Vite expone `/api/` en el mismo origen. Abrir `http://localhost:3000`. El servidor de desarrollo actualiza la página al guardar cambios. No activar bypass de autenticación para probar; las pruebas de contratos UI interceptan la red sólo dentro de Playwright.

Para trabajar en la VM `capi-dev`, seguir [fase 1: entorno completo y recuperación](docs/FASE_1_BASE_REPRODUCIBLE.md). Usa **ambos** archivos `compose.dev.yaml` y `compose.backend.dev.yaml`, más un túnel SSH privado; no exige instalar Node en Ubuntu ni expone DEV en Internet. Desde la PC ya configurada, `.\scripts\connect-dev.ps1` permite abrir `http://localhost:3000` con la aplicación ejecutándose en la VM. Los proyectos confirmados en la cuenta se recuperan desde Mis proyectos en otros navegadores autenticados; la recuperación local y la preferencia de autoguardado pertenecen al navegador/origen. La [fase 0B](docs/FASE_0B_DESARROLLO.md) conserva la evidencia histórica del editor solo.

Si la PC está en la misma LAN que DEV, usar `.\scripts\connect-dev.ps1 -DirectLan`: omite el gateway sin abrir puertos web en la LAN. No iniciar un segundo túnel en un puerto ya ocupado. El procedimiento de actualización de la VM limitada está en [fase 2B.1](docs/FASE_2B1_USUARIOS.md#operación-en-dev).

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

## Integración continua y alojamiento

El workflow `.github/workflows/ci.yml`, **Verificar CapiBloques**, se ejecuta en pushes y pull requests a `main`, y permite ejecución manual.

Verifica tipos, lint, pruebas de núcleo e interfaz en Chromium, auditoría de dependencias, compilación real de dos circuitos Arduino para Wemos D1 R32 y construcción del frontend. Conserva el core Arduino-ESP32 3.3.11.

Este workflow **no publica en GitHub Pages ni en Proxmox** y sólo solicita lectura del repositorio. También valida la configuración Compose de desarrollo. La despublicación de Pages se verifica en la configuración de GitHub; retirar los pasos del workflow por sí solo no elimina un sitio ya publicado. El entorno DEV se ejecuta en la VM autorizada y producción permanece pendiente de su fase. Se conserva por ahora la corrección de rutas relativas del build, sin reestructurar la aplicación durante la preparación de servidores.

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
