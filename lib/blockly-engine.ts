// Definitions, field normalization and compiler shared by browser and isolated server.
// @ts-expect-error Node strip-types runner.
import { displayArtworks, displayProfiles, displayTargets } from './display-model.ts';
// @ts-expect-error Node strip-types runners need the explicit extension.
import { BUILTIN_DISPLAY_ARTWORKS } from './display-graphics.ts';
// @ts-expect-error Node strip-types runner.
import { MAX_MATRIX_TEXT } from './led-matrix.ts';
import type { CompiledProgram, Condition, ProgramNode, ValueExpression, VariableType } from './capiblocks.ts';
import type { SceneDevice, SceneDeviceKind } from './scene-model.ts';
// @ts-expect-error Node strip-types runner.
import { boardProfile, type BoardProfileId } from './board-profiles.ts';
// @ts-expect-error Node strip-types runner.
import { componentValueCapabilities, type ComponentValueSource } from './component-capabilities.ts';
type BlocklyApi = typeof import('blockly');
type BlocklyWorkspaceSvg = import('blockly').WorkspaceSvg;
type BlocklyBlock = import('blockly').Block;
type BlocklyFieldDropdown = import('blockly').FieldDropdown;
type BlocklyFieldTextInput = import('blockly').FieldTextInput;
type BlocklyMenuOption = import('blockly').MenuOption;

const DEVICE_FIELD = 'DEVICE_ID';
const AREA_FIELD = 'AREA_ID';
const MESSAGE_FIELD = 'MESSAGE';
const PATTERN_FIELD = 'PATTERN_ID';
const DISPLAY_ARTWORK_FIELD = 'ARTWORK_ID';
const COMPONENT_PROPERTY_FIELD = 'PROPERTY';
const serializedAreaIds = new WeakMap<BlocklyWorkspaceSvg, Map<string, string>>();
const EMPTY_FAVORITES: readonly string[] = [];
const DEVICE_EXTENSION = 'capi_device_target_v2';
const ANIMATION_REPEAT_EXTENSION = 'capi_animation_repeat_v1';
const MATRIX_TEXT_EXTENSION = 'capi_matrix_text_limit_v1';
const BOARD_PIN_EXTENSION = 'capi_board_pin_v1';
const COMPONENT_VALUE_EXTENSION = 'capi_component_value_v1';
const DEVICE_WARNING = 'capi-device-target';
const MISSING_DEVICE_PREFIX = '__missing__:';

const workspaceDevices = new WeakMap<
  BlocklyWorkspaceSvg,
  readonly SceneDevice[]
>();
const workspaceBoardProfiles = new WeakMap<BlocklyWorkspaceSvg, BoardProfileId>();
const serializedDeviceIds = new WeakMap<
  BlocklyWorkspaceSvg,
  Map<string, string>
>();
const registeredBlocklies = new WeakSet<object>();

const deviceLabels: Record<SceneDeviceKind, string> = {
  trafficLight: 'un semáforo',
  robot: 'un robot',
  otto: 'un robot Otto',
  motor: 'un motor',
  led: 'un LED',
  servo: 'un servo',
  activeBuzzer: 'un buzzer activo',
  passiveBuzzer: 'un buzzer pasivo',
  button: 'un botón',
  infraredBarrier: 'una barrera infrarroja',
  lightSensor: 'un sensor de luz',
  potentiometer: 'un potenciómetro',
  wifiNode: 'una conexión Wi-Fi',
  display: 'una pantalla',
  ledMatrix: 'una matriz LED',
  messages: 'un componente Mensajes',
};

function targetWorkspaceForBlock(block: BlocklyBlock) {
  const workspace = block.workspace as BlocklyWorkspaceSvg;
  return workspace.targetWorkspace ?? workspace;
}

