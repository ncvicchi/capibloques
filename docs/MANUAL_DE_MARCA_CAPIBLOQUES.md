# Manual de identidad visual · CapiBloques

**Versión 1.0 · Propuesta derivada del logo de referencia**
Este manual describe una dirección visual propuesta a partir de la ilustración proporcionada. No reemplaza todavía la identidad aplicada en la interfaz del producto.

## 1. Esencia

CapiBloques convierte ideas en construcciones que se pueden probar. La marca combina la calma sociable del carpincho con la curiosidad de los bloques y el rompecabezas. Debe sentirse **cercana, inventiva, serena y confiable**. La personalidad nace del dibujo y de su construcción, no de añadir adornos a cada pieza.

**Idea central:** aprender construyendo, una pieza a la vez.
**Atributos:** cálida, lúdica, clara, paciente, ingeniosa y accesible.
**No debe parecer:** una app genérica de tecnología, un juguete estridente, una marca clínica ni una mascota de caricatura hiperactiva.

## 2. Lectura del símbolo

El isotipo reúne tres ideas inseparables:

1. **Carpincho:** cabeza de perfil orientada hacia la izquierda, hocico ancho y nariz prominente. Las orejas y los ojos cerrados aportan calma y reconocimiento.
2. **Bloque/pieza:** el cuerpo es una única pieza de rompecabezas. Sus entrantes y salientes pertenecen al contorno del cuerpo: no se dibuja un animal separado junto a una pieza.
3. **Movimiento amable:** dos pequeñas marcas turquesas sugieren avance y juego. Son un acento prescindible en los tamaños más pequeños.

La unión entre cabeza y cuerpo debe seguir siendo inmediata. La silueta, el hocico, la expresión y el encastre son invariantes; el color y la disposición del nombre pueden adaptarse.

## 3. Logotipo y variantes

- **Principal:** isotipo encima del nombre. “Capi” en marrón y “Bloques” en turquesa.
- **Horizontal:** isotipo a la izquierda y wordmark a la derecha; mantener una separación aproximada al ancho de una oreja.
- **Isotipo:** sólo carpincho-pieza, para favicon, avatar y espacios cuadrados.
- **Monocromo:** una tinta marrón espresso. Las áreas internas se resuelven con vacío o trama, sin alterar la silueta.
- **Reverso:** símbolo crema sobre fondo espresso o marrón. Reservar el turquesa para superficies claras o para detalles con contraste suficiente.
- **Sin acento:** quitar las dos marcas turquesas si el tamaño o el proceso de impresión las vuelve ruido.

Los archivos SVG de `public/brand/` son recursos iniciales editables. El wordmark SVG usa una familia tipográfica sugerida y dependerá de que la fuente esté disponible; para producción conviene convertir el texto a curvas en el maestro vectorial y revisar el trazo del isotipo con diseño humano.

### Zona de protección y tamaños

Usar como unidad **u**, el grosor del contorno del isotipo en el arte maestro. Dejar al menos **2u** libres alrededor de la marca. No colocar textos, bordes o ilustraciones dentro de esa zona.

- Isotipo digital: mínimo orientativo de 32 px de alto; por debajo, retirar acentos y detalles faciales secundarios.
- Logotipo completo digital: mínimo orientativo de 120 px de ancho.
- Impresión: isotipo mínimo orientativo de 12 mm; logotipo completo, 32 mm de ancho.

Estos mínimos se deben confirmar con pruebas reales de pantalla e impresión antes de fijarlos como especificación de producción.

### Usos incorrectos

- Separar la cabeza de la pieza o convertir el cuerpo en una caja ordinaria.
- Hacer el encastre irreconocible, añadir piezas que oculten el cuerpo o multiplicar personajes.
- Estirar, inclinar o reconstruir la silueta sin conservar sus proporciones.
- Cambiar el contorno oscuro por negro puro en la versión cromática.
- Añadir degradados, sombras, biseles, brillos o volumen 3D al logo principal.
- Usar el turquesa y el ocre en competencia con la cara o el encastre.
- Encerrar el logo en una forma decorativa si no es una aplicación que lo requiera.

## 4. Paleta cromática

Los valores son una traducción digital aproximada de la imagen de referencia; se definen aquí como propuesta de sistema y deben validarse en pantalla e impresión.

| Color | HEX | RGB | Rol |
|---|---|---|---|
| Espresso | `#3A2117` | 58, 33, 23 | Contorno, texto de marca, “Capi” |
| Hocico cacao | `#6A3B27` | 106, 59, 39 | Hocico y acentos cálidos oscuros |
| Carpincho ocre | `#C9803E` | 201, 128, 62 | Masa principal del símbolo |
| Ámbar suave | `#E7A15B` | 231, 161, 91 | Orejas, luces y superficies de apoyo |
| Crema | `#FFF1D6` | 255, 241, 214 | Hocico claro, fondos y reversos |
| Turquesa bloque | `#087E8B` | 8, 126, 139 | “Bloques”, movimiento, acción secundaria |
| Salvia clara | `#B9D2C0` | 185, 210, 192 | Apoyo pedagógico y fondos suaves |
| Blanco | `#FFFFFF` | 255, 255, 255 | Contraste y espacios limpios |

**Proporción sugerida en piezas de comunicación:** crema/blanco 55–70%; ocre/ámbar 18–28%; espresso 8–14%; turquesa 5–10%; salvia hasta 8%. La proporción no es una fórmula rígida para el símbolo: en él manda la referencia.

