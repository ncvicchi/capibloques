// Definitions, field normalization and compiler shared by browser and isolated server.
// @ts-expect-error Node strip-types runner.
import { displayTargets } from './display-model.ts';
import type { CompiledProgram, Condition, ProgramNode } from './capiblocks.ts';
import type { SceneDevice, SceneDeviceKind } from './scene-model.ts';
type BlocklyApi = typeof import('blockly');
type BlocklyWorkspaceSvg = import('blockly').WorkspaceSvg;
type BlocklyBlock = import('blockly').Block;
type BlocklyFieldDropdown = import('blockly').FieldDropdown;
type BlocklyMenuOption = import('blockly').MenuOption;

const DEVICE_FIELD = 'DEVICE_ID';
const AREA_FIELD = 'AREA_ID';
const serializedAreaIds = new WeakMap<BlocklyWorkspaceSvg, Map<string, string>>();
const EMPTY_FAVORITES: readonly string[] = [];
const DEVICE_EXTENSION = 'capi_device_target_v2';
const DEVICE_WARNING = 'capi-device-target';
const MISSING_DEVICE_PREFIX = '__missing__:';

const workspaceDevices = new WeakMap<
  BlocklyWorkspaceSvg,
  readonly SceneDevice[]
>();
const serializedDeviceIds = new WeakMap<
  BlocklyWorkspaceSvg,
  Map<string, string>
>();
const registeredBlocklies = new WeakSet<object>();

const deviceLabels: Record<SceneDeviceKind, string> = {
  trafficLight: 'un semáforo',
  robot: 'un robot',
  motor: 'un motor',
  led: 'un LED',
  servo: 'un servo',
  activeBuzzer: 'un buzzer activo',
  passiveBuzzer: 'un buzzer pasivo',
  button: 'un botón',
  lightSensor: 'un sensor de luz',
  potentiometer: 'un potenciómetro',
  wifiNode: 'una conexión Wi-Fi',
  display: 'una pantalla',
};

function targetWorkspaceForBlock(block: BlocklyBlock) {
  const workspace = block.workspace as BlocklyWorkspaceSvg;
  return workspace.targetWorkspace ?? workspace;
}

function acceptedDeviceKinds(block: BlocklyBlock): readonly SceneDeviceKind[] {
  switch (block.type) {
    case 'capi_display_write':
    case 'capi_display_clear': return ['display'];
    case 'capi_traffic':
      return ['trafficLight'];
    case 'capi_led':
      return ['led'];
    case 'capi_robot':
      return ['robot'];
    case 'capi_motor':
      return ['motor'];
    case 'capi_servo':
      return ['servo'];
    case 'capi_buzzer':
      return block.getFieldValue('KIND') === 'PASSIVE'
        ? ['passiveBuzzer']
        : ['activeBuzzer'];
    case 'capi_tone':
      return ['passiveBuzzer'];
    case 'capi_button_pressed':
      return ['button'];
    case 'capi_sensor_compare':
      return block.getFieldValue('SENSOR') === 'POTENTIOMETER'
        ? ['potentiometer']
        : ['lightSensor'];
    default:
      return [];
  }
}

function missingDeviceValue(block: BlocklyBlock) {
  return `${MISSING_DEVICE_PREFIX}${block.type}`;
}

function isMissingDeviceValue(value: string | null | undefined) {
  return !value || value.startsWith(MISSING_DEVICE_PREFIX);
}

function devicesForBlock(block: BlocklyBlock) {
  const workspace = targetWorkspaceForBlock(block);
  const kinds = acceptedDeviceKinds(block);
  return (workspaceDevices.get(workspace) ?? []).filter((device) =>
    kinds.includes(device.kind),
  );
}

