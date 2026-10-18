# Fase 50 — Casa inteligente y entrada segura

Reglas aprobadas antes de implementar; rama `codex/fase-50-casa-entrada-segura`
desde `origin/dev1` en `73ac1b7` (incluye fase 49 integrada). El propietario
integra/actualiza **sólo dev1** con el comando de entrega. No operar servidor,
main/dev2 ni promover. Fases 51–55 no iniciadas.

## Disposición acordada

- Exterior a la izquierda: camino, luz de entrada, timbre y presencia exterior.
- Acceso central: puerta con servo, lector de tarjetas y detector de paso.
- Interior a la derecha, visto desde arriba: habitación con luz, luminosidad,
  presencia interior y botón para pedir salir.
- Pantalla y buzzer opcionales, libres. Luces y botones también se pueden mover
  y agregar: los cuatro asociados al mundo conservan su función por identidad,
  no por cercanía al moverlos. Los adicionales son componentes independientes.
- Puerta, lector y sensores tienen lugares identificados y límites. Nombres
  configurados visibles. Visitantes son actores, no componentes con GPIO.

## Reglas del mundo

1. Llegadas automáticas variables, con tarjeta azul, roja o sin tarjeta. Al
   llegar al punto de espera, cada visitante pulsa el timbre **una sola vez**
   (pulso de 2 s) y presenta su tarjeta si tiene. Espera hasta 20 s simulados;
   si no lo atienden, se retira caminando, sin desaparecer mágicamente.
2. **Una persona en el acceso por vez**. Hasta tres personas en el modelo;
   quienes están dentro permanecen 15–30 s y luego solicitan salir. La salida
   pendiente tiene prioridad cuando queda libre el acceso. No aparece otra
   persona esperando del otro lado mientras se atiende un paso.
3. Presencia exterior/interior indican personas en cada sector. Son entradas
   del programa, no identificación. El PIR real detecta movimiento: mantener
   presencia mientras alguien espera es una simplificación educativa explícita.
4. Lector: `present` y alias `card` (`azul`, `roja`, `ninguna`). **No tiene una
   lista oculta de permisos.** El alumno compara el texto y decide qué acepta.
   Azul sólo es la aceptada por el segundo ejemplo, no una regla del mundo.
5. Puerta: 0° cerrada; 90° o más abierta. Recorrido de 1,2 s, no bloqueante.
   Sólo abre el paso al estar completamente abierta. **Abierta deja pasar a
   quien esté esperando**, tenga o no una tarjeta que el programa considere válida.
6. Quien empezó a cruzar termina aunque se ordene cerrar. El haz de paso queda
   interrumpido mientras la persona cruza: esperar interrumpido y luego libre
   permite cerrar después del paso completo. Cerrar durante el paso deja un
   aviso visible/accesible hasta Reiniciar, no aplasta ni congela personajes.
7. El botón interior pide salir cuando la persona tiene el acceso disponible.
   Permanece pulsado hasta que puede empezar a salir. **Salir no requiere tarjeta**.
   El timbre, lector y detectores nunca abren la puerta por sí mismos.

Límites: cola manual de un visitante pendiente, sin reemplazarlo si se pulsa
repetidamente; llegadas exteriores excedentes no se materializan sobre otras
personas. Actores retirados al salir del encuadre; memoria acotada, azar con
semilla reproducible. No hay reconocimiento real de personas, UID, secretos,
alarmas de intrusión reales ni seguridad certificada para una vivienda.

## Iluminación

Control día/noche y ciclo opcional cada 45 s simulados. Luz natural = 3500 de
día / 300 de noche, escala 0–4095. Sensor exterior mide luz natural, colocado
fuera del haz de la lámpara de entrada. Sensor interior incluye luz natural
**y la lámpara interior**: natural + potencia% × 30, limitado a 4095.

La iluminación es PWM 0–100%. Nada se enciende automáticamente: presencia y
luminosidad llegan a los condicionales del programa. Los ejemplos encienden
al 80% con presencia y luz <1500, apagan si luz >3300 o sin presencia. De noche,
80% produce 2700: no cruza el umbral de apagado y evita realimentación oscilante.
No se simulan unidades lux calibradas: son lecturas analógicas educativas.

## Controles, reloj y JSON

**Estado → Casa virtual** y revisión ofrecen día/noche, ciclo automático,
llegadas automáticas, tipo para envío manual y botón Enviar visitante. Las
llegadas automáticas mezclan los tres tipos; la selección controla el envío
manual. Opciones predefinidas, sin tipear textos en ejecución. Envío pendiente
se indica y evita duplicados. No hay controles manuales competidores para
timbre, salida, tarjeta, presencia, paso o luminosidad ligados al mundo.
Los controles no actúan sobre sensores reales; deshabilitados en espejo de placa.

**Armar escena → Casa al comenzar** conserva las condiciones iniciales con
Guardar/Cancelar/Deshacer/Rehacer. Las pruebas en ejecución son transitorias.
Al compilar al iniciar Simular/Paso se conservan condiciones de prueba y el
visitante pendiente en el mismo mundo; no se depende de que llegue un snapshot
React antes de pulsar. Carga de otro proyecto y Reiniciar no conservan ensayos.
Esto también conserva el ensayo ambiental de la huerta al iniciar, sin guardar
actores/fotogramas ni alterar el proyecto.

