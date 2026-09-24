// @ts-expect-error Node strip-types runners need the explicit extension.
import { displayProfiles, type DisplayProfile } from './display-model.ts';
// @ts-expect-error Node strip-types runners need the explicit extension.
import { sceneComponentCatalog, type EducationalModuleDevice, type SceneDevice, type SceneDeviceKind } from './scene-model.ts';
// @ts-expect-error Node strip-types runners need the explicit extension.
import { educationalModuleSpecs, isEducationalModuleKind } from './educational-modules.ts';

export const COMPONENT_HELP_VERSION = 1 as const;
export const ottoHelpProfiles = ['biped4', 'biped4-sound', 'biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'] as const;
export type OttoHelpProfile = typeof ottoHelpProfiles[number];

export type ComponentHelp = {
  helpId: string;
  helpVersion: typeof COMPONENT_HELP_VERSION;
  kind: SceneDeviceKind;
  profile?: string;
  friendlyName: string;
  technicalName: string;
  illustration: { type: 'illustrative'; symbol: string; alt: string };
  summary: string;
  detail: string;
  uses: readonly string[];
  behavior: string;
  capiblocks: string;
  needs: readonly string[];
  care: readonly string[];
  simulator: string;
  firstProgram: readonly string[];
  troubleshooting: readonly { symptom: string; check: string }[];
  limits: string;
  teacher: string;
};

type HelpSeed = Omit<ComponentHelp, 'helpId' | 'helpVersion' | 'kind' | 'profile' | 'friendlyName' | 'illustration'>;

const seed = (
  technicalName: string,
  summary: string,
  behavior: string,
  needs: readonly string[],
  care: readonly string[],
  firstProgram: readonly string[],
  troubleshooting: readonly { symptom: string; check: string }[],
  limits: string,
  teacher: string,
): HelpSeed => ({
  technicalName, summary,
  detail: `${summary} Podés cambiar su configuración en la escena y después usarla en varios bloques sin volver a elegir los cables.`,
  uses: ['Probar una idea en el simulador', 'Construir una reacción visible o medible', 'Combinarlo con condiciones, temporizadores y procedimientos'],
  behavior,
  capiblocks: 'Primero agregalo a la escena y poné un nombre claro. Sus bloques mostrarán ese nombre y sólo las opciones compatibles.',
  needs, care,
  simulator: 'Ejecutá el programa en Simulador. Las entradas tienen controles para probar estados; las salidas cambian en la escena sin usar hardware.',
  firstProgram,
  troubleshooting,
  limits,
  teacher,
});

const commonTrouble = (signal: string) => [
  { symptom: 'No hace nada', check: `Comprobá que el bloque use este componente y que ${signal} coincida con la conexión mostrada abajo.` },
  { symptom: 'Funciona al revés o de forma extraña', check: 'Revisá el perfil, la polaridad y la masa GND común antes de cambiar el programa.' },
];