function deviceOptions(
  block: BlocklyBlock,
  currentValue?: string | null,
): BlocklyMenuOption[] {
  const workspace = targetWorkspaceForBlock(block);
  const compatible = devicesForBlock(block);
  const options: BlocklyMenuOption[] = compatible.map((device) => [
    device.name,
    device.id,
  ]);
  const restoredValue =
    serializedDeviceIds.get(workspace)?.get(block.id) ?? currentValue;

  if (
    restoredValue &&
    !isMissingDeviceValue(restoredValue) &&
    !options.some((option) => option[1] === restoredValue)
  ) {
    const existing = (workspaceDevices.get(workspace) ?? []).find(
      (device) => device.id === restoredValue,
    );
    options.push([
      existing
        ? `⚠️ ${existing.name} (tipo incompatible)`
        : `⚠️ Dispositivo eliminado (${restoredValue})`,
      restoredValue,
    ]);
  }

  if (options.length) return options;
  const firstKind = acceptedDeviceKinds(block)[0];
  return [
    [
      firstKind ? `⚠️ Agrega ${deviceLabels[firstKind]}` : '⚠️ Sin dispositivo',
      missingDeviceValue(block),
    ],
  ];
}

function deviceMenuGenerator(this: BlocklyFieldDropdown) {
  const block = this.getSourceBlock();
  return block
    ? deviceOptions(block, this.getValue())
    : ([
        ['⚠️ Sin dispositivo', `${MISSING_DEVICE_PREFIX}unknown`],
      ] as BlocklyMenuOption[]);
}

function updateDeviceWarning(block: BlocklyBlock) {
  const value = String(block.getFieldValue(DEVICE_FIELD) ?? '');
  const compatible = devicesForBlock(block).some(
    (device) => device.id === value,
  );
  block.setWarningText(
    compatible ? null : 'Elige un dispositivo que esté colocado en la escena.',
    DEVICE_WARNING,
  );
  if (block.getField(AREA_FIELD)) {
    const device = devicesForBlock(block).find(device => device.id === value);
    const areaId = block.getFieldValue(AREA_FIELD);
    block.setWarningText(device?.kind === 'display' && displayTargets(device.config).some(area => area.id === areaId) ? null : 'Elegí una zona de texto existente en esta pantalla.', 'display-area');
  }
}

function areaMenuGenerator(this: BlocklyFieldDropdown): BlocklyMenuOption[] {
  const block = this.getSourceBlock();
  if (!block) return [['Elegí una pantalla', '__missing_area__']];
  const workspace = targetWorkspaceForBlock(block);
  const deviceId = serializedDeviceIds.get(workspace)?.get(block.id) ?? block.getFieldValue(DEVICE_FIELD);
  const device = devicesForBlock(block).find(device => device.id === deviceId);
  const options: BlocklyMenuOption[] = device?.kind === 'display' ? displayTargets(device.config).map(area => [area.name, area.id]) : [];
  const current = serializedAreaIds.get(workspace)?.get(block.id) ?? this.getValue();
  if (current && current !== '__missing_area__' && !options.some(option => option[1] === current)) options.push([`⚠️ Zona retirada (${current})`, current]);
  return options.length ? options : [['Agregá una zona de texto', '__missing_area__']];
}

function refreshAreaField(block: BlocklyBlock) {
  const field = block.getField(AREA_FIELD) as BlocklyFieldDropdown | null;
  if (!field) return;
  const previous = field.getValue();
  field.setOptions(areaMenuGenerator);
  if (field.getOptions(false).some(option => option[1] === previous)) field.setValue(previous);
  field.forceRerender();
  updateDeviceWarning(block);
}

function refreshDeviceField(block: BlocklyBlock) {
  const field = block.getField(DEVICE_FIELD);
  if (!field || !('setOptions' in field)) return false;
  const dropdown = field as BlocklyFieldDropdown;
  const previous = dropdown.getValue();
  const workspace = targetWorkspaceForBlock(block);
  const compatible = devicesForBlock(block).some(
    (device) => device.id === previous,
  );
  if (previous && !isMissingDeviceValue(previous) && !compatible) {
    const orphaned = serializedDeviceIds.get(workspace) ?? new Map();
    orphaned.set(block.id, previous);
    serializedDeviceIds.set(workspace, orphaned);
  }

  dropdown.setOptions(deviceMenuGenerator);
  const options = dropdown.getOptions(false);
  const nextValue = options.some((option) => option[1] === previous)
    ? previous
    : options[0][1];
  dropdown.setValue(nextValue);
  dropdown.forceRerender();
  refreshAreaField(block);
  updateDeviceWarning(block);
  return previous !== nextValue;
}

