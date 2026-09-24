# Fase 39 — Ambiente y medición

Estado: **terminada en software; aceptación física pendiente**.

Se agregaron BME280, humedad de tierra capacitiva, TCS34725, nivel de sonido analógico y agua/lluvia. La interfaz expresa unidades y diferencia lecturas numéricas de estados derivados (`sonido fuerte`, `está mojado`). Sonido sólo representa intensidad: no captura ni conserva audio. Tierra incluye calibración seco/húmedo y sonido/agua incluyen umbral configurable.

Todos los valores se simulan, se guardan/importan y se usan mediante las expresiones comunes. Los generadores conservan tipos y pines; tierra, sonido y agua realizan lectura ADC y cálculo en servicio cooperativo. BME280 y TCS34725 requieren todavía aceptación con el módulo físico exacto antes de considerarlos controladores comprobados.

Pruebas comunes: `npm run test:modules`, smoke, tipos, lint y build.
