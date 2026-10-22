# Fase 54 — Teatro interactivo de Otto

Reglas aprobadas antes de implementar el 18 de octubre de 2026. Rama
`codex/fase-54-teatro-otto`, desde origin/dev1 `6c9a985`. Sólo entrega de rama:
no integrar ni actualizar main/dev2 ni operar servidores.

## Disposición y propósito

Lienzo 960 × 540, escenario fijo con cortinas y público frontal. Un Otto en
(480,210), un botón de petición en (760,360), hasta cuatro espectadores en
un único grupo. Los lugares funcionales son fijos, independientemente del
nombre/ID. Se pueden quitar y renombrar los componentes; no se recrean solos.
Luces/pantallas adicionales conservan límites y conexiones habituales.

La plantilla usa Otto expresivo de cuatro servos, ultrasonido, cara matricial,
buzzer y una luz PWM. Esa única luz deja pines válidos para el botón con
pull-up interno en Wemos; no se agregan GPIO imaginarios ni brazos a ese perfil.
Otros perfiles conservan sus capacidades: sin ultrasonido no reciben distancia
del público; sin matriz no aparece una cara programable; sin brazos no se ofrecen
poses. Cambiar el perfil exige adaptar el programa/conexiones normalmente.

Es coreografía, no navegación, equilibrio, caídas ni desplazamiento espacial
del bípedo. No comparte la física de la pista de robots. La animación de baile
no demuestra estabilidad de servos ni compatibilidad mecánica de un Otto real.

## Público y entradas

- Un grupo llega, se aproxima, se acomoda, espera y finalmente se retira,
  incluso si el programa no responde. No se acumula una cola de espectadores.
- Modo automático reproducible: primera llegada a 1,2 s; grupos de 1–4 personas;
  separación de 4–8 s después de retirarse. No se sortean personas cada frame.
- Aproximación desde 180 cm a 40 cm/s; retirada a 50 cm/s hasta salir a 220 cm.
  Cercanía configurable 20–100 cm, permanencia 12–40 s. Ambos valores se fijan
  al llegar el grupo: cambios posteriores preparan el siguiente, no mueven al actual.
- Distancia representa la persona frontal más cercana de forma idealizada;
  ausencia devuelve 400 cm en este mundo. Sólo alimenta el Otto con ultrasonido.
  No inventa orientación 3D ni lecturas de equilibrio.
- En automático, el grupo pide actuación 4,5 s después de acomodarse. Petición
  es una pulsación de **2 s simulados** del botón existente, no una orden de baile.
- En Estado: Llega público, Se retira el público y Pedir actuación. La llegada
  manual usa 1–4 personas configuradas. Petición sólo con público acomodado y
  sin pulso vigente; repetirla no acumula eventos. El programa puede ignorarla.
- No hay sliders ni pulsaciones manuales competidores para distancia/botón
  vinculados al teatro, tampoco desde SET_INPUT por ID. Revisión docente ofrece
  los mismos ensayos. El espejo de placa no habilita esos mandos como hardware.

El mundo **no** saluda, baila, cambia cara, cuenta ni prende luces por el alumno.
Todas esas decisiones están en los bloques. Grupos/peticiones no se guardan en
JSON como estado de ejecución ni representan personas reales identificables.

## Coordinación de Otto

Un movimiento corporal por Otto. Si otro camino pide mover, volver a reposo
o cambiar brazos, espera su turno FIFO; no interrumpe el movimiento vigente.
Cara y sonido son independientes: pueden cambiar durante la coreografía.
Un nuevo sonido reemplaza el vigente; no se crea una cola de audio.

El simulador muestra «Esperando su turno para mover a Otto» en el camino que
espera. Cola nativa/intérprete acotada a 32 caminos (techo del intérprete);
sin asignaciones dinámicas para cada petición y sin descartar una orden al
llenarse: el solicitante vuelve a intentar. Reset/Stop limpian turnos.
No confundir esta coordinación corporal con una cola de espectáculos: los
ejemplos admiten una sola actuación por grupo mediante su propia lógica.

Esta corrección también alcanza HOME, que antes podía cortar otro movimiento,
y se comparte entre salidas Arduino/ESP-IDF e intérprete. Runtime mínimo
**1.9.1**, ABI/formato de reglas 1 intactos. Una placa con 1.9.0 debe actualizar
el intérprete antes de recibir reglas. El actualizador construye el firmware
una vez y conserva los objetos incrementales; no se compila por proyecto.

## Dos ejemplos completos

En Proyecto → Ejemplos:

1. **Otto: saludar y actuar.** Secuencial: reposo/cara dormida/contador cero;
   espera público a menos de 60 cm, saluda, espera petición con público cerca,
   baila dos ciclos y salta, cambia cara/sonido, vuelve a reposo y suma una
   actuación. Espera liberación del botón y retirada por encima de 80 cm antes
   de admitir otra. Si se retiran sin pedir, se despide sin actuar.
2. **Teatro de Otto con procedimientos.** Mismo comportamiento, seis tareas:
   Atender al público, Esperar la petición, Saludar, Hacer actuación, Despedirse,
   Iluminar escenario. Cuatro pestañas: Principal, Público, Actuación, Ambiente.
   Principal lanza atención y luz en paralelo. Un único camino maneja el cuerpo;
   el otro alterna brillo de la luz sin competir por el mismo actuador.

Ambos traen público/peticiones automáticas para que funcionen al pulsar Simular.
Son soluciones completas, no desafíos sin resolver. Los procedimientos siguen
en un workspace común; pestañas sólo organizan raíces. Exportación/importación,
reglas y ambos generadores usan ese mismo programa.

Los umbrales 60/80 son deliberados y editables. Elegir cercanía de 100 cm impide
el saludo con esos umbrales; no se corrige el algoritmo a escondidas. En hardware,
la ausencia de eco del controlador Otto actual puede entregar 0 cm, no los 400 cm
del mundo: la aceptación física debe validar/adaptar ese tratamiento; no se promete
que el público virtual equivalga a un ultrasonido real en todos los casos.

## Reloj, edición y persistencia

Público, peticiones, movimientos y programa usan el reloj worker: pausa,
velocidad y Paso afectan todo. Reiniciar restaura condiciones iniciales,
público vacío, contador, cara/cuerpo y turnos. Detener no borra la escena.
Antes de Simular/Paso se conserva el ensayo ambiental y una llegada pendiente
al recargar internamente el mismo proyecto; no se heredan actores de otro.

Armar escena → Público al comenzar usa el borrador normal con
Guardar/Cancelar/Deshacer/Rehacer. En Estado las pruebas son transitorias.
`canvas.theaterEnvironment?` tiene exactamente automaticArrivals, count,
distance y staySeconds; ausente usa defaults. background/sourceTemplate y
simulation.scene añaden ottoTheater. Validación estricta frontend/backend,
sin migración de base ni dependencias nuevas.

## Evidencia y pendientes

Pruebas específicas:

```powershell
node --experimental-strip-types scripts/theater-world.test.mjs
node --experimental-strip-types scripts/otto-queue.test.mjs
npx playwright test tests/theater.spec.ts --project=chromium --workers=1
```

Modelo puro, JSON de ambos ejemplos, slots/perfiles, determinismo, límites,
snapshot del próximo grupo y generación Arduino/IDF/reglas. Worker ejecuta los
dos workspaces reales a 1×/4×, automático/manual, una actuación por grupo,
luces paralelas, pausa/reset y FIFO DANCE → SWING → JUMP con HOME sin preempción.
Host g++ con -Wall -Wextra -Werror prueba el header compartido, 32 entradas,
duplicados y reset. Contratos Django, empaquetado/versión, entornos, reanudación
y caché incremental; tres recorridos Chromium, incluyendo guardar/cancelar/undo/redo.
Resultados generales finales en CONTEXTO_PARA_CONTINUAR.md.

Pendiente: actualización de dev1 por propietario; aceptación visual/infantil,
servos/matriz/sonar físicos, SDK completo 1.9.1 y renderer/dinámica de público
en Waveshare. Compilar la cola en host o generar fuentes no demuestra que todo
el firmware haya sido compilado con ESP-IDF ni probado en una placa.

## Actualizar sólo dev1

Como capi en capi-dev, reemplazando SHA40 por el SHA entregado:

```bash
cd /home/capi/capibloques
git fetch --quiet origin codex/fase-54-teatro-otto &&
git show origin/codex/fase-54-teatro-otto:scripts/update-dev.sh | bash -s -- --env dev1 --branch codex/fase-54-teatro-otto --commit SHA40
```

Se usa el script de esta rama porque el instalado puede tener una versión anterior.
El script ejecuta el manager de la revisión exacta, temporalmente y bajo el mismo
bloqueo, sin reinstalar herramientas compartidas ni tocar servicios de main/dev2.
El manager lee la versión del main.cpp de cada release: no etiqueta 1.9.1 a un
firmware viejo de dev2. Contratos prueban reutilización de bundles 1.9.0 y1.9.1.

Sin --promote, sin tocar main/dev2. No necesita esperar GitHub Actions. La primera
actualización incluye el intérprete 1.9.1 incremental; no borrar objetos/cachés.