const seeds: Partial<Record<SceneDeviceKind, HelpSeed>> = {
  trafficLight: seed('Tres LED con resistencias', 'Es un semáforo de tres luces que puede estar rojo, amarillo, verde o apagado.', 'Recibe una orden de color. El estado consultable es la última orden, no una medición de la luz real.', ['Tres LED', 'Tres resistencias de 220–330 Ω', 'Cables'], ['Cada LED necesita su propia resistencia.', 'Conectá con la placa apagada.'], ['Poné “al comenzar”.', 'Elegí verde durante 2 segundos.', 'Cambiá a amarillo y luego a rojo.'], commonTrouble('los GPIO rojo, amarillo y verde'), 'Usa tres salidas. Un color ordenado no confirma que el LED físico encendió.', 'Sirve para conversar sobre estados, secuencias y seguridad vial sin imponer un único desafío.'),
  robot: seed('Robot diferencial con DRV8833', 'Es un robot con dos motores que puede avanzar, retroceder, girar o detenerse.', 'Controla potencia y sentido de dos motores mediante un driver.', ['Chasis con dos motores', 'Driver DRV8833', 'Fuente para motores', 'Cables'], ['Nunca conectes motores directo a un GPIO.', 'Uní GND de la fuente y de la placa.'], ['Avanzá a potencia 40.', 'Esperá 1 segundo.', 'Detené el robot.'], commonTrouble('las cuatro entradas del driver'), 'El simulador muestra movimiento lógico; distancia, piso y batería cambian el resultado físico.', 'Permite trabajar secuencias, estimación, depuración y movimiento por tiempo.'),
  otto: seed('Robot bípedo Otto DIY', 'Es una familia de robots que camina con servos y puede sumar sonido, distancia, cara LED y brazos.', 'Coordina varios servos sin bloquear otros caminos. Las funciones disponibles dependen del perfil.', ['Piezas Otto', '4 o 6 microservos', 'Fuente de 5 V adecuada', 'Opcionales según perfil'], ['No alimentes todos los servos desde la placa.', 'Calibrá centros con el robot levantado y una persona adulta.'], ['Mandalo a posición inicial.', 'Caminá una vez.', 'Mostrá una sonrisa si el perfil tiene cara.'], commonTrouble('los servos y la calibración del perfil'), 'Sólo están implementados los cinco perfiles indicados; Ninja y Wheels siguen pendientes.', 'Es útil para descomponer movimientos en procedimientos y comparar sensores con decisiones.'),
  motor: seed('Motor DC con canal DRV8833', 'Es un motor de corriente continua con control de sentido y potencia.', 'Dos señales al driver eligen dirección y potencia PWM.', ['Motor DC', 'Driver DRV8833', 'Fuente externa', 'Cables'], ['Nunca conectes el motor directo a la placa.', 'Uní las masas GND.'], ['Giralo hacia adelante al 35%.', 'Esperá 1 segundo.', 'Poné potencia 0.'], commonTrouble('IN1 e IN2 del driver'), 'La potencia es una orden; no mide las vueltas reales.', 'Introduce dirección, signo, potencia y la diferencia entre ordenar y medir.'),
  led: seed('Diodo emisor de luz', 'Es una luz pequeña cuyo brillo se puede regular.', 'Una salida PWM enciende el LED por pulsos muy rápidos para cambiar el brillo aparente.', ['LED', 'Resistencia de 220–330 Ω', 'Cables'], ['La pata larga suele ser positiva, pero confirmalo en el componente.', 'Nunca omitas la resistencia.'], ['Encendé con brillo 30%.', 'Esperá medio segundo.', 'Subí a 100%.'], commonTrouble('la polaridad y el GPIO de señal'), 'El color se elige para la escena; un LED común no puede cambiar su color físico.', 'Es una salida inmediata para explicar porcentaje, PWM y secuencias.'),
  servo: seed('Servomotor posicional', 'Es un pequeño motor que apunta a un ángulo.', 'Recibe pulsos PWM y trata de mantener una posición entre 0° y 180°.', ['Servo compatible', 'Fuente de 5 V adecuada', 'Cables'], ['La señal va al GPIO; la potencia del servo va a una fuente adecuada.', 'Uní GND y evitá forzar el brazo.'], ['Movelo a 30°.', 'Esperá 1 segundo.', 'Movelo a 120°.'], commonTrouble('señal, 5 V y GND'), 'El ángulo mostrado es el solicitado; un servo común no informa su posición real.', 'Permite hablar de ángulos, límites y mecanismos.'),
  activeBuzzer: seed('Zumbador activo', 'Es un emisor que hace un tono fijo cuando se enciende.', 'Su oscilador está dentro del componente: la placa sólo lo enciende o apaga.', ['Buzzer activo o módulo', 'Cables', 'Transistor si el módulo consume demasiado'], ['Confirmá polaridad y corriente.', 'No lo confundas con un buzzer pasivo.'], ['Encendelo 200 milisegundos.', 'Esperá.', 'Repetí tres veces.'], commonTrouble('la polaridad y la señal'), 'Produce un tono propio; no sirve para elegir notas musicales.', 'Ayuda a diferenciar evento, duración y repetición.'),
  passiveBuzzer: seed('Zumbador pasivo PWM', 'Es un emisor con el que la placa puede crear notas distintas.', 'La frecuencia PWM determina la altura del sonido y la duración indica cuánto suena.', ['Buzzer pasivo o módulo', 'Cables', 'Transistor si hace falta'], ['Confirmá corriente y polaridad.', 'Usá duraciones cortas para probar.'], ['Tocá una nota de 440 Hz.', 'Esperá un poco.', 'Tocá una nota más aguda.'], commonTrouble('la señal PWM'), 'La afinación y el volumen dependen del buzzer real.', 'Sirve para explorar frecuencia, patrones y melodías con procedimientos.'),
  button: seed('Pulsador digital', 'Es una entrada que informa si está presionada o libre.', 'Con pull-up interno, al presionarlo normalmente une la entrada con GND.', ['Pulsador', 'Cables'], ['Conectalo a GND si usás pull-up.', 'No apliques más de 3,3 V al GPIO.'], ['Si está presionado, encendé un LED.', 'Si no, apagalo.'], commonTrouble('el GPIO y GND'), 'Un pulsador real puede rebotar durante unos milisegundos.', 'Es la entrada más simple para practicar condiciones y eventos.'),
  infraredBarrier: seed('Sensor fotoeléctrico digital', 'Detecta si un objeto interrumpe un haz infrarrojo.', 'Entrega sólo dos estados: libre o interrumpida. La polaridad se configura una vez en la escena.', ['Emisor y detector o sensor fotoeléctrico', 'Fuente indicada por el modelo', 'Cables'], ['La entrada del ESP32 nunca debe superar 3,3 V.', 'Confirmá la salida exacta del detector.'], ['Si la barrera se interrumpe, soná el buzzer.', 'Si queda libre, apagalo.'], commonTrouble('la salida digital y el nivel de interrupción'), 'No entrega una distancia ni un valor analógico.', 'Permite trabajar conteo de objetos, estados y falsos disparos.'),
  lightSensor: seed('Fotoresistencia LDR con divisor', 'Mide un nivel de luz como número.', 'El divisor resistivo convierte la luz en un valor analógico entre 0 y 4095.', ['LDR o módulo analógico', 'Resistencia/divisor si corresponde', 'Cables'], ['La señal debe quedar entre 0 y 3,3 V.', 'Los números cambian según el sensor y el ambiente.'], ['Mostrá el valor en una pantalla o consola.', 'Encendé un LED si baja de un límite.'], commonTrouble('la salida analógica'), 'No mide lux calibrados; entrega una lectura relativa.', 'Es útil para observar datos, umbrales y calibración.'),
  potentiometer: seed('Potenciómetro analógico', 'Es una perilla que produce un número según su posición.', 'Sus extremos van a 3,3 V y GND; el terminal central entrega de 0 a 4095.', ['Potenciómetro', 'Tres cables'], ['Usá 3,3 V, no 5 V, en la entrada.', 'Identificá el terminal central.'], ['Leé la perilla.', 'Usá el número para cambiar el brillo de un LED.'], commonTrouble('el terminal central y el GPIO analógico'), 'La lectura puede variar un poco aunque no muevas la perilla.', 'Conecta una magnitud física con variables, escalas y PWM.'),
  wifiNode: seed('Radio Wi‑Fi integrada del ESP32', 'Permite crear una red o conectarse a una y enviar mensajes a otras placas.', 'Usa mensajes identificados con control de integridad y timeout. La placa receptora decide qué acción realizar.', ['Una placa ESP32', 'Otra placa o red para comunicarse'], ['La contraseña se configura en forma privada y no se guarda en el proyecto.', 'No uses datos personales como nombre de placa.'], ['Elegí Crear red en una placa y Conectarse en otra.', 'Agregá pares y mensajes.', 'Enviá un mensaje y creá tres caminos al recibir.'], commonTrouble('el rol, nombre de red, identidad y mensaje'), 'La simulación no reproduce alcance o interferencia. La entrega UDP no tiene confirmación automática.', 'Sirve para sistemas distribuidos sencillos, identidad, timeout y protocolos.'),
  display: seed('Pantalla LCD/OLED/TFT', 'Muestra texto y, en perfiles gráficos, dibujos sencillos.', 'El bus y el tamaño dependen del perfil. Las animaciones corren sin bloquear; Esperar animación sincroniza cuando hace falta.', ['Pantalla del perfil elegido', 'Cables o shield', 'Adaptación de nivel/fuente cuando corresponda'], ['Confirmá el perfil antes de cablear.', 'No alimentes la retroiluminación desde un GPIO.'], ['Escribí “¡Hola!”.', 'Esperá 1 segundo.', 'Mostrá otro mensaje o dibujo.'], commonTrouble('el perfil, bus y pines'), 'Cada proyecto admite una sola salida visual: pantalla o matriz LED.', 'Permite trabajar comunicación, diseño de interfaz y áreas de texto.'),
  ledMatrix: seed('Matriz 32 × 8 con 4 MAX7219', 'Es un panel de 256 luces para texto, píxeles y dibujos.', 'Cuatro módulos encadenados reciben datos, reloj y selección. El orden físico se configura en la escena.', ['Cuatro módulos MAX7219 8 × 8', 'Fuente de 5 V adecuada', 'Cables'], ['No la alimentes desde un GPIO.', 'Uní GND y revisá cuál extremo recibe DIN.'], ['Mostrá un dibujo.', 'Iniciá un texto en movimiento.', 'Usá Esperar animación sólo si el siguiente paso depende de ella.'], commonTrouble('DIN, CLK, CS y el orden de módulos'), 'El texto está limitado a 32 caracteres y hay una sola salida visual por proyecto.', 'Sirve para coordenadas, patrones binarios y animación cooperativa.'),
  messages: seed('Enlace serie UART con trama protegida', 'Envía y recibe textos por dos cables entre equipos.', 'Agrega cabecera, tamaño, CRC y cierre para detectar mensajes incompletos o dañados.', ['Dos equipos a 3,3 V', 'Cables TX, RX y GND'], ['Cruzá Enviar con Recibir.', 'Usá la misma velocidad en ambos equipos y GND común.'], ['Creá una lista de mensajes.', 'Enviá uno.', 'Al recibir, separá igual, distinto y timeout.'], commonTrouble('TX/RX cruzados, GND y velocidad'), 'Por ahora admite texto y hasta dos componentes Mensajes por proyecto.', 'Introduce comunicación confiable, validación y casos de error.'),
  smartLights: seed('WS2812B / SK6812 RGB direccionables', 'Son una cadena de luces en la que cada punto puede tener un color diferente.', 'Una sola señal DIN envía los colores en orden. Pueden formar una tira, un aro o una matriz.', ['Tira, aro o matriz compatible', 'Fuente externa adecuada', 'Cables y masa común'], ['Nunca alimentes una tira grande desde el GPIO.', 'Conectá datos a DIN, no a DOUT.', 'Calculá corriente antes de elegir la fuente.'], ['Elegí 8 luces.', 'Mostrá un color.', 'Probá arcoíris sin detener otro camino.'], commonTrouble('DIN, GND, orden RGB/GRB y alimentación'), 'La corriente indicada es una estimación. WS2811 y RGBW requieren otros perfiles.', 'Permite trabajar color, coordenadas, listas y animación cooperativa.'),
};

