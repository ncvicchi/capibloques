# Fase 56 — Vehículo seguidor de línea

Pedido del propietario: agregar una fase para una escena con líneas predefinidas
o dibujadas por el usuario y pensar actividades complementarias. **Planificación,
no implementación autorizada ni reglas definitivas.** No reemplaza ni amplía
silenciosamente la fase 52; no renumerar fases 53–55 ni iniciar la 53 por este pedido.

## Concepto

Un robot de dos motores sigue una línea porque **su programa interpreta sensores
de suelo y corrige los motores**, no porque el mundo lo enganche al trazado.
Puede perderla, salir, buscarla y recuperarla. Separar:

- Circuito: dibujo y propiedades del suelo.
- Vehículo: movimiento diferencial y contactos.
- Sensores: lecturas donde realmente pasan, montados en el frente inferior.
- Programa: decisiones sobre motores; sin ayuda oculta para completar el circuito.

Reutilizar geometría/reloj/contactos recuperables de fase 52 cuando convenga,
sin cambiar su comportamiento ni confundir sus marcas de color con una línea.

## Propuesta inicial para discutir

Una escena con un solo vehículo. Circuitos de inicio: recta, óvalo, circuito
con curvas amplias y recorrido en S. Abiertos o cerrados; base y orientación
inicial visibles. Línea negra sobre fondo claro, ancho configurable dentro de
un rango que sea compatible con la separación de sensores.

Editor de circuito en modal amplio: lápiz/trazado libre, segmentos rectos,
curvas, seleccionar/mover y borrar tramos, ancho de línea, borrar todo con
confirmación. Deshacer/Rehacer; Guardar y Cancelar aplican al borrador, no
directamente al proyecto. Importar/exportar circuito como parte del JSON portable.
Empezar por trazados vectoriales; imágenes/fotos importadas no son requisito
inicial y necesitarían un análisis de conversión/calibración propio.

El dibujo y la superficie consultada por los sensores deben provenir de la
misma geometría: nada de una línea visible distinta de la que se detecta.
Acotar cantidad de trazos/puntos y simplificar el dibujo sin alterar
excesivamente su forma; acordar límites medibles antes de implementar.
No permitir editar el circuito durante una ejecución.

## Sensores y control: decisión necesaria antes de implementar

Recomendación inicial: barra de **tres sensores reflectivos**, izquierdo,
centro y derecho, con estado amigable «sobre línea / fuera de línea».
Dos sensores pueden ser una variante; cinco/ocho y lecturas analógicas para
control proporcional/PID son posibilidades avanzadas, no alcance aprobado.
Mostrar cada sensor y su lectura sobre el vehículo y en Estado.

**No son la barrera infrarroja emisor/receptor ni el sensor de color existentes.**
Son reflectivos de suelo (por ejemplo familias TCRT5000/QTR, a confirmar según
hardware disponible). Definir perfil, polaridad, separación, altura idealizada,
calibración y umbral; no elegir hardware/driver ni prometer compatibilidad
eléctrica sin conocer el módulo.

El control actual avanzar/girar/detener permite un ejemplo sencillo, pero para
corregir suavemente conviene una orden explícita **motor izquierdo / motor derecho**
con potencias independientes. Evaluar extensión compartida del bloque de robot
y su soporte en simulador, Arduino, ESP-IDF e intérprete. No disfrazar la ausencia
de ese control haciendo que la simulación maneje por su cuenta. Si exige nuevas
capacidades de firmware, versionarlas y mantener compatibilidad de proyectos.

## Reglas a concretar con el propietario

- Detectar línea según posición real de cada sensor y ancho del trazo.
- Suelo sin línea produce lecturas de fuera, no la última lectura válida.
- Sin rebotes, teletransporte ni alineación automática.
- Perder la línea es un estado recuperable: el programa decide buscar,
  detenerse o avisar. Mostrar la causa, no resolverla.
- Un cruce se ve mediante el patrón de sensores; no otorgar orientación
  absoluta ni ruta elegida que un sensor real no podría proporcionar.
- Un reloj compartido para robot, sensores y programa; pausa/Paso/velocidad/reset.
- Reiniciar limpia recorrido, métricas y contactos; conserva circuito guardado.
- Sensores automáticos sin controles manuales competidores. Real/físico y
  virtual deben diferenciarse; simulación ideal no sustituye calibración.
- Vueltas/tiempos son indicadores del mundo. Una línea de meta necesita
  dirección y salida/reentrada para no sumar vueltas repetidas al detenerse.
  Esas métricas no se convierten automáticamente en lecturas de hardware.

## Ideas complementarias para priorizar

1. **Perder y recuperar la línea:** curvas cerradas, salida del trazado y búsqueda.
2. **Circuitos por dificultad:** ancho variable, curvas suaves/cerradas, tramos
   cortos; evitar que dificultad sea sólo velocidad.
3. **Vueltas y checkpoints:** recorrido, mejor tiempo, tiempo fuera de línea y
   contactos. Sin nota automática ni premiar exclusivamente correr más.
4. **Cruces y bifurcaciones:** tomar izquierda/derecha, alternar rutas o elegir
   según contador/mensaje. Distinguir cruces de marcas especiales.
5. **Marcas de parada y estaciones:** franjas transversales o marcas de color,
   con sensor apropiado, espera y señales de llegada programadas.
6. **Obstáculo sobre el recorrido:** sensor de distancia para frenar; rodearlo
   y reencontrar la línea sería una actividad más avanzada.
7. **Tramos sin línea:** memoria del último giro, temporizadores y búsqueda
   limitada, sin seguir un tramo invisible automáticamente.
8. **Velocidad adaptativa:** más lento en curva y más rápido en recta a partir
   de lecturas disponibles, no de conocimiento oculto del dibujo.
9. **Calibración didáctica:** ver claro/oscuro, umbral y contraste. Ruido o
   iluminación variable sólo como modo avanzado explícito y reproducible.
10. **Variantes de control:** decisiones discretas y luego proporcional/PID
    para mayores/docentes, conservando el recorrido básico para 8–12 años.

Todo esto queda como inventario de posibilidades, no como lista aprobada para
implementar de una vez. No incluir varios robots, competición en red o editor
de mundos arbitrarios en la primera entrega sin un pedido específico.

## Orden de trabajo propuesto

1. Acordar disposición/reglas, cantidad/perfil de sensores y alcance inicial.
2. Definir datos portables del circuito y componente reflectivo, compatibilidad
   de firmware y control independiente de ruedas.
3. Implementar mundo y circuitos predefinidos, comprobando lecturas y pérdida/
   recuperación sin piloto automático.
4. Incorporar editor cómodo con undo/redo/guardar/cancelar y JSON acotado.
5. Dos ejemplos completos: seguidor básico por condiciones y solución modular
   con procedimientos/pestañas, incluyendo búsqueda al perder la línea.
6. Verificar modelo, workspaces reales, navegador, persistencia y rendimiento.
   Hardware y renderer Waveshare requieren aceptación específica.

Todos son pasos internos de la **fase 56**, no fases numeradas adicionales.
La prioridad de ejecución puede cambiar con autorización sin renumerarla.
El alta de este documento no instala componentes ni cambia la fase 52 entregada.
