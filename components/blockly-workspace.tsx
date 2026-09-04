'use client';

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { CompiledProgram, Condition, ProgramNode } from '@/lib/capiblocks';
import type { SceneDevice, SceneDeviceKind } from '@/lib/scene-model';

type BlocklyApi = typeof import('blockly');
type BlocklyWorkspaceSvg = import('blockly').WorkspaceSvg;
type BlocklyBlock = import('blockly').Block;
type BlocklyFieldDropdown = import('blockly').FieldDropdown;
type BlocklyMenuOption = import('blockly').MenuOption;

export interface BlocklyWorkspaceHandle {
  save(): Record<string, unknown>;
  load(data: Record<string, unknown>): void;
  compile(): CompiledProgram;
  highlight(blockIds?: string | readonly string[]): void;
  undo(): void;
  redo(): void;
  zoomToFit(): void;
}

export interface BlocklyHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface BlocklyWorkspaceProps {
  initialWorkspace: Record<string, unknown>;
  revision: number;
  devices: readonly SceneDevice[];
  onChange: (workspace: Record<string, unknown>) => void;
  onBlockSnap?: () => void;
  onError?: (message: string) => void;
  onHistoryChange?: (state: BlocklyHistoryState) => void;
}

const DEVICE_FIELD = 'DEVICE_ID';
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
};

function targetWorkspaceForBlock(block: BlocklyBlock) {
  const workspace = block.workspace as BlocklyWorkspaceSvg;
  return workspace.targetWorkspace ?? workspace;
}

function acceptedDeviceKinds(block: BlocklyBlock): readonly SceneDeviceKind[] {
  switch (block.type) {
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
  workspace.getToolbox()?.refreshSelection();
  return changed;
}

function collectSerializedDeviceIds(value: unknown) {
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
      typeof (fields as Record<string, unknown>)[DEVICE_FIELD] === 'string'
    ) {
      result.set(record.id, (fields as Record<string, string>)[DEVICE_FIELD]);
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
    {
      kind: 'category',
      name: 'Inicio',
      colour: '#F1A51F',
      contents: [{ kind: 'block', type: 'capi_start' }],
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
      contents: [{ kind: 'block', type: 'capi_serial' }],
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
        { type: 'field_number', name: 'VALUE', value: 5 },
      ],
      output: 'Boolean',
      colour: '#6759DF',
      tooltip: 'Compara el valor actual del contador.',
    },
    {
      type: 'capi_counter_set',
      message0: '🔢 poner contador en %1',
      args0: [{ type: 'field_number', name: 'VALUE', value: 0, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: '#6759DF',
      tooltip: 'Cambia el valor del contador.',
    },
    {
      type: 'capi_counter_change',
      message0: '➕ cambiar contador en %1',
      args0: [{ type: 'field_number', name: 'DELTA', value: 1, precision: 1 }],
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
      message0: '💬 mostrar %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: '¡Hola!' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#59627D',
      tooltip:
        'Escribe un mensaje en el monitor serial y en la consola simulada.',
    },
  ]);
  registeredBlocklies.add(Blockly);
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

function loadWorkspaceData(
  Blockly: BlocklyApi,
  workspace: BlocklyWorkspaceSvg,
  data: Record<string, unknown>,
) {
  const previous = Blockly.serialization.workspaces.save(workspace) as Record<
    string,
    unknown
  >;
  const previousDeviceIds = serializedDeviceIds.get(workspace) ?? new Map();
  serializedDeviceIds.set(workspace, collectSerializedDeviceIds(data));
  Blockly.Events.disable();
  workspace.setResizesEnabled(false);
  try {
    workspace.clearUndo();
    workspace.clear();
    Blockly.serialization.workspaces.load(data, workspace);
    workspace.clearUndo();
  } catch (error) {
    workspace.clear();
    serializedDeviceIds.set(workspace, previousDeviceIds);
    try {
      Blockly.serialization.workspaces.load(previous, workspace);
    } catch {
      workspace.clear();
    }
    workspace.clearUndo();
    throw error;
  } finally {
    workspace.setResizesEnabled(true);
    Blockly.Events.enable();
  }
  refreshDeviceFields(Blockly, workspace);
  workspace.zoomToFit();
  Blockly.svgResize(workspace);
}

function historyState(workspace: BlocklyWorkspaceSvg): BlocklyHistoryState {
  return {
    canUndo: workspace.getUndoStack().length > 0,
    canRedo: workspace.getRedoStack().length > 0,
  };
}

function blockAccessibilityLabel(block: BlocklyBlock) {
  const description = block
    .toString()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return `Bloque: ${description || 'bloque vacío'}`;
}

function refreshBlockAccessibility(workspace: BlocklyWorkspaceSvg) {
  for (const block of workspace.getAllBlocks(false)) {
    const root = block.getSvgRoot();
    const path = root?.querySelector<SVGElement>('.blocklyPath');
    if (!path) continue;
    path.setAttribute('role', 'img');
    path.setAttribute('aria-label', blockAccessibilityLabel(block));
  }
}

function readableLoadError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return detail
    ? `No pudimos abrir esos bloques (${detail}). El programa anterior sigue intacto.`
    : 'No pudimos abrir esos bloques. El programa anterior sigue intacto.';
}