function refreshDeviceFields(
  Blockly: BlocklyApi,
  workspace: BlocklyWorkspaceSvg,
) {
  let changed = false;
  Blockly.Events.disable();
  try {
    for (const block of workspace.getAllBlocks(false)) {
      changed = refreshDeviceField(block) || changed;
    }
  } finally {
    Blockly.Events.enable();
  }
  workspace.getToolbox?.()?.refreshSelection();
  return changed;
}

function collectSerializedDeviceIds(value: unknown, fieldName = DEVICE_FIELD) {
  const result = new Map<string, string>();
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== 'object') return;
    const record = candidate as Record<string, unknown>;
    const fields = record.fields;
    if (
      typeof record.id === 'string' &&
      fields &&
      typeof fields === 'object' &&
      typeof (fields as Record<string, unknown>)[fieldName] === 'string'
    ) {
      result.set(record.id, (fields as Record<string, string>)[fieldName]);
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return result;
}

function selectedDeviceId(block: BlocklyBlock) {
  const selected = String(block.getFieldValue(DEVICE_FIELD) ?? '');
  if (!isMissingDeviceValue(selected)) return selected;
  return devicesForBlock(block)[0]?.id ?? missingDeviceValue(block);
}

const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: '★ Favoritos', colour: '#b88412', custom: 'CAPI_FAVORITES' },
    {
      kind: 'category',
      name: 'En paralelo',
      colour: '#F1A51F',
      contents: [{ kind: 'block', type: 'capi_parallel' }],
    },
    {
      kind: 'category',
      name: 'Bucles',
      colour: '#FF7D3B',
      contents: [
        { kind: 'block', type: 'capi_forever' },
        { kind: 'block', type: 'capi_repeat' },
        { kind: 'block', type: 'capi_wait' },
      ],
    },
    {
      kind: 'category',
      name: 'Condiciones',
      colour: '#CF4EB9',
      contents: [
        { kind: 'block', type: 'capi_if' },
        { kind: 'block', type: 'capi_compare' },
        { kind: 'block', type: 'capi_counter_compare' },
        { kind: 'block', type: 'capi_button_pressed' },
        { kind: 'block', type: 'capi_sensor_compare' },
      ],
    },
    {
      kind: 'category',
      name: 'Contador',
      colour: '#6759DF',
      contents: [
        { kind: 'block', type: 'capi_counter_set' },
        { kind: 'block', type: 'capi_counter_change' },
        { kind: 'block', type: 'capi_counter_compare' },
      ],
    },
    {
      kind: 'category',
      name: 'Luces',
      colour: '#12AA8C',
      contents: [
        { kind: 'block', type: 'capi_traffic' },
        { kind: 'block', type: 'capi_led' },
        { kind: 'block', type: 'capi_pin_write' },
      ],
    },
    {
      kind: 'category',
      name: 'Sonido',
      colour: '#EF5F88',
      contents: [
        { kind: 'block', type: 'capi_buzzer' },
        { kind: 'block', type: 'capi_tone' },
      ],
    },
    {
      kind: 'category',
      name: 'Movimiento',
      colour: '#328BDD',
      contents: [
        { kind: 'block', type: 'capi_robot' },
        { kind: 'block', type: 'capi_motor' },
        { kind: 'block', type: 'capi_servo' },
      ],
    },
    {
      kind: 'category',
      name: 'Wi-Fi',
      colour: '#4472CC',
      contents: [
        { kind: 'block', type: 'capi_wifi_connect' },
        { kind: 'block', type: 'capi_wifi_connected' },
      ],
    },
    {
      kind: 'category',
      name: 'Mensajes',
      colour: '#59627D',
      contents: [{ kind: 'block', type: 'capi_serial' }, { kind: 'block', type: 'capi_display_write' }, { kind: 'block', type: 'capi_display_clear' }],
    },
  ],
};

