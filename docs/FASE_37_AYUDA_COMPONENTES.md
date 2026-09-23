# Fase 37 — Ayuda infantil de componentes

**Estado:** planificada, no autorizada ni implementada.

## Objetivo

Cada componente y perfil físico tendrá ayuda contextual, completa y comprensible para chicos de 8 a 12 años: qué es, para qué sirve, cómo se usa y simula, cómo se conecta, qué elementos necesita y cómo resolver problemas frecuentes.

## Contenido obligatorio por componente/perfil

1. **Nombre e identidad:** nombre infantil, nombre técnico y diferencias con componentes parecidos.
2. **Qué es:** explicación breve con vocabulario cotidiano y una segunda capa opcional algo más técnica.
3. **Para qué sirve:** usos concretos y ejemplos propios, sin presentar un montaje como única aplicación.
4. **Cómo funciona:** entradas, salidas, estados y valores que puede producir o recibir.
5. **Cómo aparece en CapiBloques:** controles de escena, bloques disponibles, simulación y estados visibles.
6. **Qué necesitás:** componente exacto, placa compatible, cables, resistencia/driver/fuente y piezas auxiliares.
7. **Cómo conectarlo:** tabla de señales y guía visual sobre la placa seleccionada, sincronizada con los pines reales del proyecto.
8. **Alimentación y cuidados:** tensión, corriente estimada, masa común, fuente externa, polaridad y advertencias específicas expresadas sin alarmismo.
9. **Fotografía:** imagen propia/licenciada del modelo exacto cuando esté validado. Una imagen ilustrativa se etiqueta como tal y nunca certifica pinout o compatibilidad.
10. **Variantes/perfiles:** cómo reconocerlos y qué cambia entre ellos; no mezclar I2C, SPI, paralelo, activo/pasivo, RGB/RGBW u otras revisiones.
11. **Probalo en el simulador:** control sencillo para observar entradas/estados antes de usar hardware.
12. **Primer programa:** ejemplo mínimo que demuestra una capacidad, copiable como proyecto personal sin reemplazar el actual silenciosamente.
13. **Problemas frecuentes:** síntomas, causas probables y comprobaciones seguras —pin equivocado, DIN/DOUT, dirección I2C, polaridad, alimentación, perfil u orden físico—.
14. **Límites y compatibilidad:** placas/perfiles verificados, recursos reservados, cantidades máximas medidas y lo todavía no probado.
15. **Ayuda para docentes:** objetivos posibles, vocabulario y preguntas orientadoras en una capa separada de la explicación infantil.

## Puntos de acceso

- Tarjeta del catálogo antes de agregar.
- Inspector de la escena para la instancia configurada.
- Guía de conexiones y conflictos.
- Ayuda contextual desde bloques que usan el componente.
- Mensajes de error/indisponibilidad con enlace a la sección exacta, no a una portada genérica.
- Ficha imprimible o exportable sin datos del alumno.

La ayuda abre sin perder cambios, posición del editor ni ejecución. En móvil, teclado y lector de pantalla funciona como diálogo/panel navegable con cierre y retorno de foco correctos.

## Modelo y mantenimiento

Cada perfil referencia `helpId` y `helpVersion`. El contenido estructurado separa resumen, conexiones, imágenes, bloques, requisitos, seguridad, problemas y fuentes. Las imágenes se versionan localmente con licencia/procedencia, texto alternativo y resolución optimizada; no se enlazan desde comercios que puedan cambiarlas.

La ayuda deriva nombres de instancia, pines, placa y conflictos del proyecto actual. No duplica manualmente datos eléctricos que ya viven en el perfil sin una fuente común. Una modificación de pinout/perfil exige actualizar y probar su ayuda antes de publicar el soporte.

## Lenguaje para 8–12 años

- Frases cortas y una idea por párrafo.
- Ilustraciones acompañadas por texto; nunca sólo color o flechas.
- Término cotidiano primero y técnico entre paréntesis cuando ayuda.
- Pasos numerados y verificaciones observables.
- Sin infantilizar, asustar ni ocultar un riesgo real.
- Capas «En pocas palabras», «Conectalo», «Probalo» y «Quiero saber más».
- Glosario contextual para pin, señal, alimentación, tierra/masa, entrada, salida, digital, analógico, PWM, I2C, SPI y otros términos usados.

## Pruebas y aceptación

- Todos los componentes/perfiles publicados tienen ficha; una comprobación automática impide publicar uno sin ayuda válida.
- Fotografía exacta/ilustrativa, placa, perfil, señales, pines y auxiliares coinciden con fuentes y hardware identificado.
- Cambiar placa o pines actualiza la guía sin recargar ni conservar conexiones anteriores.
- Un chico puede agregar, simular y cablear un ejemplo básico siguiendo la ficha con supervisión prevista; las pruebas de comprensión verifican vocabulario y pasos, no memoria literal.
- Docentes pueden profundizar sin llenar la vista infantil de detalles avanzados.
- Teclado, lector de pantalla, móvil, texto ampliado, contraste, impresión y movimiento reducido están cubiertos.
- Enlaces, imágenes, licencias y texto alternativo se validan en CI; no hay recursos remotos frágiles ni datos privados.
- La ayuda declara con honestidad qué fue compilado, simulado y probado físicamente.

