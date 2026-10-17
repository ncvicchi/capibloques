# Fase 46 — Peatones del cruce escolar

Ajuste posterior del 17 de octubre: un único aviso para auto–auto y auto–peatón,
con icono de precaución, tipo de choque, escena detenida e instrucción idéntica
de reinicio. Ambos marcan a los involucrados; el peatón conserva su dibujo de
pie y recibe un aro de énfasis, sin lesiones ni caída. El mundo sigue congelado
hasta reiniciar en los dos casos. Prueba de navegador cubre ambos choques,
marcas, ausencia de movimiento posterior y limpieza al reiniciar.
Verificación del ajuste: tres recorridos Chromium aprobados, tipos/lint y
regresión pura de mundos/peatones aprobados. No se compiló firmware ni se
actualizó DEV para esta corrección.

Autorización: 17 de octubre de 2026. Entrega de simulación web; no modifica
firmware, ABI, backend, esquema JSON, credenciales ni migraciones. Plan padre:
[PLAN_MUNDOS_INTERACTIVOS.md](PLAN_MUNDOS_INTERACTIVOS.md).

## Uso

1. Elegir Cruce con tránsito y agregar/seleccionar un semáforo.
2. En Armar escena activar «Cartel para peatones: caminar o no caminar».
   El inspector explica qué paso (norte/este/sur/oeste) controla. Guardar los
   cambios de inspector y escena con el recorrido habitual.
3. Programar el bloque de cartel peatonal del semáforo elegido. «Persona
   caminando» habilita; «persona quieta» y apagado hacen esperar.
4. Detener el tráfico incompatible y dar tiempo a que despeje antes de habilitar
   peatones. Agregar esperas o temporizadores: finalizar inmediatamente el
   programa también detiene el reloj de la escena.
5. Simular. El paso muestra nombre del semáforo y «Cruzar/Esperar», no sólo un
   color. Sin cartel activado no hay población peatonal en ese paso.

Cada cartel controla el paso del lado de su esquina, no todos los pasos ni un
permiso inferido de la luz vehicular. El segundero vehicular sólo informa; se
corrigió el texto antiguo del inspector que aún anunciaba alto/avanzar para
autos: el cartel vehicular sigue siendo únicamente número de 0 a 9.

## Modelo y garantías

- Cuatro sendas sobre el fondo del cruce. Personas vectoriales en ambas veredas
  con llegadas variables reproducibles, alternancia por paso y salida efectiva.
- OFF/no caminar no admiten cruces nuevos. Una vez iniciado, el peatón termina
  aunque el cartel se cierre. No se borra población al apagar el semáforo.
- Hasta 16 personas, máximo cuatro por paso; los que esperan forman grupos
  separados por dirección en la vereda. No hay creación sin límite.
- Autos conservan sus reglas, filas, orientación y límite. Peatones y autos
  comparten tiempo escalado y subpasos de hasta 100 ms para no saltar una
  coincidencia a velocidad alta. Una interrupción de navegador se acota a 2 s
  recuperados por llamada para evitar trabajo sin límite.
- Pausar detiene ambos; Reiniciar programa y escena limpia actores, accidentes,
  contadores de llegada y semilla. Apagar una señal no es reiniciar.
- Conflicto sólo por coincidencia espacial de un auto y una persona que cruza,
  no por tener señales incompatibles sin actores. Se congela el mundo y aparece
  aviso accesible, sin atropello gráfico, indicando el paso y cómo reiniciar.
- Los autos no frenan automáticamente por peatones: el programa debe coordinar
  permisos y despeje. Un auto correctamente detenido en la línea roja no
  provoca un falso conflicto con su senda (prueba de los cuatro accesos).
- Los actores son transitorios: no se agregan componentes, GPIO, datos de niños
  ni fotogramas al JSON/autoguardado. Se usa la opción existente del cartel.

No se agrega asociación automática de botón peatonal: el botón existente sigue
siendo una entrada atendida por el programa, no un cambio de señal encubierto.

## Verificación

Pruebas puras integradas en `scripts/scene-worlds.test.mjs`: permisos de cuatro
pasos y ambas direcciones, espera, cierre durante cruce, destrucción, población,
azar reproducible, reloj 4×, pausa, conflicto espacial, vereda segura y autos en
línea roja. Se conserva la regresión previa de autos/semáforos.

Recorridos `tests/pedestrians.spec.ts`: importación real, paso asociado,
OFF/espera/WALK, pausa sin deriva, reinicio y conflicto causado por un programa
real. La prueba acelerada instala su reloj antes de cargar la página para
controlar requestAnimationFrame; no sustituye el modelo en la app.
Captura revisada visualmente y aumento de rótulos/personas para legibilidad.

Estado de pruebas y publicación se registra en el contexto vivo al cerrar.
Aceptación con alumnos/docente y DEV quedan pendientes del propietario.

## Alcance de placa y pendientes

Waveshare aún no dibuja esta población ni sus conflictos: no se afirma paridad
de actores ni telemetría física por mostrar el espejo web. Se mantiene el
firmware actual y su renderer de autos, sin recompilar por esta entrega. El
portado y aceptación física se conservan explícitos en el plan de mundos y en
la convergencia visual de fase 45. Las fases 47–55 siguen sólo planificadas.

Actualización DEV por el propietario:

```bash
cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast
```