**Contraste:** usar espresso para texto pequeño sobre crema, blanco o salvia. Evitar texto crema sobre ámbar y texto turquesa fino sobre ocre. Para texto sobre turquesa, comprobar contraste WCAG; preferir blanco en tamaños normales. No comunicar estados sólo mediante color.

## 5. Tipografía

### Recomendación

- **Titulares y marca:** **Nunito Sans ExtraBold/Black (800–900)**. Sus terminales amables acompañan las curvas del carpincho sin convertir la marca en una tipografía infantil ornamental.
- **Texto/UI:** **Nunito Sans Regular/Medium (400–600)**, con interlineado generoso y frases breves.
- **Código y datos técnicos:** una monoespaciada legible como **IBM Plex Mono**; usarla sólo para contenido técnico, nunca para el wordmark.

La ilustración generada no permite identificar con certeza la fuente de su wordmark. Nunito Sans es una recomendación compatible, no una atribución. Para el logo maestro se debe ajustar kerning a mano y convertir el lettering final a curvas. Alternativas accesibles: **Nunito** o **Quicksand** para titulares, manteniendo Nunito Sans para texto largo.

### Jerarquía sugerida

- H1: Nunito Sans ExtraBold, 40–56 px, interlineado 1.05–1.15.
- H2: Bold, 28–36 px, interlineado 1.15.
- H3: Bold, 20–24 px.
- Cuerpo: Regular, 16–18 px, interlineado 1.45–1.65.
- Nota: Regular/Medium, 13–14 px; no bajar de 12 px en interfaces.

Evitar titulares enteros en mayúsculas, tracking negativo extremo, demasiados pesos mezclados y texto largo en turquesa.

## 6. Lenguaje gráfico

### Contorno y forma

El contorno espresso es el gesto que unifica la marca. En ilustraciones, usar línea de grosor consistente, terminales redondeados y curvas firmes. Para componentes de interfaz, preferir radios moderados y claros; no trasladar el trazo grueso del logo a todos los controles.

### Pattern

El patrón combina segmentos de encastre, pequeñas curvas de hocico y puntos turquesa. El archivo `public/brand/capibloques-pattern.svg` es un módulo repetible de 240 × 160. Usarlo a escala grande y baja densidad, normalmente con opacidad de 8–18%; evitar competir con texto o con la marca. No usarlo detrás de pantallas de código o instrucciones densas.

### Ilustración y fotografía

- Ilustraciones: formas vectoriales simples, contornos espresso, masas ocre/crema y pequeños acentos turquesas.
- El carpincho puede aparecer en situaciones de aprendizaje, pero su pose debe apoyar el contenido y no sustituir controles o señales funcionales.
- Fotografía: luz natural, mesas de trabajo reales, materiales y manos construyendo; tonos neutros y cálidos. Evitar saturación excesiva, fondos desordenados y filtros anaranjados fuertes.
- Las imágenes técnicas de placas deben conservar su aspecto y conexiones reales; la identidad gráfica puede enmarcarlas, no alterar su representación.

## 7. Iconografía, componentes y movimiento

- Iconos de trazo uniforme, formas reconocibles y un máximo de dos colores por icono.
- Usar piezas de rompecabezas como acento de marca, no como contenedor automático para cada botón o tarjeta.
- Movimiento: desplazamientos cortos y suaves, como una pieza que encaja; evitar rebotes repetidos o gestos acelerados. Respetar `prefers-reduced-motion`.
- En animaciones del carpincho, conservar cabeza, hocico y relación cabeza-cuerpo; el gesto puede cambiar, la identidad no.

## 8. Voz y tono

**Voz:** cercana, clara, alentadora y paciente. Explica sin infantilizar y trata el error como parte de probar.

- Preferir verbos concretos: “armá”, “probá”, “conectá”, “revisá”.
- Dar una instrucción por vez, con resultado esperado y lenguaje directo.
- Reservar exclamaciones y diminutivos para mensajes puntuales; no hablar como caricatura.
- No prometer que la simulación confirma el funcionamiento eléctrico real.

Ejemplo: “Probá el programa en la escena. Después revisá las conexiones antes de usar la placa.”

## 9. Aplicaciones

- **Favicon/avatar:** isotipo solo, sin wordmark ni marcas de movimiento si se pierden al reducir.
- **Encabezado web:** versión horizontal sobre crema o blanco, con altura que permita reconocer el hocico y el encastre. En espacios pequeños, usar sólo el isotipo, sin reemplazar el avatar personal.
- **Acceso/login:** fondo crema con pattern de encastres muy tenue y movimiento diagonal lento; tarjeta y controles sobre superficies sólidas de alto contraste.
- **Portadas didácticas:** crema como base, título espresso, palabra o acción clave turquesa, una ilustración ocre.
- **Tarjetas y materiales:** fondos limpios, esquinas moderadas, una sola pieza de patrón como acento.
- **Institución/colegio:** el logo CapiBloques identifica el producto; no debe confundirse con los logos institucionales que administra cada colegio.

## 10. Paquete visual inicial

- `public/brand/capibloques-logo.svg`: lockup de marca editable.
- `public/brand/capibloques-isotipo.svg`: símbolo independiente.
- `public/brand/capibloques-pattern.svg`: patrón SVG repetible.
- `docs/brand/identidad-visual-capibloques.png`: lámina de dirección visual.
- `docs/PILOTO_IDENTIDAD_VISUAL_UI.md`: especificación de la primera aplicación en login, favicon y encabezado.

Los vectores de esta primera entrega son una reconstrucción de trabajo basada en la referencia raster, no una vectorización certificada del original. Antes de adoptarlos en producto, revisar los trazados en tamaños pequeños, ajustar la anatomía del encastre y aprobar el maestro con el propietario.