const BlocklyWorkspace = forwardRef<
  BlocklyWorkspaceHandle,
  BlocklyWorkspaceProps
>(function BlocklyWorkspace(
  {
    initialWorkspace,
    revision,
    devices,
    onChange,
    onBlockSnap,
    onError,
    onHistoryChange,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<BlocklyWorkspaceSvg | null>(null);
  const blocklyRef = useRef<BlocklyApi | null>(null);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialWorkspaceRef = useRef(initialWorkspace);
  const revisionRef = useRef(revision);
  const appliedRevisionRef = useRef<number | null>(null);
  const devicesRef = useRef(devices);
  const onChangeRef = useRef(onChange);
  const onBlockSnapRef = useRef(onBlockSnap);
  const onErrorRef = useRef(onError);
  const onHistoryChangeRef = useRef(onHistoryChange);
  const highlightedBlockIdsRef = useRef(new Set<string>());
  const keyboardStatusRef = useRef<HTMLOutputElement>(null);
  const [ready, setReady] = useState(false);
  const deviceSignature = JSON.stringify(
    devices.map(({ id, kind, name }) => [id, kind, name]),
  );

  useEffect(() => {
    initialWorkspaceRef.current = initialWorkspace;
    revisionRef.current = revision;
    devicesRef.current = devices;
    onChangeRef.current = onChange;
    onBlockSnapRef.current = onBlockSnap;
    onErrorRef.current = onError;
    onHistoryChangeRef.current = onHistoryChange;
  }, [
    devices,
    initialWorkspace,
    onBlockSnap,
    onChange,
    onError,
    onHistoryChange,
    revision,
  ]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrame: number | undefined;
    let keyboardHost: HTMLDivElement | null = null;
    let activateKeyboardNavigation: ((event: KeyboardEvent) => void) | null =
      null;
    let deactivateKeyboardNavigation: (() => void) | null = null;
    let announceBlocklyFocus: ((event?: FocusEvent) => void) | null = null;
    void Promise.all([import('blockly'), import('blockly/msg/es')]).then(
      ([Blockly, spanish]) => {
        if (disposed || !hostRef.current) return;
        blocklyRef.current = Blockly;
        const spanishMessages = { ...spanish } as Record<string, unknown>;
        delete spanishMessages.default;
        Blockly.setLocale(spanishMessages as Record<string, string>);
        registerBlocks(Blockly);
        const theme = Blockly.Theme.defineTheme('capi-theme', {
          name: 'capi-theme',
          base: Blockly.Themes.Classic,
          componentStyles: {
            workspaceBackgroundColour: '#f8f9ff',
            toolboxBackgroundColour: '#ffffff',
            toolboxForegroundColour: '#273155',
            flyoutBackgroundColour: '#f2f4ff',
            flyoutForegroundColour: '#273155',
            flyoutOpacity: 1,
            scrollbarColour: '#aeb5d2',
            insertionMarkerColour: '#6257e8',
            insertionMarkerOpacity: 0.35,
            cursorColour: '#6257e8',
          },
          fontStyle: {
            family: 'Inter, Segoe UI, sans-serif',
            weight: '600',
            size: 13,
          },
        });
        const workspace = Blockly.inject(hostRef.current, {
          toolbox,
          theme,
          renderer: 'zelos',
          trashcan: true,
          move: { scrollbars: true, drag: true, wheel: true },
          zoom: {
            controls: true,
            wheel: true,
            startScale: 0.9,
            maxScale: 1.6,
            minScale: 0.45,
            scaleSpeed: 1.12,
            pinch: true,
          },
          grid: { spacing: 22, length: 2, colour: '#d9dced', snap: false },
          sounds: false,
        });
        workspaceRef.current = workspace;
        workspaceDevices.set(workspace, devicesRef.current);
        try {
          loadWorkspaceData(Blockly, workspace, initialWorkspaceRef.current);
        } catch (error) {
          onErrorRef.current?.(readableLoadError(error));
        }
        refreshBlockAccessibility(workspace);
        appliedRevisionRef.current = revisionRef.current;
        onChangeRef.current(
          Blockly.serialization.workspaces.save(workspace) as Record<
            string,
            unknown
          >,
        );
        workspace.addChangeListener((event) => {
          if (event.isUiEvent) return;
          if (event.type === Blockly.Events.BLOCK_MOVE && event.recordUndo)
            onBlockSnapRef.current?.();
          if (event.type === Blockly.Events.BLOCK_CHANGE) {
            const change = event as typeof event & {
              blockId?: string;
              element?: string;
              name?: string;
            };
            if (
              change.element === 'field' &&
              change.name === DEVICE_FIELD &&
              change.blockId
            ) {
              serializedDeviceIds.get(workspace)?.delete(change.blockId);
              const block = workspace.getBlockById(change.blockId);
              if (block) updateDeviceWarning(block);
            }
            if (
              change.element === 'field' &&
              (change.name === 'KIND' || change.name === 'SENSOR')
            ) {
              refreshDeviceFields(Blockly, workspace);
            }
          }
          if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
          changeTimerRef.current = setTimeout(() => {
            if (!workspaceRef.current) return;
            refreshBlockAccessibility(workspaceRef.current);
            onChangeRef.current(
              Blockly.serialization.workspaces.save(
                workspaceRef.current,
              ) as Record<string, unknown>,
            );
            onHistoryChangeRef.current?.(historyState(workspaceRef.current));
          }, 180);
        });
        activateKeyboardNavigation = (event: KeyboardEvent) => {
          if (
            event.key.startsWith('Arrow') ||
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            Blockly.keyboardNavigationController.setIsActive(true);
            window.requestAnimationFrame(() => announceBlocklyFocus?.());
          }
        };
        announceBlocklyFocus = (event?: FocusEvent) => {
          const target = (event?.target ??
            document.activeElement) as Element | null;
          if (!target || !keyboardHost?.contains(target)) return;
          const blockRoot = target.closest<SVGElement>('[data-id]');
          const blockId = blockRoot?.getAttribute('data-id');
          const block = blockId ? workspace.getBlockById(blockId) : null;
          const label = block
            ? blockAccessibilityLabel(block)
            : (target.getAttribute('aria-label') ??
              target.textContent?.replace(/\s+/g, ' ').trim() ??
              'Control del editor de bloques');
          if (target instanceof SVGElement) {
            target.setAttribute('aria-label', label);
          }
          if (keyboardStatusRef.current) {
            keyboardStatusRef.current.textContent = label;
          }
        };
        deactivateKeyboardNavigation = () =>
          Blockly.keyboardNavigationController.setIsActive(false);
        keyboardHost = hostRef.current;
        keyboardHost.addEventListener('keydown', activateKeyboardNavigation);
        keyboardHost.addEventListener('focusin', announceBlocklyFocus);
        keyboardHost.addEventListener(
          'pointerdown',
          deactivateKeyboardNavigation,
        );
        resizeObserver = new ResizeObserver(() => {
          if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            resizeFrame = undefined;
            if (!disposed) Blockly.svgResize(workspace);
          });
        });
        resizeObserver.observe(hostRef.current);
        onHistoryChangeRef.current?.(historyState(workspace));
        setReady(true);
      },
    );
    return () => {
      disposed = true;
      if (keyboardHost && activateKeyboardNavigation) {
        keyboardHost.removeEventListener('keydown', activateKeyboardNavigation);
      }
      if (keyboardHost && deactivateKeyboardNavigation) {
        keyboardHost.removeEventListener(
          'pointerdown',
          deactivateKeyboardNavigation,
        );
      }
      if (keyboardHost && announceBlocklyFocus) {
        keyboardHost.removeEventListener('focusin', announceBlocklyFocus);
      }
      resizeObserver?.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      workspaceRef.current?.dispose();
      workspaceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !ready ||
      revision === 0 ||
      appliedRevisionRef.current === revision ||
      !workspaceRef.current ||
      !blocklyRef.current
    )
      return;
    workspaceDevices.set(workspaceRef.current, devicesRef.current);
    try {
      loadWorkspaceData(
        blocklyRef.current,
        workspaceRef.current,
        initialWorkspaceRef.current,
      );
    } catch (error) {
      onErrorRef.current?.(readableLoadError(error));
      return;
    }
    appliedRevisionRef.current = revision;
    onChangeRef.current(
      blocklyRef.current.serialization.workspaces.save(
        workspaceRef.current,
      ) as Record<string, unknown>,
    );
    refreshBlockAccessibility(workspaceRef.current);
  }, [ready, revision]);

  useEffect(() => {
    if (!ready || !workspaceRef.current || !blocklyRef.current) return;
    workspaceDevices.set(workspaceRef.current, devicesRef.current);
    if (refreshDeviceFields(blocklyRef.current, workspaceRef.current)) {
      refreshBlockAccessibility(workspaceRef.current);
      onChangeRef.current(
        blocklyRef.current.serialization.workspaces.save(
          workspaceRef.current,
        ) as Record<string, unknown>,
      );
    }
  }, [deviceSignature, ready]);

  useImperativeHandle(
    ref,
    () => ({
      save() {
        if (!workspaceRef.current || !blocklyRef.current) return {};
        return blocklyRef.current.serialization.workspaces.save(
          workspaceRef.current,
        ) as Record<string, unknown>;
      },
      load(data) {
        if (!workspaceRef.current || !blocklyRef.current) return;
        try {
          loadWorkspaceData(blocklyRef.current, workspaceRef.current, data);
        } catch (error) {
          onErrorRef.current?.(readableLoadError(error));
          return;
        }
        onChangeRef.current(
          blocklyRef.current.serialization.workspaces.save(
            workspaceRef.current,
          ) as Record<string, unknown>,
        );
      },
      compile() {
        if (!workspaceRef.current) return { version: 2, threads: [] };
        return compileWorkspace(workspaceRef.current);
      },
      highlight(blockIds) {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        for (const id of highlightedBlockIdsRef.current) {
          workspace
            .getBlockById(id)
            ?.getSvgRoot()
            ?.classList.remove('capi-block-active');
        }
        const nextIds = new Set(
          typeof blockIds === 'string'
            ? [blockIds]
            : blockIds
              ? [...blockIds]
              : [],
        );
        for (const id of nextIds) {
          workspace
            .getBlockById(id)
            ?.getSvgRoot()
            ?.classList.add('capi-block-active');
        }
        highlightedBlockIdsRef.current = nextIds;
        workspace.highlightBlock([...nextIds][0] ?? null);
      },
      undo() {
        const workspace = workspaceRef.current;
        if (!workspace || !workspace.getUndoStack().length) return;
        workspace.undo(false);
        onHistoryChangeRef.current?.(historyState(workspace));
      },
      redo() {
        const workspace = workspaceRef.current;
        if (!workspace || !workspace.getRedoStack().length) return;
        workspace.undo(true);
        onHistoryChangeRef.current?.(historyState(workspace));
      },
      zoomToFit() {
        workspaceRef.current?.zoomToFit();
      },
    }),
    [],
  );

  return (
    <div className="blockly-shell">
      {!ready && <div className="editor-loading">Preparando los bloques…</div>}
      <p id="blockly-keyboard-help" className="visually-hidden">
        Usa Tab para recorrer el editor. Las flechas permiten navegar por los
        controles de Blockly. Control Z deshace y Control Y rehace.
      </p>
      <output
        ref={keyboardStatusRef}
        id="blockly-keyboard-status"
        className="visually-hidden"
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        ref={hostRef}
        className="blockly-host"
        role="application"
        aria-label="Editor visual de bloques"
        aria-describedby="blockly-keyboard-help blockly-keyboard-status"
      />
    </div>
  );
});

export default memo(BlocklyWorkspace);