const displayNotes: Record<DisplayProfile, Pick<HelpSeed, 'technicalName' | 'summary' | 'needs' | 'limits'>> = {
  lcd1602keypad: { technicalName: 'LCD Keypad Shield 16 × 2 paralelo', summary: 'Muestra 2 líneas de 16 caracteres y suma cinco botones leídos por una entrada analógica.', needs: ['LCD Keypad Shield compatible', 'Headers/cables según montaje'], limits: 'Perfil paralelo con botones RIGHT, UP, DOWN, LEFT y SELECT. Confirmado funcional como hardware del propietario; falta aceptación integral del firmware.' },
  lcd1602: { technicalName: 'LCD HD44780 16 × 2 con PCF8574 I2C', summary: 'Muestra 2 líneas de 16 caracteres usando sólo SDA y SCL.', needs: ['LCD 16 × 2', 'Backpack PCF8574', 'Cables'], limits: 'Dirección usual 0x27, pero puede variar. Sólo texto.' },
  lcd2004: { technicalName: 'LCD HD44780 20 × 4 con PCF8574 I2C', summary: 'Muestra 4 líneas de 20 caracteres usando SDA y SCL.', needs: ['LCD 20 × 4', 'Backpack PCF8574', 'Cables'], limits: 'Dirección usual 0x27, pero puede variar. Sólo texto.' },
  ssd1306: { technicalName: 'OLED SSD1306 128 × 64 I2C', summary: 'Es una pantalla gráfica pequeña, nítida y sin retroiluminación.', needs: ['Módulo SSD1306 I2C 128 × 64', 'Cables'], limits: 'Perfil I2C 128 × 64, dirección usual 0x3C. No representa otras resoluciones SSD1306.' },
  ili9341: { technicalName: 'TFT ILI9341 320 × 240 SPI', summary: 'Es una pantalla gráfica a color de 320 × 240 píxeles.', needs: ['Módulo ILI9341 SPI', 'Fuente/retroiluminación según módulo', 'Cables'], limits: 'No usa touch ni MISO en este perfil. La imagen es ilustrativa hasta validar el módulo exacto.' },
  ili9488: { technicalName: 'TFT ILI9488 480 × 320 SPI', summary: 'Es una pantalla gráfica a color de 480 × 320 píxeles.', needs: ['Módulo ILI9488 SPI', 'Fuente/retroiluminación según módulo', 'Cables'], limits: 'No usa touch ni MISO en este perfil. La imagen es ilustrativa hasta validar el módulo exacto.' },
  waveshare5: { technicalName: 'Waveshare ESP32-S3 Touch LCD 5 SKU 28117', summary: 'Es la pantalla táctil integrada de 800 × 480 píxeles de esta placa. Puede mostrar mensajes o un tablero de hasta seis objetos.', needs: ['Waveshare SKU 28117'], limits: 'Perfil exclusivo de esa placa. El tablero controla estados lógicos: no conecta salidas físicas ni convierte los conectores externos en GPIO genéricos. Cada objeto puede pasar a Manual y volver al último estado del Programa.' },
};