Un reloj worker compartido para movimientos, permanencias, puerta, condiciones y bloques:
velocidad escala todo, Pausa congela, Paso avanza el mismo mundo. Reiniciar
vacía la casa y solicitudes, restaura semilla/condiciones iniciales/actuadores
y limpia avisos. Apagar una luz no borra visitantes; Detener no limpia la escena.

JSON aditivo: fondo/plantilla `smartHouse`, `canvas.houseEnvironment` opcional
(día, sin ciclo, llegadas automáticas) y `houseAssignments` opcional para roles
de botones/luces. IDs válidos, únicos y de tipo compatible. Mover conserva rol;
borrar retira su asignación sin reutilizar la identidad; reponer ocupa la función
vacante. Plantilla sobre escena vacía remapea todos los IDs. Proyectos antiguos
de Casa y Entrada segura se conservan. No guardar fotogramas ni visitantes.

## Componentes del ejemplo Wemos

| Función | Componente | Posición x/y | GPIO |
| --- | --- | --- | --- |
| Puerta | Servo | 450/280 | 14 |
| Timbre | Botón, libre | 300/230 | 4 |
| Pedir salir | Botón, libre | 570/230 | 13 |
| Presencia exterior/interior | PIR | 175/230, 755/150 | 34, 35 |
| Paso | Barrera infrarroja | 450/380 | 16 |
| Luminosidad interior/exterior | Luz analógica | 650/150, 65/130 | 36, 39 |
| Luz exterior/interior | LED PWM, libres | 175/130, 860/130 | 26, 27 |
| Tarjeta | PN532 I2C | 340/150 | SDA 18 / SCL 19 |
| Mensajes | LCD 16×2 I2C, libre | 730/475 | SDA 25 / SCL 23 |
| Aviso | Buzzer activo, libre | 235/465 | 17 |

El ejemplo utiliza todos los GPIO escolares disponibles de Wemos. Agregar
componentes sigue permitido, pero puede dejar conexiones pendientes: no inventar
pines ni permitir exportación física inválida. Buses/drivers coexistentes,
alimentación/calibración y niveles se aceptan con maqueta, no por estos tests.

## Dos ejemplos completos

1. **Casa con iluminación automática:** directo. Atiende timbre y salidas,
   espera paso completo y maneja dos luces en paralelo con presencia/oscuridad.
   **Abre a cualquiera que toque el timbre: no verifica identidad.**
2. **Entrada con tarjetas y procedimientos:** acepta texto `azul`; roja y sin
   tarjeta se rechazan con aviso sonoro/mensaje, esperan afuera y se retiran.
   Las salidas se atienden independientemente. Seis procedimientos, cuatro
   pestañas: Principal, Acceso, Avisos y luces, Iluminación. Atender la entrada
   llama a Dejar pasar y cerrar / Avisar y esperar. Cuidar las luces crea dos
   procesos cooperativos que llaman a Iluminar la entrada / habitación.

Ambos son soluciones ejecutables del catálogo, no consignas a completar.

## Verificación y alcance

Modelo puro `lib/house-world.ts`, renderer y controles compartidos; worker
realimenta componentes existentes. Frontend/Django validan el mismo contrato.
Sin nuevas dependencias, migración, firmware, ABI ni compilación SDK.

```powershell
node --experimental-strip-types scripts/house-world.test.mjs
node --experimental-strip-types scripts/simulator-worker-smoke.mjs
npx playwright test tests/house.spec.ts --project=chromium --workers=1
npm run typecheck
npm run lint
npm run test:smoke
npm run build
```

Worker ejecuta ambos workspaces reales con azul/roja/sin tarjeta a 1×/4×:
aceptación/rechazo del programa, salida sin tarjeta, luces, paso sin cierre
prematuro, pausa/paso/reset y bloqueo de entradas manuales. Modelo puro prueba
también programa incorrecto con puerta abierta, retirada, cierre durante paso,
realimentación de luz, determinismo, roles libres y JSON/raíces/generadores/reglas.

Resultados locales: tipos/lint (incluidos renderer y controles nuevos), smoke
completo y build con diez páginas estáticas verificados; diecisiete contratos
backend aprobados y ambos JSON reales frontend→Django aceptados. Tres recorridos
Chromium aprobados: ambos ejemplos con envío previo a Simular, entrada/luz,
paso completo, pausa/reset, y armador con condiciones iniciales/undo/redo/
guardar/cancelar. Capturas inspeccionadas; rótulos nocturnos dentro de las
tarjetas de luces/botones, y visitantes interiores dibujados sin compartir lugar.
Pruebas de software no equivalen a aceptación humana, hardware ni despliegue.

Pendientes: aceptación del propietario e integración dev1; renderer/dinámica
Waveshare y maqueta física. No afirmar que el mundo ya se dibuja en la placa.
Los bloques/lecturas existentes se exportan, pero eso no prueba hardware.

## Entrega sólo dev1

Como `capi` en capi-dev, con el SHA completo entregado:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-50-casa-entrada-segura --commit SHA40
```

Sin `--promote`, sin actualizar main/dev2 ni esperar GitHub Actions. No se
opera el servidor durante esta entrega. Fases 51–55 requieren autorización.