function registerBlocks(Blockly: BlocklyApi) {
  if (!Blockly.Extensions.isRegistered(DEVICE_EXTENSION)) {
    Blockly.Extensions.register(
      DEVICE_EXTENSION,
      function (this: BlocklyBlock) {
        const field = this.getField(
          DEVICE_FIELD,
        ) as BlocklyFieldDropdown | null;
        field?.setOptions(deviceMenuGenerator);
        (this.getField(AREA_FIELD) as BlocklyFieldDropdown | null)?.setOptions(areaMenuGenerator);
        updateDeviceWarning(this);
      },
    );
  }
  if (registeredBlocklies.has(Blockly)) return;

  const deviceField = (label: string) => ({
    type: 'field_dropdown',
    name: DEVICE_FIELD,
    options: [[label, `${MISSING_DEVICE_PREFIX}initial`]],
  });

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'capi_start',
      message0: '⚡ al comenzar',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      colour: '#F1A51F',
      tooltip: 'Aquí empieza tu programa.',
      hat: 'cap',
    },
    {
      type: 'capi_forever',
      message0: '🔁 repetir por siempre',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#FF7D3B',
      tooltip: 'Repite estas acciones y cede tiempo en cada vuelta.',
    },
    {
      type: 'capi_repeat',
      message0: '🔂 repetir %1 veces',
      args0: [
        {
          type: 'field_number',
          name: 'TIMES',
          value: 3,
          min: 0,
          max: 1000,
          precision: 1,
        },
      ],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#FF7D3B',
      tooltip: 'Repite una cantidad exacta de veces.',
    },
    {
      type: 'capi_wait',
      message0: '⏱ esperar %1 segundos',
      args0: [
        {
          type: 'field_number',
          name: 'SECONDS',
          value: 1,
          min: 0,
          max: 86400,
          precision: 0.1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#FF7D3B',
      tooltip: 'Espera sin bloquear otros programas.',
    },
    {
      type: 'capi_if',
      message0: '🧠 si %1',
      args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }],
      message1: 'entonces %1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      message2: 'si no %1',
      args2: [{ type: 'input_statement', name: 'ELSE' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#CF4EB9',
      tooltip: 'Elige un camino según una pregunta.',
    },
    {
      type: 'capi_compare',
      message0: 'comparar %1 %2 %3',
      args0: [
        { type: 'field_number', name: 'LEFT', value: 5 },
        {
          type: 'field_dropdown',
          name: 'OPERATOR',
          options: [
            ['=', 'EQ'],
            ['≠', 'NEQ'],
            ['<', 'LT'],
            ['≤', 'LTE'],
            ['>', 'GT'],
            ['≥', 'GTE'],
          ],
        },
        { type: 'field_number', name: 'RIGHT', value: 3 },
      ],
      output: 'Boolean',
      colour: '#CF4EB9',
      tooltip: 'Compara dos números y responde sí o no.',
    },
    {
      type: 'capi_counter_compare',
      message0: 'contador %1 %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OPERATOR',
          options: [
            ['=', 'EQ'],
            ['≠', 'NEQ'],
            ['<', 'LT'],
            ['≤', 'LTE'],
            ['>', 'GT'],
            ['≥', 'GTE'],
          ],
        },
        {
          type: 'field_number',
          name: 'VALUE',
          value: 5,
          min: -2147483648,
          max: 2147483647,
          precision: 1,
        },
      ],
      output: 'Boolean',
      colour: '#6759DF',
      tooltip: 'Compara el valor actual del contador.',
    },
    {
      type: 'capi_counter_set',
      message0: '🔢 poner contador en %1',
      args0: [
        {
          type: 'field_number',
          name: 'VALUE',
          value: 0,
          min: -2147483648,
          max: 2147483647,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#6759DF',
      tooltip: 'Cambia el valor del contador.',
    },
    {
      type: 'capi_counter_change',
      message0: '➕ cambiar contador en %1',
      args0: [
        {
          type: 'field_number',
          name: 'DELTA',
          value: 1,
          min: -2147483648,
          max: 2147483647,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#6759DF',
      tooltip: 'Suma o resta al contador.',
    },
    {
      type: 'capi_traffic',
      message0: '🚦 poner %1 en %2',
      args0: [
        deviceField('⚠️ agrega un semáforo'),
        {
          type: 'field_dropdown',
          name: 'COLOR',
          options: [
            ['🔴 rojo', 'RED'],
            ['🟡 amarillo', 'YELLOW'],
            ['🟢 verde', 'GREEN'],
            ['apagado', 'OFF'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#12AA8C',
      tooltip: 'Controla los tres LED del semáforo.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_led',
      message0: '💡 %1 con brillo %2 %%',
      args0: [
        deviceField('⚠️ agrega un LED'),
        {
          type: 'field_number',
          name: 'BRIGHTNESS',
          value: 75,
          min: 0,
          max: 100,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#12AA8C',
      tooltip: 'Cambia el brillo con PWM. Usa una resistencia con el LED.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_pin_write',
      message0: 'pin %1 en %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: [
            ['D2 / GPIO 26', '26'],
            ['D3 / GPIO 25', '25'],
            ['D4 / GPIO 17', '17'],
            ['D5 / GPIO 16', '16'],
            ['D6 / GPIO 27', '27'],
            ['D7 / GPIO 14', '14'],
            ['D9 / GPIO 13', '13'],
            ['D11 / GPIO 23', '23'],
            ['D12 / GPIO 19', '19'],
            ['D13 / GPIO 18', '18'],
          ],
        },
        {
          type: 'field_dropdown',
          name: 'STATE',
          options: [
            ['encendido', 'HIGH'],
            ['apagado', 'LOW'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#0D8A75',
      tooltip: 'Control avanzado de una salida digital.',
    },
    {
      type: 'capi_robot',
      message0: '🤖 %1: %2 a %3 %%',
      args0: [
        deviceField('⚠️ agrega un robot'),
        {
          type: 'field_dropdown',
          name: 'ACTION',
          options: [
            ['avanzar', 'FORWARD'],
            ['retroceder', 'BACKWARD'],
            ['girar izquierda', 'LEFT'],
            ['girar derecha', 'RIGHT'],
            ['detener', 'STOP'],
          ],
        },
        {
          type: 'field_number',
          name: 'SPEED',
          value: 70,
          min: 0,
          max: 100,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#328BDD',
      tooltip: 'Controla dos motores mediante un puente H.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_motor',
      message0: '⚙️ %1: %2 con potencia %3 %%',
      args0: [
        deviceField('⚠️ agrega un motor'),
        {
          type: 'field_dropdown',
          name: 'DIRECTION',
          options: [
            ['avanzar', 'FORWARD'],
            ['retroceder', 'BACKWARD'],
            ['detener', 'STOP'],
          ],
        },
        {
          type: 'field_number',
          name: 'POWER',
          value: 70,
          min: 0,
          max: 100,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#328BDD',
      tooltip: 'Controla un motor DC conectado a un puente H.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_servo',
      message0: '🦾 %1 a %2 grados',
      args0: [
        deviceField('⚠️ agrega un servo'),
        {
          type: 'field_number',
          name: 'ANGLE',
          value: 90,
          min: 0,
          max: 180,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#328BDD',
      tooltip: 'Mueve el servo a una posición entre 0 y 180 grados.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_buzzer',
      message0: '📣 %1: %2 durante %3 ms',
      args0: [
        deviceField('⚠️ agrega un buzzer'),
        {
          type: 'field_dropdown',
          name: 'KIND',
          options: [
            ['activo: beep', 'ACTIVE'],
            ['pasivo: nota', 'PASSIVE'],
          ],
        },
        {
          type: 'field_number',
          name: 'DURATION',
          value: 250,
          min: 10,
          max: 10000,
          precision: 10,
        },
      ],
      message1: 'frecuencia %1 Hz (sólo pasivo)',
      args1: [
        {
          type: 'field_number',
          name: 'FREQUENCY',
          value: 660,
          min: 20,
          max: 5000,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#EF5F88',
      tooltip: 'El activo sólo hace beep; el pasivo puede tocar notas.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_tone',
      message0: '🎵 tocar en %1 a %2 Hz durante %3 ms',
      args0: [
        deviceField('⚠️ agrega un buzzer pasivo'),
        {
          type: 'field_number',
          name: 'FREQUENCY',
          value: 660,
          min: 20,
          max: 5000,
          precision: 1,
        },
        {
          type: 'field_number',
          name: 'DURATION',
          value: 180,
          min: 10,
          max: 10000,
          precision: 10,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#EF5F88',
      tooltip: 'Toca una nota con un buzzer pasivo.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_button_pressed',
      message0: '🔘 %1 presionado',
      args0: [deviceField('⚠️ agrega un botón')],
      output: 'Boolean',
      colour: '#CF4EB9',
      tooltip: 'Responde sí cuando el botón está presionado.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_sensor_compare',
      message0: '%1 %2 %3 %4',
      args0: [
        {
          type: 'field_dropdown',
          name: 'SENSOR',
          options: [
            ['☀️ luz', 'LIGHT'],
            ['🎚️ potenciómetro', 'POTENTIOMETER'],
          ],
        },
        deviceField('⚠️ agrega un sensor'),
        {
          type: 'field_dropdown',
          name: 'OPERATOR',
          options: [
            ['<', 'LT'],
            ['≤', 'LTE'],
            ['>', 'GT'],
            ['≥', 'GTE'],
          ],
        },
        {
          type: 'field_number',
          name: 'VALUE',
          value: 2000,
          min: 0,
          max: 4095,
          precision: 1,
        },
      ],
      output: 'Boolean',
      colour: '#CF4EB9',
      tooltip: 'Compara la lectura analógica de un sensor.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_wifi_connect',
      message0: '📶 conectar a Wi-Fi (máximo %1 s)',
      args0: [
        {
          type: 'field_number',
          name: 'TIMEOUT',
          value: 10,
          min: 1,
          max: 60,
          precision: 1,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#4472CC',
      tooltip:
        'Intenta conectar sin congelar el programa. Las claves no se guardan en JSON.',
    },
    {
      type: 'capi_wifi_connected',
      message0: '📶 Wi-Fi conectado',
      output: 'Boolean',
      colour: '#4472CC',
      tooltip: 'Responde sí cuando la conexión está lista.',
    },
    {
      type: 'capi_serial',
      message0: '💬 escribir en consola %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: '¡Hola!' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#59627D',
      tooltip:
        'Escribe un mensaje en el monitor serial y en la consola simulada.',
    },
    {
      type: 'capi_display_write', message0: '📺 en %1 zona %2 escribir %3',
      args0: [deviceField('Elegí una pantalla'), { type: 'field_dropdown', name: AREA_FIELD, options: [['Elegí una zona', '__missing_area__']] }, { type: 'field_input', name: 'TEXT', text: 'Hola, mundo!' }],
      previousStatement: null, nextStatement: null, colour: '#59627D', extensions: [DEVICE_EXTENSION],
      tooltip: 'Reemplaza el texto de este destino, ajustándolo a sus filas y columnas. No lo envía a consola.',
    },
    {
      type: 'capi_display_clear', message0: '🧽 en %1 borrar zona %2',
      args0: [deviceField('Elegí una pantalla'), { type: 'field_dropdown', name: AREA_FIELD, options: [['Elegí una zona', '__missing_area__']] }],
      previousStatement: null, nextStatement: null, colour: '#59627D', extensions: [DEVICE_EXTENSION],
      tooltip: 'Borra solamente el destino elegido. Las otras zonas conservan sus mensajes.',
    },
  ]);
  Blockly.Blocks['capi_parallel'] = {
    init(this: BlocklyBlock) {
      this.appendDummyInput().appendField('🛤 al mismo tiempo:').appendField(new Blockly.FieldDropdown(
        Array.from({ length: 15 }, (_, index) => [`${index + 2} caminos`, String(index + 2)] as [string, string]),
        (value) => {
          const count = Number(value);
          const occupied = this.inputList.some(input => input.name.startsWith('BRANCH') && Number(input.name.slice(6)) >= count && input.connection?.targetBlock());
          if (occupied) {
            this.setWarningText('Primero mové los bloques del camino que querés quitar.', 'parallel-shape');
            return null;
          }
          this.setWarningText(null, 'parallel-shape');
          resizeParallel(this, count);
          return value;
        },
      ), 'BRANCHES');
      resizeParallel(this, 2);
      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#F1A51F');
      this.setTooltip('Todos los caminos empiezan juntos. Lo que sigue debajo espera a que todos terminen. Si un camino repite por siempre, no se sigue debajo.');
    },
    saveExtraState(this: BlocklyBlock) { return { branches: Number(this.getFieldValue('BRANCHES')) || 2 }; },
    loadExtraState(this: BlocklyBlock, state: { branches?: unknown }) {
      if (!Number.isInteger(state.branches) || Number(state.branches) < 2 || Number(state.branches) > 16) throw new Error('Cantidad de caminos no válida.');
      resizeParallel(this, Number(state.branches));
      this.setFieldValue(String(state.branches), 'BRANCHES');
    },
  };
  registeredBlocklies.add(Blockly);
}

function resizeParallel(block: BlocklyBlock, count: number) {
  for (const input of block.inputList.filter(input => input.name.startsWith('BRANCH') && Number(input.name.slice(6)) >= count)) {
    if (input.name.startsWith('BRANCH') && Number(input.name.slice(6)) >= count) block.removeInput(input.name);
  }
  for (let index = 0; index < count; index++) {
    if (!block.getInput(`BRANCH${index}`)) {
      block
        .appendStatementInput(`BRANCH${index}`)
        .appendField(`↓ Camino ${index + 1}`);
    }
  }
  block.setInputsInline(false);
}

/** Repair creation/import/undo in one event group, without clearing history. */
function ensureSingleStart(Blockly: BlocklyApi, workspace: BlocklyWorkspaceSvg) {
  const starts = workspace.getTopBlocks(true).filter(block => block.type === 'capi_start');
  if (starts.length > 16) throw new Error('Este proyecto tiene más de 16 inicios; no se puede convertir sin perder caminos.');
  let start = starts[0];
  if (!start) {
    start = workspace.newBlock('capi_start');
    start.initSvg?.();
    start.render?.();
    start.moveBy(50, 40);
  }
  if (starts.length > 1) {
    const bodies = starts.map(root => root.getInputTargetBlock('DO'));
    bodies.forEach(body => body?.unplug(false));
    const parallel = workspace.newBlock('capi_parallel');
    parallel.setFieldValue(String(starts.length), 'BRANCHES');
    parallel.initSvg?.();
    parallel.render?.();
    start.getInput('DO')!.connection!.connect(parallel.previousConnection!);
    bodies.forEach((body, index) => { if (body) parallel.getInput(`BRANCH${index}`)!.connection!.connect(body.previousConnection!); });
    starts.slice(1).forEach(root => { root.setDeletable(true); root.dispose(false); });
  }
  start.setDeletable(false);
  start.isDuplicatable = () => false;
  // Keep the mandatory header protected; its body remains fully editable.
}

const numberField = (block: BlocklyBlock, name: string, fallback = 0) => {
  const parsed = Number(block.getFieldValue(name));
  return Number.isFinite(parsed) ? parsed : fallback;
};

function compileCondition(block: BlocklyBlock | null): Condition {
  if (!block) return { kind: 'boolean', value: false };
  switch (block.type) {
    case 'capi_counter_compare':
      return {
        kind: 'counter',
        operator: block.getFieldValue('OPERATOR'),
        value: numberField(block, 'VALUE'),
      };
    case 'capi_compare':
      return {
        kind: 'compare',
        operator: block.getFieldValue('OPERATOR'),
        left: numberField(block, 'LEFT'),
        right: numberField(block, 'RIGHT'),
      };
    case 'capi_wifi_connected':
      return { kind: 'wifiConnected' };
    case 'capi_button_pressed':
      return { kind: 'buttonPressed', deviceId: selectedDeviceId(block) };
    case 'capi_sensor_compare':
      return {
        kind: 'sensor',
        deviceId: selectedDeviceId(block),
        sensor: block.getFieldValue('SENSOR'),
        operator: block.getFieldValue('OPERATOR'),
        value: numberField(block, 'VALUE', 2000),
      };
    default:
      return { kind: 'boolean', value: false };
  }
}

function compileStack(first: BlocklyBlock | null): ProgramNode[] {
  const result: ProgramNode[] = [];
  let block = first;
  while (block) {
    const blockId = block.id;
    switch (block.type) {
      case 'capi_start':
        result.push(...compileStack(block.getInputTargetBlock('DO')));
        break;
      case 'capi_parallel':
        result.push({ op: 'parallel', branches: Array.from({ length: numberField(block, 'BRANCHES', 2) }, (_, index) => compileStack(block!.getInputTargetBlock(`BRANCH${index}`))), blockId });
        break;
      case 'capi_forever':
        result.push({
          op: 'repeat',
          count: -1,
          body: compileStack(block.getInputTargetBlock('DO')),
          blockId,
        });
        break;
      case 'capi_repeat':
        result.push({
          op: 'repeat',
          count: numberField(block, 'TIMES', 1),
          body: compileStack(block.getInputTargetBlock('DO')),
          blockId,
        });
        break;
      case 'capi_wait':
        result.push({
          op: 'wait',
          ms: numberField(block, 'SECONDS', 1) * 1000,
          blockId,
        });
        break;
      case 'capi_if':
        result.push({
          op: 'if',
          condition: compileCondition(block.getInputTargetBlock('CONDITION')),
          consequent: compileStack(block.getInputTargetBlock('DO')),
          otherwise: compileStack(block.getInputTargetBlock('ELSE')),
          blockId,
        });
        break;
      case 'capi_counter_set':
        result.push({
          op: 'counterSet',
          value: numberField(block, 'VALUE'),
          blockId,
        });
        break;
      case 'capi_counter_change':
        result.push({
          op: 'counterChange',
          delta: numberField(block, 'DELTA', 1),
          blockId,
        });
        break;
      case 'capi_traffic':
        result.push({
          op: 'traffic',
          deviceId: selectedDeviceId(block),
          color: block.getFieldValue('COLOR'),
          blockId,
        });
        break;
      case 'capi_led':
        result.push({
          op: 'led',
          deviceId: selectedDeviceId(block),
          brightness: numberField(block, 'BRIGHTNESS', 75),
          blockId,
        });
        break;
      case 'capi_pin_write':
        result.push({
          op: 'pin',
          pin: numberField(block, 'PIN', 25),
          value: block.getFieldValue('STATE') === 'HIGH',
          blockId,
        });
        break;
      case 'capi_robot':
        result.push({
          op: 'robot',
          deviceId: selectedDeviceId(block),
          action: block.getFieldValue('ACTION'),
          speed: numberField(block, 'SPEED', 70),
          blockId,
        });
        break;
      case 'capi_motor':
        result.push({
          op: 'motor',
          deviceId: selectedDeviceId(block),
          direction: block.getFieldValue('DIRECTION'),
          power: numberField(block, 'POWER', 70),
          blockId,
        });
        break;
      case 'capi_servo':
        result.push({
          op: 'servo',
          deviceId: selectedDeviceId(block),
          angle: numberField(block, 'ANGLE', 90),
          blockId,
        });
        break;
      case 'capi_buzzer':
        result.push({
          op: 'buzzer',
          deviceId: selectedDeviceId(block),
          kind: block.getFieldValue('KIND'),
          frequency: numberField(block, 'FREQUENCY', 660),
          durationMs: numberField(block, 'DURATION', 250),
          blockId,
        });
        break;
      case 'capi_tone':
        result.push({
          op: 'tone',
          deviceId: selectedDeviceId(block),
          frequency: numberField(block, 'FREQUENCY', 660),
          durationMs: numberField(block, 'DURATION', 180),
          blockId,
        });
        break;
      case 'capi_wifi_connect':
        result.push({
          op: 'wifi',
          timeoutMs: numberField(block, 'TIMEOUT', 10) * 1000,
          blockId,
        });
        break;
      case 'capi_serial':
        result.push({
          op: 'serial',
          text: String(block.getFieldValue('TEXT') ?? ''),
          blockId,
        });
        break;
      case 'capi_display_write':
        result.push({ op: 'displayWrite', deviceId: selectedDeviceId(block), areaId: String(block.getFieldValue(AREA_FIELD) ?? ''), text: String(block.getFieldValue('TEXT') ?? ''), blockId });
        break;
      case 'capi_display_clear':
        result.push({ op: 'displayClear', deviceId: selectedDeviceId(block), areaId: String(block.getFieldValue(AREA_FIELD) ?? ''), blockId });
        break;
    }
    block = block.getNextBlock();
  }
  return result;
}

function compileWorkspace(workspace: BlocklyWorkspaceSvg): CompiledProgram {
  const starts = workspace
    .getTopBlocks(true)
    .filter((block) => block.type === 'capi_start');
  return {
    version: 2,
    threads: starts.map((start) => ({
      id: start.id,
      startBlockId: start.id,
      nodes: compileStack(start),
    })),
  };
}

export { DEVICE_FIELD, AREA_FIELD, EMPTY_FAVORITES, serializedAreaIds, workspaceDevices, serializedDeviceIds, toolbox, collectSerializedDeviceIds, registerBlocks, refreshAreaField, refreshDeviceFields, updateDeviceWarning, ensureSingleStart, compileWorkspace };