const ottoNotes: Record<OttoHelpProfile, { name: string; summary: string; limits: string }> = {
  biped4: { name: 'Otto bípedo de 4 servos', summary: 'Camina y baila con dos piernas y dos pies.', limits: 'No incluye sonido, distancia, cara ni brazos.' },
  'biped4-sound': { name: 'Otto bípedo con sonido', summary: 'Suma un buzzer a los cuatro servos.', limits: 'No incluye distancia, cara ni brazos.' },
  'biped4-explorer': { name: 'Otto explorador', summary: 'Suma sonido y sensor ultrasónico para medir distancia.', limits: 'No incluye cara LED ni brazos.' },
  'biped4-expressive': { name: 'Otto expresivo', summary: 'Suma sonido, distancia y una matriz MAX7219 como cara.', limits: 'Usa cuatro servos y no incluye brazos.' },
  'humanoid6-expressive': { name: 'Otto humanoide expresivo', summary: 'Suma dos brazos al Otto expresivo para usar seis servos.', limits: 'Necesita más alimentación y seis canales PWM.' },
};

function profileOf(device?: SceneDevice) {
  if (device?.kind === 'display') return device.config.profile;
  if (device?.kind === 'otto') return device.config.profile;
  if (device && isEducationalModuleKind(device.kind)) return (device as EducationalModuleDevice).config.profile;
  return undefined;
}