function acceptedDeviceKinds(block: BlocklyBlock): readonly SceneDeviceKind[] {
  switch (block.type) {
    case 'capi_display_write':
    case 'capi_display_clear':
    case 'capi_display_animate_text':
    case 'capi_display_artwork': return ['display'];
    case 'capi_visual_wait': return ['display', 'ledMatrix'];
    case 'capi_matrix_clear':
    case 'capi_matrix_pixel':
    case 'capi_matrix_pattern':
    case 'capi_matrix_scroll': return ['ledMatrix'];
    case 'capi_message_send':
    case 'capi_message_receive':
    case 'capi_message_value': return ['messages'];
    case 'capi_traffic':
      return ['trafficLight'];
    case 'capi_led':
      return ['led'];
    case 'capi_robot':
      return ['robot'];
    case 'capi_otto':
    case 'capi_otto_sound':
    case 'capi_otto_expression':
    case 'capi_otto_arms':
    case 'capi_otto_distance':
      return ['otto'];
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
    case 'capi_barrier_state':
      return ['infraredBarrier'];
    case 'capi_display_button_pressed':
      return ['display'];
    case 'capi_sensor_compare':
      return block.getFieldValue('SENSOR') === 'POTENTIOMETER'
        ? ['potentiometer']
        : ['lightSensor'];
    case 'capi_sensor_value':
      return ['lightSensor', 'potentiometer'];
    case 'capi_component_number':
      return ['led', 'motor', 'servo', 'lightSensor', 'potentiometer', 'otto'];
    case 'capi_component_text':
      return ['trafficLight', 'robot', 'otto', 'wifiNode', 'messages'];
    case 'capi_component_boolean':
      return ['button', 'infraredBarrier', 'wifiNode'];
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
  return (workspaceDevices.get(workspace) ?? []).filter((device) => {
    if (!kinds.includes(device.kind)) return false;
    if (block.type === 'capi_display_button_pressed')
      return device.kind === 'display' && device.config.profile === 'lcd1602keypad';
    if (device.kind === 'otto') {
      if (block.type === 'capi_otto_sound') return device.config.profile !== 'biped4';
      if (block.type === 'capi_otto_expression') return ['biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile);
      if (block.type === 'capi_otto_arms') return device.config.profile === 'humanoid6-expressive';
      if (block.type === 'capi_otto_distance') return ['biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile);
      return true;
    }
    if (device.kind !== 'messages') return true;
    if (block.type === 'capi_message_send') return device.config.mode !== 'receive';
    if (block.type === 'capi_message_receive') return device.config.mode !== 'send';
    return true;
  });
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
  if (block.getField(PATTERN_FIELD)) {
    const device = devicesForBlock(block).find(device => device.id === value);
    const patternId = block.getFieldValue(PATTERN_FIELD);
    block.setWarningText(device?.kind === 'ledMatrix' && device.config.patterns.some(pattern => pattern.id === patternId) ? null : 'Elegí un dibujo guardado en esta matriz.', 'matrix-pattern');
  }
  if (block.getField(DISPLAY_ARTWORK_FIELD)) {
    const device = devicesForBlock(block).find(device => device.id === value);
    const artworkId = block.getFieldValue(DISPLAY_ARTWORK_FIELD);
    const available =
      device?.kind === 'display' &&
      displayProfiles[device.config.profile].graphic &&
      [...BUILTIN_DISPLAY_ARTWORKS, ...displayArtworks(device.config)].some(
        (item) => item.id === artworkId,
      );
    block.setWarningText(
      available
        ? null
        : 'Elegí un dibujo disponible en una pantalla gráfica.',
      'display-artwork',
    );
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

function messageMenuGenerator(this: BlocklyFieldDropdown): BlocklyMenuOption[] {
  const block = this.getSourceBlock();
  if (!block) return [['Configurá un mensaje', '__missing_message__']];
  const deviceId = block.getFieldValue(DEVICE_FIELD);
  const device = devicesForBlock(block).find(item => item.id === deviceId);
  const options: BlocklyMenuOption[] = device?.kind === 'messages'
    ? device.config.messages.map(message => [message, message])
    : [];
  const current = this.getValue();
  if (current && current !== '__missing_message__' && !options.some(option => option[1] === current))
    options.push([`⚠️ ${current}`, current]);
  return options.length ? options : [['Configurá un mensaje', '__missing_message__']];
}

function patternMenuGenerator(this: BlocklyFieldDropdown): BlocklyMenuOption[] {
  const block = this.getSourceBlock();
  if (!block) return [['Configurá un dibujo', '__missing_pattern__']];
  const device = devicesForBlock(block).find(item => item.id === block.getFieldValue(DEVICE_FIELD));
  const options: BlocklyMenuOption[] = device?.kind === 'ledMatrix' ? device.config.patterns.map(pattern => [pattern.name, pattern.id]) : [];
  const current = this.getValue();
  if (current && current !== '__missing_pattern__' && !options.some(option => option[1] === current)) options.push([`⚠️ Dibujo retirado (${current})`, current]);
  return options.length ? options : [['Configurá un dibujo', '__missing_pattern__']];
}

function displayArtworkMenuGenerator(
  this: BlocklyFieldDropdown,
): BlocklyMenuOption[] {
  const block = this.getSourceBlock();
  if (!block) return [['Elegí una pantalla gráfica', '__missing_artwork__']];
  const device = devicesForBlock(block).find(
    (item) => item.id === block.getFieldValue(DEVICE_FIELD),
  );
  const options: BlocklyMenuOption[] =
    device?.kind === 'display' && displayProfiles[device.config.profile].graphic
      ? [...BUILTIN_DISPLAY_ARTWORKS, ...displayArtworks(device.config)].map(
          (item) => [item.name, item.id],
        )
      : [];
  const current = this.getValue();
  if (
    current &&
    current !== '__missing_artwork__' &&
    !options.some((option) => option[1] === current)
  )
    options.push([`⚠️ Dibujo retirado (${current})`, current]);
  return options.length
    ? options
    : [['Usá OLED o TFT para dibujos', '__missing_artwork__']];
}

function componentPropertyMenuGenerator(this: BlocklyFieldDropdown): BlocklyMenuOption[] {
  const block = this.getSourceBlock();
  if (!block) return [['Elegí un componente', '__missing_property__']];
  const workspace = targetWorkspaceForBlock(block);
  const device = (workspaceDevices.get(workspace) ?? []).find(item => item.id === block.getFieldValue(DEVICE_FIELD));
  const type: VariableType = block.type.endsWith('_text') ? 'text' : block.type.endsWith('_boolean') ? 'boolean' : 'number';
  const options: BlocklyMenuOption[] = device ? componentValueCapabilities(device).filter(item => item.type === type).map(item => [`${item.label} · ${item.source === 'measured' ? 'medido' : item.source === 'ordered' ? 'ordenado' : 'servicio'}`, item.key]) : [];
  const current = this.getValue();
  if (current && current !== '__missing_property__' && !options.some(option => option[1] === current)) options.push([`⚠️ Dato retirado (${current})`, current]);
  return options.length ? options : [['Elegí un dato disponible', '__missing_property__']];
}

function refreshComponentPropertyField(block: BlocklyBlock) {
  const field = block.getField(COMPONENT_PROPERTY_FIELD) as BlocklyFieldDropdown | null;
  if (!field) return;
  const previous = field.getValue();
  field.setOptions(componentPropertyMenuGenerator);
  const options = field.getOptions(false);
  field.setValue(options.some(option => option[1] === previous) ? previous : options[0][1]);
  field.forceRerender();
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

function refreshMessageField(block: BlocklyBlock) {
  const field = block.getField(MESSAGE_FIELD) as BlocklyFieldDropdown | null;
  if (!field) return;
  const previous = field.getValue();
  field.setOptions(messageMenuGenerator);
  if (field.getOptions(false).some(option => option[1] === previous)) field.setValue(previous);
  field.forceRerender();
}

function refreshPatternField(block: BlocklyBlock) {
  const field = block.getField(PATTERN_FIELD) as BlocklyFieldDropdown | null;
  if (!field) return;
  const previous = field.getValue();
  field.setOptions(patternMenuGenerator);
  if (field.getOptions(false).some(option => option[1] === previous)) field.setValue(previous);
  field.forceRerender();
  updateDeviceWarning(block);
}

function refreshDisplayArtworkField(block: BlocklyBlock) {
  const field = block.getField(
    DISPLAY_ARTWORK_FIELD,
  ) as BlocklyFieldDropdown | null;
  if (!field) return;
  const previous = field.getValue();
  field.setOptions(displayArtworkMenuGenerator);
  if (field.getOptions(false).some((option) => option[1] === previous))
    field.setValue(previous);
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
  refreshMessageField(block);
  refreshPatternField(block);
  refreshDisplayArtworkField(block);
  refreshComponentPropertyField(block);
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
        { kind: 'block', type: 'capi_value_compare' },
        { kind: 'block', type: 'capi_counter_compare' },
        { kind: 'block', type: 'capi_button_pressed' },
        { kind: 'block', type: 'capi_barrier_state' },
        { kind: 'block', type: 'capi_display_button_pressed' },
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
      name: 'Temporizadores',
      colour: '#D46B32',
      contents: [
        { kind: 'button', text: 'Crear temporizador', callbackKey: 'CAPI_CREATE_TIMER' },
        { kind: 'block', type: 'capi_timer_start' },
        { kind: 'block', type: 'capi_timer_restart' },
        { kind: 'block', type: 'capi_timer_pause' },
        { kind: 'block', type: 'capi_timer_resume' },
        { kind: 'block', type: 'capi_timer_stop' },
        { kind: 'block', type: 'capi_timer_wait' },
        { kind: 'block', type: 'capi_timer_elapsed' },
        { kind: 'block', type: 'capi_timer_remaining' },
      ],
    },
    {
      kind: 'category', name: 'Mis bloques', colour: '#8E5BB7', contents: [
        { kind: 'label', text: 'Definiciones (quedan fuera de Al comenzar)' },
        { kind: 'block', type: 'capi_procedure_def' },
        { kind: 'block', type: 'capi_function_def_number' },
        { kind: 'block', type: 'capi_function_def_text' },
        { kind: 'block', type: 'capi_function_def_boolean' },
        { kind: 'label', text: 'Usar mis bloques' },
        { kind: 'block', type: 'capi_procedure_call' },
        { kind: 'block', type: 'capi_function_call_number' },
        { kind: 'block', type: 'capi_function_call_text' },
        { kind: 'block', type: 'capi_function_call_boolean' },
        { kind: 'label', text: 'Datos recibidos' },
        { kind: 'block', type: 'capi_parameter_number' },
        { kind: 'block', type: 'capi_parameter_text' },
        { kind: 'block', type: 'capi_parameter_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Datos',
      colour: '#7A58C1',
      contents: [
        { kind: 'button', text: 'Crear número', callbackKey: 'CAPI_CREATE_NUMBER' },
        { kind: 'button', text: 'Crear texto', callbackKey: 'CAPI_CREATE_TEXT' },
        { kind: 'button', text: 'Crear sí/no', callbackKey: 'CAPI_CREATE_BOOLEAN' },
        { kind: 'block', type: 'capi_variable_set_number', inputs: { VALUE: { shadow: { type: 'capi_value_number', fields: { VALUE: 0 } } } } },
        { kind: 'block', type: 'capi_variable_change', inputs: { DELTA: { shadow: { type: 'capi_value_number', fields: { VALUE: 1 } } } } },
        { kind: 'block', type: 'capi_variable_set_text', inputs: { VALUE: { shadow: { type: 'capi_value_text', fields: { VALUE: 'hola' } } } } },
        { kind: 'block', type: 'capi_variable_set_boolean', inputs: { VALUE: { shadow: { type: 'capi_value_boolean', fields: { VALUE: 'TRUE' } } } } },
        { kind: 'block', type: 'capi_variable_get_number' },
        { kind: 'block', type: 'capi_variable_get_text' },
        { kind: 'block', type: 'capi_variable_get_boolean' },
        { kind: 'block', type: 'capi_value_number' },
        { kind: 'block', type: 'capi_value_text' },
        { kind: 'block', type: 'capi_value_boolean' },
        { kind: 'block', type: 'capi_counter_value' },
        { kind: 'block', type: 'capi_sensor_value' },
        { kind: 'block', type: 'capi_component_number' },
        { kind: 'block', type: 'capi_component_text' },
        { kind: 'block', type: 'capi_component_boolean' },
        { kind: 'block', type: 'capi_otto_distance' },
        { kind: 'block', type: 'capi_barrier_state' },
        { kind: 'block', type: 'capi_message_value' },
        { kind: 'block', type: 'capi_number_math' },
        { kind: 'block', type: 'capi_text_join' },
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
        { kind: 'block', type: 'capi_otto' },
        { kind: 'block', type: 'capi_otto_arms' },
        { kind: 'block', type: 'capi_otto_sound' },
        { kind: 'block', type: 'capi_otto_expression' },
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
      contents: [{ kind: 'block', type: 'capi_serial' }, { kind: 'block', type: 'capi_message_send' }, { kind: 'block', type: 'capi_message_receive' }, { kind: 'block', type: 'capi_display_write' }, { kind: 'block', type: 'capi_display_animate_text' }, { kind: 'block', type: 'capi_display_artwork' }, { kind: 'block', type: 'capi_display_clear' }, { kind: 'block', type: 'capi_visual_wait' }],
    },
    {
      kind: 'category', name: 'Matriz LED', colour: '#B47B00',
      contents: [
        { kind: 'block', type: 'capi_matrix_clear' },
        { kind: 'block', type: 'capi_matrix_pixel' },
        { kind: 'block', type: 'capi_matrix_pattern' },
        { kind: 'block', type: 'capi_matrix_scroll' },
        { kind: 'block', type: 'capi_visual_wait' },
      ],
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
        (this.getField(MESSAGE_FIELD) as BlocklyFieldDropdown | null)?.setOptions(messageMenuGenerator);
        (this.getField(PATTERN_FIELD) as BlocklyFieldDropdown | null)?.setOptions(patternMenuGenerator);
        (this.getField(DISPLAY_ARTWORK_FIELD) as BlocklyFieldDropdown | null)?.setOptions(displayArtworkMenuGenerator);
        updateDeviceWarning(this);
      },
    );
  }
  if (!Blockly.Extensions.isRegistered(ANIMATION_REPEAT_EXTENSION)) {
    Blockly.Extensions.register(ANIMATION_REPEAT_EXTENSION, function (this: BlocklyBlock) {
      const mode = this.getField('REPEAT_MODE') as BlocklyFieldDropdown | null;
      const count = this.getField('REPEAT_COUNT');
      const showCount = (value: string | null | undefined) => {
        count?.setVisible(value === 'COUNT');
        if (this.rendered) (this as BlocklyBlock & { render(): void }).render();
      };
      mode?.setValidator((value) => {
        showCount(String(value));
        return value;
      });
      showCount(String(mode?.getValue() ?? 'ONCE'));
    });
  }
  if (!Blockly.Extensions.isRegistered(COMPONENT_VALUE_EXTENSION)) {
    Blockly.Extensions.register(COMPONENT_VALUE_EXTENSION, function (this: BlocklyBlock) {
      refreshComponentPropertyField(this);
    });
  }
  if (!Blockly.Extensions.isRegistered(MATRIX_TEXT_EXTENSION)) {
    Blockly.Extensions.register(MATRIX_TEXT_EXTENSION, function (this: BlocklyBlock) {
      const text = this.getField('TEXT') as BlocklyFieldTextInput | null;
      const count = this.getField('TEXT_COUNT');
      const updateCount = (value: string) => {
        const length = value.length;
        count?.setValue(
          length === MAX_MATRIX_TEXT
            ? `${length}/${MAX_MATRIX_TEXT} · límite`
            : `${length}/${MAX_MATRIX_TEXT}`,
        );
      };
      text?.setValidator((value) => {
        const limited = String(value ?? '').slice(0, MAX_MATRIX_TEXT);
        updateCount(limited);
        return limited;
      });
      updateCount(String(text?.getValue() ?? '').slice(0, MAX_MATRIX_TEXT));
    });
  }
  if (!Blockly.Extensions.isRegistered(BOARD_PIN_EXTENSION)) {
    Blockly.Extensions.register(BOARD_PIN_EXTENSION, function (this: BlocklyBlock) {
      const field = this.getField('PIN') as BlocklyFieldDropdown | null;
      field?.setOptions(function (this: BlocklyFieldDropdown) {
        const block = this.getSourceBlock();
        const workspace = block ? targetWorkspaceForBlock(block) : null;
        const profile = boardProfile(workspace ? workspaceBoardProfiles.get(workspace) ?? 'wemos-d1-r32' : 'wemos-d1-r32');
        const options: BlocklyMenuOption[] = profile.pins
          .filter(pin => pin.capabilities.includes('pwmOutput'))
          .map(pin => [`${pin.label} / GPIO ${pin.gpio}`, String(pin.gpio)] as BlocklyMenuOption);
        const current = this.getValue();
        if (current && !options.some(option => option[1] === current)) options.unshift([`GPIO ${current} · no compatible`, current]);
        return options;
      });
    });
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
      type: 'capi_timer_start', message0: '⏱ iniciar %1 por %2 segundos %3',
      args0: [
        { type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' },
        { type: 'field_number', name: 'SECONDS', value: 5, min: 0.1, max: 86400, precision: 0.1 },
        { type: 'field_dropdown', name: 'MODE', options: [['una vez', 'ONCE'], ['repetir', 'REPEAT']] },
      ],
      previousStatement: null, nextStatement: null, colour: '#D46B32',
      tooltip: 'Inicia desde cero. En repetir, produce un nuevo evento en cada vuelta.',
    },
    {
      type: 'capi_timer_restart', message0: '↻ reiniciar %1',
      args0: [{ type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' }],
      previousStatement: null, nextStatement: null, colour: '#D46B32', tooltip: 'Vuelve a empezar con la última duración y modo elegidos.',
    },
    {
      type: 'capi_timer_pause', message0: '⏸ pausar %1',
      args0: [{ type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' }],
      previousStatement: null, nextStatement: null, colour: '#D46B32', tooltip: 'Congela el tiempo que queda.',
    },
    {
      type: 'capi_timer_resume', message0: '▶ continuar %1',
      args0: [{ type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' }],
      previousStatement: null, nextStatement: null, colour: '#D46B32', tooltip: 'Continúa un temporizador pausado.',
    },
    {
      type: 'capi_timer_stop', message0: '⏹ detener %1',
      args0: [{ type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' }],
      previousStatement: null, nextStatement: null, colour: '#D46B32', tooltip: 'Detiene y vuelve a cero.',
    },
    {
      type: 'capi_timer_wait', message0: '🔔 esperar próximo evento de %1',
      args0: [{ type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' }],
      previousStatement: null, nextStatement: null, colour: '#D46B32',
      tooltip: 'Espera el próximo vencimiento sin frenar los otros caminos. Usalo en Al mismo tiempo.',
    },
    {
      type: 'capi_timer_elapsed', message0: 'segundos transcurridos de %1',
      args0: [{ type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' }],
      output: 'Number', colour: '#D46B32', tooltip: 'Lee segundos completos desde que se inició o reinició.',
    },
    {
      type: 'capi_timer_remaining', message0: 'segundos restantes de %1',
      args0: [{ type: 'field_variable', name: 'TIMER', variable: 'mi temporizador', variableTypes: ['Timer'], defaultType: 'Timer' }],
      output: 'Number', colour: '#D46B32', tooltip: 'Lee los segundos que faltan para el próximo evento.',
    },
    {
      type: 'capi_procedure_def', message0: '🧩 tarea %1',
      args0: [{ type: 'field_variable', name: 'ROUTINE', variable: 'mi tarea', variableTypes: ['Procedure'], defaultType: 'Procedure' }],
      message1: 'recibe 1 %1 %2  2 %3 %4  3 %5 %6',
      args1: [
        { type: 'field_input', name: 'P1_NAME', text: 'dato 1' }, { type: 'field_dropdown', name: 'P1_TYPE', options: [['número','number'],['texto','text'],['sí/no','boolean'],['no usar','none']] },
        { type: 'field_input', name: 'P2_NAME', text: 'dato 2' }, { type: 'field_dropdown', name: 'P2_TYPE', options: [['no usar','none'],['número','number'],['texto','text'],['sí/no','boolean']] },
        { type: 'field_input', name: 'P3_NAME', text: 'dato 3' }, { type: 'field_dropdown', name: 'P3_TYPE', options: [['no usar','none'],['número','number'],['texto','text'],['sí/no','boolean']] },
      ],
      message2: 'hacer %1', args2: [{ type: 'input_statement', name: 'BODY' }], colour: '#8E5BB7', tooltip: 'Define una tarea reutilizable. Usá solamente los datos recibidos que marcaste.',
    },
    ...(['number','text','boolean'] as const).map(type => ({
      type: `capi_function_def_${type}`, message0: `🧮 función ${type === 'number' ? 'número' : type === 'text' ? 'texto' : 'sí/no'} %1`,
      args0: [{ type: 'field_variable', name: 'ROUTINE', variable: 'mi función', variableTypes: [`Function${type === 'number' ? 'Number' : type === 'text' ? 'Text' : 'Boolean'}`], defaultType: `Function${type === 'number' ? 'Number' : type === 'text' ? 'Text' : 'Boolean'}` }],
      message1: 'recibe 1 %1 %2  2 %3 %4  3 %5 %6', args1: [
        { type: 'field_input', name: 'P1_NAME', text: 'dato 1' }, { type: 'field_dropdown', name: 'P1_TYPE', options: [['número','number'],['texto','text'],['sí/no','boolean'],['no usar','none']] },
        { type: 'field_input', name: 'P2_NAME', text: 'dato 2' }, { type: 'field_dropdown', name: 'P2_TYPE', options: [['no usar','none'],['número','number'],['texto','text'],['sí/no','boolean']] },
        { type: 'field_input', name: 'P3_NAME', text: 'dato 3' }, { type: 'field_dropdown', name: 'P3_TYPE', options: [['no usar','none'],['número','number'],['texto','text'],['sí/no','boolean']] },
      ],
      message2: 'resultado %1', args2: [{ type: 'input_value', name: 'RETURN', check: type === 'number' ? 'Number' : type === 'text' ? 'String' : 'Boolean' }], colour: '#8E5BB7', tooltip: 'Define un cálculo reutilizable que devuelve un dato.',
    })),
    {
      type: 'capi_procedure_call', message0: '🧩 hacer %1', args0: [{ type: 'field_variable', name: 'ROUTINE', variable: 'mi tarea', variableTypes: ['Procedure'], defaultType: 'Procedure' }],
      message1: 'con %1 %2 %3', args1: [{ type: 'input_value', name: 'ARG1' }, { type: 'input_value', name: 'ARG2' }, { type: 'input_value', name: 'ARG3' }],
      previousStatement: null, nextStatement: null, inputsInline: true, colour: '#8E5BB7', tooltip: 'Ejecuta una tarea creada por vos.',
    },
    ...(['number','text','boolean'] as const).map(type => ({
      type: `capi_function_call_${type}`, message0: `resultado de %1 con %2 %3 %4`,
      args0: [{ type: 'field_variable', name: 'ROUTINE', variable: 'mi función', variableTypes: [`Function${type === 'number' ? 'Number' : type === 'text' ? 'Text' : 'Boolean'}`], defaultType: `Function${type === 'number' ? 'Number' : type === 'text' ? 'Text' : 'Boolean'}` }, { type: 'input_value', name: 'ARG1' }, { type: 'input_value', name: 'ARG2' }, { type: 'input_value', name: 'ARG3' }],
      output: type === 'number' ? 'Number' : type === 'text' ? 'String' : 'Boolean', inputsInline: true, colour: '#8E5BB7', tooltip: 'Usa el resultado de una función creada por vos.',
    })),
    ...(['number','text','boolean'] as const).map(type => ({
      type: `capi_parameter_${type}`, message0: `dato recibido %1 (${type === 'number' ? 'número' : type === 'text' ? 'texto' : 'sí/no'})`, args0: [{ type: 'field_dropdown', name: 'PARAM', options: [['1','1'],['2','2'],['3','3']] }],
      output: type === 'number' ? 'Number' : type === 'text' ? 'String' : 'Boolean', colour: '#8E5BB7', tooltip: 'Lee uno de los datos recibidos por la tarea o función.',
    })),
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
      type: 'capi_value_compare',
      message0: 'comparar datos %1 %2 %3',
      args0: [
        { type: 'input_value', name: 'LEFT' },
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
        { type: 'input_value', name: 'RIGHT' },
      ],
      inputsInline: true,
      output: 'Boolean',
      colour: '#CF4EB9',
      tooltip: 'Compara variables, sensores, contador, números, textos o respuestas sí/no.',
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
      type: 'capi_variable_set_number', message0: '📦 poner número %1 en %2',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'mi número', variableTypes: ['Number'], defaultType: 'Number' },
        { type: 'input_value', name: 'VALUE', check: 'Number' },
      ],
      previousStatement: null, nextStatement: null, colour: '#7A58C1',
      tooltip: 'Guarda un número para volver a usarlo.',
    },
    {
      type: 'capi_variable_change', message0: '➕ cambiar número %1 en %2',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'mi número', variableTypes: ['Number'], defaultType: 'Number' },
        { type: 'input_value', name: 'DELTA', check: 'Number' },
      ],
      previousStatement: null, nextStatement: null, colour: '#7A58C1',
      tooltip: 'Suma o resta un valor a una variable numérica.',
    },
    {
      type: 'capi_variable_set_text', message0: '📦 poner texto %1 en %2',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'mi texto', variableTypes: ['String'], defaultType: 'String' },
        { type: 'input_value', name: 'VALUE', check: 'String' },
      ],
      previousStatement: null, nextStatement: null, colour: '#7A58C1',
      tooltip: 'Guarda un texto de hasta 120 caracteres.',
    },
    {
      type: 'capi_variable_set_boolean', message0: '📦 poner sí/no %1 en %2',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'mi decisión', variableTypes: ['Boolean'], defaultType: 'Boolean' },
        { type: 'input_value', name: 'VALUE', check: 'Boolean' },
      ],
      previousStatement: null, nextStatement: null, colour: '#7A58C1',
      tooltip: 'Guarda una respuesta sí o no.',
    },
    {
      type: 'capi_variable_get_number', message0: 'número %1',
      args0: [{ type: 'field_variable', name: 'VAR', variable: 'mi número', variableTypes: ['Number'], defaultType: 'Number' }],
      output: 'Number', colour: '#7A58C1', tooltip: 'Lee un número guardado.',
    },
    {
      type: 'capi_variable_get_text', message0: 'texto %1',
      args0: [{ type: 'field_variable', name: 'VAR', variable: 'mi texto', variableTypes: ['String'], defaultType: 'String' }],
      output: 'String', colour: '#7A58C1', tooltip: 'Lee un texto guardado.',
    },
    {
      type: 'capi_variable_get_boolean', message0: 'sí/no %1',
      args0: [{ type: 'field_variable', name: 'VAR', variable: 'mi decisión', variableTypes: ['Boolean'], defaultType: 'Boolean' }],
      output: 'Boolean', colour: '#7A58C1', tooltip: 'Lee una respuesta guardada.',
    },
    {
      type: 'capi_value_number', message0: 'número %1',
      args0: [{ type: 'field_number', name: 'VALUE', value: 0, min: -2147483648, max: 2147483647, precision: 1 }],
      output: 'Number', colour: '#7A58C1', tooltip: 'Un número.',
    },
    {
      type: 'capi_value_text', message0: 'texto %1',
      args0: [{ type: 'field_input', name: 'VALUE', text: 'hola' }],
      output: 'String', colour: '#7A58C1', tooltip: 'Un texto de hasta 120 caracteres.',
    },
    {
      type: 'capi_value_boolean', message0: '%1',
      args0: [{ type: 'field_dropdown', name: 'VALUE', options: [['sí', 'TRUE'], ['no', 'FALSE']] }],
      output: 'Boolean', colour: '#7A58C1', tooltip: 'Una respuesta sí o no.',
    },
    { type: 'capi_counter_value', message0: 'valor del contador', output: 'Number', colour: '#6759DF', tooltip: 'Lee el contador actual.' },
    {
      type: 'capi_sensor_value', message0: 'valor de %1',
      args0: [deviceField('⚠️ agrega un sensor')], output: 'Number', colour: '#12AA8C',
      extensions: [DEVICE_EXTENSION], tooltip: 'Lee el valor actual de un sensor, entre 0 y 4095.',
    },
    ...(['number', 'text', 'boolean'] as const).map(type => ({
      type: `capi_component_${type}`,
      message0: `dato ${type === 'number' ? 'numérico' : type === 'text' ? 'de texto' : 'sí/no'} de %1 %2`,
      args0: [deviceField('⚠️ agrega un componente'), { type: 'field_dropdown', name: COMPONENT_PROPERTY_FIELD, options: [['Elegí un dato', '__missing_property__']] }],
      output: type === 'number' ? 'Number' : type === 'text' ? 'String' : 'Boolean', colour: '#2A8C75',
      extensions: [DEVICE_EXTENSION, COMPONENT_VALUE_EXTENSION],
      tooltip: 'Lee un dato del componente. La etiqueta aclara si es medido, ordenado por el programa o de un servicio.',
    })),
    {
      type: 'capi_message_value', message0: 'último mensaje recibido en %1',
      args0: [deviceField('⚠️ agrega Mensajes')], output: 'String', colour: '#59627D',
      extensions: [DEVICE_EXTENSION], tooltip: 'Lee el último texto recibido. Antes de recibir uno, está vacío.',
    },
    {
      type: 'capi_number_math', message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'LEFT', check: 'Number' },
        { type: 'field_dropdown', name: 'OPERATOR', options: [['+', 'ADD'], ['−', 'SUBTRACT'], ['×', 'MULTIPLY'], ['÷', 'DIVIDE']] },
        { type: 'input_value', name: 'RIGHT', check: 'Number' },
      ],
      inputsInline: true, output: 'Number', colour: '#7A58C1', tooltip: 'Hace una cuenta con dos números. Dividir por cero da 0.',
    },
    {
      type: 'capi_text_join', message0: 'armar texto %1 %2 %3',
      args0: [
        { type: 'input_value', name: 'FIRST' },
        { type: 'input_value', name: 'SECOND' },
        { type: 'input_value', name: 'THIRD' },
      ],
      inputsInline: true, output: 'String', colour: '#7A58C1', tooltip: 'Une hasta tres textos o valores. Podés encastrar otro para agregar más.',
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
      extensions: [BOARD_PIN_EXTENSION],
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
      type: 'capi_otto',
      message0: '🕺 %1: %2 a %3 %% · %4 vez/veces',
      args0: [
        deviceField('⚠️ agrega un robot Otto'),
        {
          type: 'field_dropdown', name: 'ACTION', options: [
            ['volver al centro', 'HOME'],
            ['caminar adelante', 'WALK_FORWARD'],
            ['caminar atrás', 'WALK_BACKWARD'],
            ['girar izquierda', 'TURN_LEFT'],
            ['girar derecha', 'TURN_RIGHT'],
            ['bailar', 'DANCE'],
            ['saltar', 'JUMP'],
            ['balancearse', 'SWING'],
            ['bailar en puntas', 'TIPTOE'],
            ['tiritar', 'JITTER'],
            ['moonwalk izquierda', 'MOONWALK_LEFT'],
            ['moonwalk derecha', 'MOONWALK_RIGHT'],
            ['inclinarse izquierda', 'BEND_LEFT'],
            ['inclinarse derecha', 'BEND_RIGHT'],
            ['sacudir pierna izquierda', 'SHAKE_LEFT'],
            ['sacudir pierna derecha', 'SHAKE_RIGHT'],
            ['aleteo adelante', 'FLAP_FORWARD'],
            ['aleteo atrás', 'FLAP_BACKWARD'],
          ],
        },
        { type: 'field_number', name: 'SPEED', value: 60, min: 0, max: 100, precision: 1 },
        { type: 'field_number', name: 'REPETITIONS', value: 1, min: 1, max: 20, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#7C5CE7',
      tooltip: 'Mueve un robot Otto. Espera sólo este camino; los caminos paralelos siguen.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_otto_sound', message0: '🎵 %1 hacer sonido %2', args0: [deviceField('⚠️ agrega un Otto con sonido'), { type: 'field_dropdown', name: 'SOUND', options: [['feliz', 'HAPPY'], ['triste', 'SAD'], ['sorpresa', 'SURPRISE'], ['confundido', 'CONFUSED'], ['durmiendo', 'SLEEPING'], ['botón', 'BUTTON'], ['cambio de modo', 'MODE'], ['gracioso', 'FART']] }],
      previousStatement: null, nextStatement: null, colour: '#7C5CE7', tooltip: 'Inicia un sonido sin detener los otros caminos.', extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_otto_expression', message0: '😄 %1 mostrar cara %2', args0: [deviceField('⚠️ agrega un Otto expresivo'), { type: 'field_dropdown', name: 'EXPRESSION', options: [['sonrisa', 'SMILE'], ['triste', 'SAD'], ['enojado', 'ANGRY'], ['sorprendido', 'SURPRISED'], ['dormido', 'SLEEPY'], ['amor', 'LOVE'], ['apagar', 'CLEAR']] }],
      previousStatement: null, nextStatement: null, colour: '#7C5CE7', extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_otto_arms', message0: '🙌 %1 poner brazos %2', args0: [deviceField('⚠️ agrega un Otto humanoide'), { type: 'field_dropdown', name: 'POSE', options: [['abajo', 'DOWN'], ['arriba', 'UP'], ['izquierdo arriba', 'LEFT_UP'], ['derecho arriba', 'RIGHT_UP'], ['abiertos', 'OPEN']] }],
      previousStatement: null, nextStatement: null, colour: '#7C5CE7', extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_otto_distance', message0: '📏 distancia de %1 en cm', args0: [deviceField('⚠️ agrega un Otto explorador')], output: 'Number', colour: '#7A58C1', tooltip: 'Última distancia medida sin bloquear el programa.', extensions: [DEVICE_EXTENSION],
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
      type: 'capi_barrier_state',
      message0: '🚧 %1 está %2',
      args0: [
        deviceField('⚠️ agrega una barrera'),
        { type: 'field_dropdown', name: 'STATE', options: [['interrumpida', 'INTERRUPTED'], ['libre', 'CLEAR']] },
      ],
      output: 'Boolean',
      colour: '#CF4EB9',
      tooltip: 'Responde sí cuando la barrera está en el estado elegido.',
      extensions: [DEVICE_EXTENSION],
    },
    {
      type: 'capi_display_button_pressed',
      message0: '🕹️ en %1 botón %2 presionado',
      args0: [
        deviceField('⚠️ agrega una pantalla con botones'),
        {
          type: 'field_dropdown',
          name: 'BUTTON',
          options: [
            ['Derecha', 'RIGHT'],
            ['Arriba', 'UP'],
            ['Abajo', 'DOWN'],
            ['Izquierda', 'LEFT'],
            ['Elegir', 'SELECT'],
          ],
        },
      ],
      output: 'Boolean',
      colour: '#CF4EB9',
      tooltip: 'Responde sí cuando ese botón de la pantalla 16 × 2 está presionado.',
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
      message1: 'agregar dato %1',
      args1: [{ type: 'input_value', name: 'DYNAMIC' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#59627D',
      tooltip:
        'Escribe un mensaje en el monitor serial y en la consola simulada.',
    },
    {
      type: 'capi_message_send',
      message0: '📤 enviar %1 usando %2',
      args0: [
        { type: 'field_dropdown', name: MESSAGE_FIELD, options: [['AVANZAR', 'AVANZAR']] },
        deviceField('Elegí Mensajes'),
      ],
      message1: 'o enviar dato %1',
      args1: [{ type: 'input_value', name: 'DYNAMIC' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#59627D',
      extensions: [DEVICE_EXTENSION],
      tooltip: 'Envía un paquete de texto protegido con tamaño y checksum.',
    },
    {
      type: 'capi_message_receive',
      message0: '📥 esperar en %1 el mensaje %2 durante %3 s',
      args0: [
        deviceField('Elegí Mensajes'),
        { type: 'field_dropdown', name: MESSAGE_FIELD, options: [['AVANZAR', 'AVANZAR']] },
        { type: 'field_number', name: 'TIMEOUT', value: 5, min: 0.1, max: 300, precision: 0.1 },
      ],
      message1: 'si es igual %1',
      args1: [{ type: 'input_statement', name: 'EQUAL' }],
      message2: 'si es distinto %1',
      args2: [{ type: 'input_statement', name: 'DIFFERENT' }],
      message3: 'si no llegó %1',
      args3: [{ type: 'input_statement', name: 'TIMEOUT_DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#59627D',
      extensions: [DEVICE_EXTENSION],
      tooltip: 'Espera sin detener los otros caminos y elige una de tres ramas.',
    },
    {
      type: 'capi_display_write', message0: '📺 en %1 zona %2 escribir %3',
      args0: [deviceField('Elegí una pantalla'), { type: 'field_dropdown', name: AREA_FIELD, options: [['Elegí una zona', '__missing_area__']] }, { type: 'field_input', name: 'TEXT', text: 'Hola, mundo!' }],
      message1: 'agregar dato %1', args1: [{ type: 'input_value', name: 'DYNAMIC' }],
      previousStatement: null, nextStatement: null, colour: '#59627D', extensions: [DEVICE_EXTENSION],
      tooltip: 'Reemplaza el texto de este destino, ajustándolo a sus filas y columnas. No lo envía a consola.',
    },
    {
      type: 'capi_display_clear', message0: '🧽 en %1 borrar zona %2',
      args0: [deviceField('Elegí una pantalla'), { type: 'field_dropdown', name: AREA_FIELD, options: [['Elegí una zona', '__missing_area__']] }],
      previousStatement: null, nextStatement: null, colour: '#59627D', extensions: [DEVICE_EXTENSION],
      tooltip: 'Borra solamente el destino elegido. Las otras zonas conservan sus mensajes.',
    },
    {
      type: 'capi_display_animate_text',
      message0: '🎬 en %1 zona %2 animar %3 como %4',
      args0: [
        deviceField('Elegí una pantalla'),
        { type: 'field_dropdown', name: AREA_FIELD, options: [['Elegí una zona', '__missing_area__']] },
        { type: 'field_input', name: 'TEXT', text: 'Hola!' },
        { type: 'field_dropdown', name: 'EFFECT', options: [['aparecer', 'TYPE'], ['desplazarse', 'SCROLL'], ['parpadear', 'BLINK']] },
      ],
      message1: 'repetir %1 %2',
      args1: [
        { type: 'field_dropdown', name: 'REPEAT_MODE', options: [['una vez', 'ONCE'], ['varias veces', 'COUNT'], ['sin parar', 'FOREVER']] },
        { type: 'field_number', name: 'REPEAT_COUNT', value: 2, min: 2, max: 100, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#59627D',
      extensions: [DEVICE_EXTENSION, ANIMATION_REPEAT_EXTENSION],
      tooltip: 'Inicia la animación y continúa inmediatamente. Puede ejecutarse una vez, varias veces o sin parar.',
    },
    {
      type: 'capi_display_artwork',
      message0: '🖼️ en %1 mostrar %2 como %3',
      args0: [
        deviceField('Elegí una pantalla gráfica'),
        { type: 'field_dropdown', name: DISPLAY_ARTWORK_FIELD, options: [['Corazón', 'builtin-heart']] },
        { type: 'field_dropdown', name: 'EFFECT', options: [['quieto', 'STILL'], ['deslizar', 'SLIDE'], ['parpadear', 'BLINK']] },
      ],
      message1: 'repetir %1 %2',
      args1: [
        { type: 'field_dropdown', name: 'REPEAT_MODE', options: [['una vez', 'ONCE'], ['varias veces', 'COUNT'], ['sin parar', 'FOREVER']] },
        { type: 'field_number', name: 'REPEAT_COUNT', value: 2, min: 2, max: 100, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#59627D',
      extensions: [DEVICE_EXTENSION, ANIMATION_REPEAT_EXTENSION],
      tooltip: 'Muestra un dibujo y, si tiene efecto, lo anima en segundo plano.',
    },
    {
      type: 'capi_visual_wait', message0: '⏳ esperar a que termine %1',
      args0: [deviceField('Elegí una pantalla')],
      previousStatement: null, nextStatement: null, colour: '#59627D', extensions: [DEVICE_EXTENSION],
      tooltip: 'Espera solamente en este camino hasta que termine la animación actual. Los otros caminos siguen.',
    },
    {
      type: 'capi_matrix_clear', message0: '⬛ limpiar %1', args0: [deviceField('Elegí una matriz')],
      previousStatement: null, nextStatement: null, colour: '#B47B00', extensions: [DEVICE_EXTENSION],
      tooltip: 'Apaga todos los puntos de la matriz.',
    },
    {
      type: 'capi_matrix_pixel', message0: '✨ en %1 punto x %2 y %3 %4', args0: [
        deviceField('Elegí una matriz'),
        { type: 'field_number', name: 'X', value: 0, min: 0, max: 31, precision: 1 },
        { type: 'field_number', name: 'Y', value: 0, min: 0, max: 7, precision: 1 },
        { type: 'field_dropdown', name: 'ENABLED', options: [['encender', 'ON'], ['apagar', 'OFF']] },
      ], previousStatement: null, nextStatement: null, colour: '#B47B00', extensions: [DEVICE_EXTENSION],
      tooltip: 'Enciende o apaga un punto. La esquina superior izquierda es x 0, y 0.',
    },
    {
      type: 'capi_matrix_pattern', message0: '🎨 en %1 mostrar dibujo %2', args0: [
        deviceField('Elegí una matriz'),
        { type: 'field_dropdown', name: PATTERN_FIELD, options: [['Corazón', 'heart']] },
      ], previousStatement: null, nextStatement: null, colour: '#B47B00', extensions: [DEVICE_EXTENSION],
      tooltip: 'Muestra uno de los dibujos creados en la escena.',
    },
    {
      type: 'capi_matrix_scroll', message0: '📰 en %1 desplazar texto %2 cada %3 ms', args0: [
        deviceField('Elegí una matriz'),
        { type: 'field_input', name: 'TEXT', text: 'HOLA' },
        { type: 'field_number', name: 'SPEED', value: 120, min: 40, max: 1000, precision: 10 },
      ], message1: 'caracteres %1 · repetir %2 %3', args1: [
        { type: 'field_label', name: 'TEXT_COUNT', text: `4/${MAX_MATRIX_TEXT}` },
        { type: 'field_dropdown', name: 'REPEAT_MODE', options: [['una vez', 'ONCE'], ['varias veces', 'COUNT'], ['sin parar', 'FOREVER']] },
        { type: 'field_number', name: 'REPEAT_COUNT', value: 2, min: 2, max: 100, precision: 1 },
      ], previousStatement: null, nextStatement: null, colour: '#B47B00', extensions: [DEVICE_EXTENSION, ANIMATION_REPEAT_EXTENSION, MATRIX_TEXT_EXTENSION],
      tooltip: `Inicia el desplazamiento y continúa inmediatamente. Admite hasta ${MAX_MATRIX_TEXT} caracteres y puede repetirse o quedar ciclando.`,
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

const animationRepeatCount = (block: BlocklyBlock) => {
  const mode = block.getFieldValue('REPEAT_MODE');
  if (mode === 'FOREVER') return 0;
  if (mode === 'COUNT') return Math.max(2, Math.min(100, Math.floor(numberField(block, 'REPEAT_COUNT', 2))));
  return 1;
};

function compileValue(block: BlocklyBlock | null, fallback: VariableType = 'number'): ValueExpression {
  if (!block) {
    if (fallback === 'text') return { kind: 'text', value: '' };
    if (fallback === 'boolean') return { kind: 'boolean', value: false };
    return { kind: 'number', value: 0 };
  }
  switch (block.type) {
    case 'capi_value_number': return { kind: 'number', value: numberField(block, 'VALUE') };
    case 'capi_value_text': return { kind: 'text', value: String(block.getFieldValue('VALUE') ?? '').slice(0, 120) };
    case 'capi_value_boolean': return { kind: 'boolean', value: block.getFieldValue('VALUE') === 'TRUE' };
    case 'capi_variable_get_number': return { kind: 'variable', variableId: String(block.getFieldValue('VAR') ?? ''), valueType: 'number' };
    case 'capi_variable_get_text': return { kind: 'variable', variableId: String(block.getFieldValue('VAR') ?? ''), valueType: 'text' };
    case 'capi_variable_get_boolean': return { kind: 'variable', variableId: String(block.getFieldValue('VAR') ?? ''), valueType: 'boolean' };
    case 'capi_counter_value': return { kind: 'counterValue' };
    case 'capi_timer_elapsed': return { kind: 'timerElapsed', timerId: String(block.getFieldValue('TIMER') ?? '') };
    case 'capi_timer_remaining': return { kind: 'timerRemaining', timerId: String(block.getFieldValue('TIMER') ?? '') };
    case 'capi_parameter_number': return { kind: 'parameter', parameterId: String(block.getFieldValue('PARAM') ?? '1'), valueType: 'number' };
    case 'capi_parameter_text': return { kind: 'parameter', parameterId: String(block.getFieldValue('PARAM') ?? '1'), valueType: 'text' };
    case 'capi_parameter_boolean': return { kind: 'parameter', parameterId: String(block.getFieldValue('PARAM') ?? '1'), valueType: 'boolean' };
    case 'capi_function_call_number':
    case 'capi_function_call_text':
    case 'capi_function_call_boolean': {
      const valueType = block.type.endsWith('_text') ? 'text' : block.type.endsWith('_boolean') ? 'boolean' : 'number';
      const args: ValueExpression[] = [];
      for (const name of ['ARG1','ARG2','ARG3']) { const child = block.getInputTargetBlock(name); if (!child) break; args.push(compileValue(child)); }
      return { kind: 'functionCall', routineId: String(block.getFieldValue('ROUTINE') ?? ''), arguments: args, valueType };
    }
    case 'capi_component_number':
    case 'capi_component_text':
    case 'capi_component_boolean': {
      const valueType: VariableType = block.type.endsWith('_text') ? 'text' : block.type.endsWith('_boolean') ? 'boolean' : 'number';
      const deviceId = selectedDeviceId(block);
      const device = (workspaceDevices.get(targetWorkspaceForBlock(block)) ?? []).find(item => item.id === deviceId);
      const property = String(block.getFieldValue(COMPONENT_PROPERTY_FIELD) ?? '');
      const capability = device ? componentValueCapabilities(device).find(item => item.key === property && item.type === valueType) : undefined;
      return { kind: 'componentValue', deviceId, property, valueType, source: (capability?.source ?? 'ordered') as ComponentValueSource };
    }
    case 'capi_sensor_value': return { kind: 'sensorValue', deviceId: selectedDeviceId(block) };
    case 'capi_otto_distance': return { kind: 'ottoDistance', deviceId: selectedDeviceId(block) };
    case 'capi_message_value': return { kind: 'messageValue', deviceId: selectedDeviceId(block) };
    case 'capi_button_pressed': return { kind: 'buttonValue', deviceId: selectedDeviceId(block) };
    case 'capi_barrier_state': return {
      kind: 'barrierValue',
      deviceId: selectedDeviceId(block),
      expected: block.getFieldValue('STATE') === 'CLEAR' ? 'CLEAR' : 'INTERRUPTED',
    };
    case 'capi_display_button_pressed': return {
      kind: 'displayButtonValue', deviceId: selectedDeviceId(block),
      button: String(block.getFieldValue('BUTTON') ?? 'SELECT') as Extract<ValueExpression, { kind: 'displayButtonValue' }>['button'],
    };
    case 'capi_number_math': return {
      kind: 'math',
      operator: block.getFieldValue('OPERATOR'),
      left: compileValue(block.getInputTargetBlock('LEFT'), 'number'),
      right: compileValue(block.getInputTargetBlock('RIGHT'), 'number'),
    };
    case 'capi_text_join': return {
      kind: 'join',
      parts: ['FIRST', 'SECOND', 'THIRD'].map(name => compileValue(block.getInputTargetBlock(name), 'text')),
    };
    case 'capi_wifi_connected': return { kind: 'wifiValue' };
    default: return fallback === 'text' ? { kind: 'text', value: '' } : fallback === 'boolean' ? { kind: 'boolean', value: false } : { kind: 'number', value: 0 };
  }
}

function textExpression(block: BlocklyBlock, field: string, dynamicInput = 'DYNAMIC', dynamicOnly = false): ValueExpression | undefined {
  const dynamic = block.getInputTargetBlock(dynamicInput);
  if (!dynamic) return undefined;
  const value = compileValue(dynamic, 'text');
  if (dynamicOnly) return value;
  const prefix = String(block.getFieldValue(field) ?? '');
  return prefix ? { kind: 'join', parts: [{ kind: 'text', value: prefix }, value] } : value;
}

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
    case 'capi_value_compare':
      return {
        kind: 'valueCompare',
        operator: block.getFieldValue('OPERATOR'),
        left: compileValue(block.getInputTargetBlock('LEFT')),
        right: compileValue(block.getInputTargetBlock('RIGHT')),
      };
    case 'capi_wifi_connected':
      return { kind: 'wifiConnected' };
    case 'capi_button_pressed':
      return { kind: 'buttonPressed', deviceId: selectedDeviceId(block) };
    case 'capi_display_button_pressed':
      return {
        kind: 'displayButtonPressed',
        deviceId: selectedDeviceId(block),
        button: String(block.getFieldValue('BUTTON') ?? 'SELECT') as Extract<Condition, { kind: 'displayButtonPressed' }>['button'],
      };
    case 'capi_sensor_compare':
      return {
        kind: 'sensor',
        deviceId: selectedDeviceId(block),
        sensor: block.getFieldValue('SENSOR'),
        operator: block.getFieldValue('OPERATOR'),
        value: numberField(block, 'VALUE', 2000),
      };
    default:
      return { kind: 'value', expression: compileValue(block, 'boolean') };
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
      case 'capi_timer_start':
        result.push({ op: 'timerStart', timerId: String(block.getFieldValue('TIMER') ?? ''), durationMs: numberField(block, 'SECONDS', 5) * 1000, repeat: block.getFieldValue('MODE') === 'REPEAT', blockId });
        break;
      case 'capi_timer_restart':
      case 'capi_timer_pause':
      case 'capi_timer_resume':
      case 'capi_timer_stop':
      case 'capi_timer_wait': {
        const operations = { capi_timer_restart: 'timerRestart', capi_timer_pause: 'timerPause', capi_timer_resume: 'timerResume', capi_timer_stop: 'timerStop', capi_timer_wait: 'timerWait' } as const;
        result.push({ op: operations[block.type as keyof typeof operations], timerId: String(block.getFieldValue('TIMER') ?? ''), blockId });
        break;
      }
      case 'capi_procedure_call': {
        const args: ValueExpression[] = [];
        for (const name of ['ARG1','ARG2','ARG3']) { const child = block.getInputTargetBlock(name); if (!child) break; args.push(compileValue(child)); }
        result.push({ op: 'procedureCall', routineId: String(block.getFieldValue('ROUTINE') ?? ''), arguments: args, blockId });
        break;
      }
      case 'capi_variable_set_number':
        result.push({ op: 'variableSet', variableId: String(block.getFieldValue('VAR') ?? ''), value: compileValue(block.getInputTargetBlock('VALUE'), 'number'), blockId });
        break;
      case 'capi_variable_set_text':
        result.push({ op: 'variableSet', variableId: String(block.getFieldValue('VAR') ?? ''), value: compileValue(block.getInputTargetBlock('VALUE'), 'text'), blockId });
        break;
      case 'capi_variable_set_boolean':
        result.push({ op: 'variableSet', variableId: String(block.getFieldValue('VAR') ?? ''), value: compileValue(block.getInputTargetBlock('VALUE'), 'boolean'), blockId });
        break;
      case 'capi_variable_change':
        result.push({ op: 'variableChange', variableId: String(block.getFieldValue('VAR') ?? ''), delta: compileValue(block.getInputTargetBlock('DELTA'), 'number'), blockId });
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
      case 'capi_otto':
        result.push({
          op: 'otto',
          deviceId: selectedDeviceId(block),
          action: block.getFieldValue('ACTION'),
          speed: numberField(block, 'SPEED', 60),
          repetitions: numberField(block, 'REPETITIONS', 1),
          blockId,
        });
        break;
      case 'capi_otto_sound':
        result.push({ op: 'ottoSound', deviceId: selectedDeviceId(block), sound: block.getFieldValue('SOUND'), blockId });
        break;
      case 'capi_otto_expression':
        result.push({ op: 'ottoExpression', deviceId: selectedDeviceId(block), expression: block.getFieldValue('EXPRESSION'), blockId });
        break;
      case 'capi_otto_arms':
        result.push({ op: 'ottoArms', deviceId: selectedDeviceId(block), pose: block.getFieldValue('POSE'), blockId });
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
        {
          const expression = textExpression(block, 'TEXT');
        result.push({
          op: 'serial',
          text: String(block.getFieldValue('TEXT') ?? ''),
          ...(expression ? { expression } : {}),
          blockId,
        });
        }
        break;
      case 'capi_message_send':
        {
          const expression = textExpression(block, MESSAGE_FIELD, 'DYNAMIC', true);
        result.push({
          op: 'messageSend',
          deviceId: selectedDeviceId(block),
          text: String(block.getFieldValue(MESSAGE_FIELD) ?? ''),
          ...(expression ? { expression } : {}),
          blockId,
        });
        }
        break;
      case 'capi_message_receive':
        result.push({
          op: 'messageReceive',
          deviceId: selectedDeviceId(block),
          expected: String(block.getFieldValue(MESSAGE_FIELD) ?? ''),
          timeoutMs: numberField(block, 'TIMEOUT', 5) * 1000,
          equal: compileStack(block.getInputTargetBlock('EQUAL')),
          different: compileStack(block.getInputTargetBlock('DIFFERENT')),
          timeout: compileStack(block.getInputTargetBlock('TIMEOUT_DO')),
          blockId,
        });
        break;
      case 'capi_display_write':
        {
          const expression = textExpression(block, 'TEXT');
          result.push({ op: 'displayWrite', deviceId: selectedDeviceId(block), areaId: String(block.getFieldValue(AREA_FIELD) ?? ''), text: String(block.getFieldValue('TEXT') ?? ''), ...(expression ? { expression } : {}), blockId });
        }
        break;
      case 'capi_display_clear':
        result.push({ op: 'displayClear', deviceId: selectedDeviceId(block), areaId: String(block.getFieldValue(AREA_FIELD) ?? ''), blockId });
        break;
      case 'capi_display_animate_text':
        result.push({
          op: 'displayAnimateText',
          deviceId: selectedDeviceId(block),
          areaId: String(block.getFieldValue(AREA_FIELD) ?? ''),
          text: String(block.getFieldValue('TEXT') ?? ''),
          effect: block.getFieldValue('EFFECT') === 'SCROLL' ? 'scroll' : block.getFieldValue('EFFECT') === 'BLINK' ? 'blink' : 'type',
          repeatCount: animationRepeatCount(block),
          blockId,
        });
        break;
      case 'capi_display_artwork':
        result.push({
          op: 'displayArtwork',
          deviceId: selectedDeviceId(block),
          artworkId: String(block.getFieldValue(DISPLAY_ARTWORK_FIELD) ?? ''),
          effect: block.getFieldValue('EFFECT') === 'SLIDE' ? 'slide' : block.getFieldValue('EFFECT') === 'BLINK' ? 'blink' : 'still',
          repeatCount: animationRepeatCount(block),
          blockId,
        });
        break;
      case 'capi_visual_wait':
        result.push({ op: 'visualWait', deviceId: selectedDeviceId(block), blockId });
        break;
      case 'capi_matrix_clear':
        result.push({ op: 'matrixClear', deviceId: selectedDeviceId(block), blockId });
        break;
      case 'capi_matrix_pixel':
        result.push({ op: 'matrixPixel', deviceId: selectedDeviceId(block), x: numberField(block, 'X', 0), y: numberField(block, 'Y', 0), enabled: block.getFieldValue('ENABLED') === 'ON', blockId });
        break;
      case 'capi_matrix_pattern':
        result.push({ op: 'matrixPattern', deviceId: selectedDeviceId(block), patternId: String(block.getFieldValue(PATTERN_FIELD) ?? ''), blockId });
        break;
      case 'capi_matrix_scroll':
        result.push({ op: 'matrixScroll', deviceId: selectedDeviceId(block), text: String(block.getFieldValue('TEXT') ?? '').slice(0, MAX_MATRIX_TEXT), speedMs: numberField(block, 'SPEED', 120), repeatCount: animationRepeatCount(block), blockId });
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
  const routineDefinitions = workspace.getTopBlocks(true).filter(block => block.type === 'capi_procedure_def' || block.type.startsWith('capi_function_def_'));
  const variableName = (id: string) => workspace.getVariableMap().getVariableById(id)?.getName() ?? 'sin nombre';
  const parameters = (block: BlocklyBlock) => {
    const result: Array<{id:string;name:string;type:VariableType}> = [];
    for (let index = 1; index <= 3; index += 1) {
      const type = String(block.getFieldValue(`P${index}_TYPE`) ?? 'none');
      if (type === 'none') break;
      result.push({ id: String(index), name: String(block.getFieldValue(`P${index}_NAME`) ?? `dato ${index}`).slice(0, 24), type: type as VariableType });
    }
    return result;
  };
  return {
    version: 2,
    variables: workspace.getVariableMap().getAllVariables().flatMap(variable => {
      const blocklyType = variable.getType();
      const type = blocklyType === 'String' ? 'text' : blocklyType === 'Boolean' ? 'boolean' : blocklyType === 'Number' ? 'number' : null;
      return type ? [{ id: variable.getId(), name: variable.getName(), type } as const] : [];
    }),
    timers: workspace.getVariableMap().getVariablesOfType('Timer').map(timer => ({ id: timer.getId(), name: timer.getName() })),
    routines: routineDefinitions.map(block => {
      const id = String(block.getFieldValue('ROUTINE') ?? '');
      const functionType = block.type.endsWith('_text') ? 'text' : block.type.endsWith('_boolean') ? 'boolean' : 'number';
      const isFunction = block.type.startsWith('capi_function_def_');
      return { id, name: variableName(id), kind: isFunction ? 'function' as const : 'procedure' as const, ...(isFunction ? { returnType: functionType as VariableType, returnValue: compileValue(block.getInputTargetBlock('RETURN'), functionType as VariableType) } : {}), parameters: parameters(block), body: isFunction ? [] : compileStack(block.getInputTargetBlock('BODY')), blockId: block.id };
    }),
    threads: starts.map((start) => ({
      id: start.id,
      startBlockId: start.id,
      nodes: compileStack(start),
    })),
  };
}

export { DEVICE_FIELD, AREA_FIELD, EMPTY_FAVORITES, serializedAreaIds, workspaceDevices, workspaceBoardProfiles, serializedDeviceIds, toolbox, collectSerializedDeviceIds, registerBlocks, refreshAreaField, refreshMessageField, refreshPatternField, refreshDeviceFields, updateDeviceWarning, ensureSingleStart, compileWorkspace };