export function componentHelp(kind: SceneDeviceKind, device?: SceneDevice): ComponentHelp {
  const catalog = sceneComponentCatalog.find(item => item.kind === kind)!;
  const profile = profileOf(device);
  let value = seeds[kind];
  if (!value && isEducationalModuleKind(kind)) {
    const spec = educationalModuleSpecs[kind];
    value = seed(spec.profiles.map(item => item.label).join(' / '), spec.description, `Entrega ${spec.values.map(item => item.label).join(', ')} para usar en condiciones, variables y mensajes.`, spec.needs, spec.cautions, ['Agregalo a la escena y asigná sus pines.', 'Probá sus valores desde el simulador.', 'Usá “valor de componente” dentro de una condición.'], commonTrouble(spec.pins.map(item => item.label).join(', ')), 'La simulación usa valores educativos. El resultado físico depende de calibración y del módulo exacto.', `Permite explorar ${spec.values.map(item => item.label).join(', ')} con datos visibles y decisiones.`);
  }
  if (!value) throw new Error(`Falta ayuda para ${kind}`);
  let friendlyName = catalog.name;
  if (kind === 'display' && profile) {
    const note = displayNotes[profile as DisplayProfile];
    value = { ...value, ...note };
    friendlyName = displayProfiles[profile as DisplayProfile].name;
  } else if (kind === 'otto' && profile) {
    const note = ottoNotes[profile as OttoHelpProfile];
    value = { ...value, technicalName: note.name, summary: note.summary, limits: note.limits };
    friendlyName = note.name;
  }
  return {
    ...value,
    helpId: `component.${kind}${profile ? `.${profile}` : ''}`,
    helpVersion: COMPONENT_HELP_VERSION,
    kind,
    ...(profile ? { profile } : {}),
    friendlyName,
    illustration: { type: 'illustrative', symbol: catalog.icon, alt: `Ilustración de ${friendlyName}; no es una fotografía ni certifica el pinout.` },
  };
}

export function allComponentHelp(): ComponentHelp[] {
  const base = sceneComponentCatalog.map(item => componentHelp(item.kind));
  const displays = Object.keys(displayProfiles).map(profile => componentHelp('display', { kind: 'display', config: { profile }, } as SceneDevice));
  const ottos = ottoHelpProfiles.map(profile => componentHelp('otto', { kind: 'otto', config: { profile }, } as SceneDevice));
  return [...base, ...displays, ...ottos];
}
