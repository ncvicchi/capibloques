'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Condition, ProgramNode } from '@/lib/capiblocks';

type BlocklyApi = typeof import('blockly');
type BlocklyWorkspaceSvg = import('blockly').WorkspaceSvg;
type BlocklyBlock = import('blockly').Block;

export interface BlocklyWorkspaceHandle {
  save(): Record<string, unknown>;
  load(data: Record<string, unknown>): void;
  compile(): ProgramNode[];
  highlight(blockId?: string): void;
  zoomToFit(): void;
}

interface BlocklyWorkspaceProps {
  initialWorkspace: Record<string, unknown>;
  revision: number;
  onChange: (workspace: Record<string, unknown>) => void;
  onBlockSnap?: () => void;
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
  if (Blockly.Blocks.capi_start) return;
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
      message0: '🚦 poner semáforo en %1',
      args0: [
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
    },
    {
      type: 'capi_led',
      message0: '💡 LED con brillo %1 %%',
      args0: [
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
      message0: '🤖 robot %1 a %2 %%',
      args0: [
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
    },
    {
      type: 'capi_servo',
      message0: '🦾 servo a %1 grados',
      args0: [{ type: 'field_angle', name: 'ANGLE', angle: 90 }],
      previousStatement: null,
      nextStatement: null,
      colour: '#328BDD',
      tooltip: 'Mueve el servo a una posición entre 0 y 180 grados.',
    },
    {
      type: 'capi_buzzer',
      message0: '📣 buzzer %1 durante %2 ms',
      args0: [
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
    },
    {
      type: 'capi_tone',
      message0: '🎵 tocar %1 Hz durante %2 ms',
      args0: [
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
    },
    {
      type: 'capi_button_pressed',
      message0: '🔘 botón presionado',
      output: 'Boolean',
      colour: '#CF4EB9',
      tooltip: 'Responde sí cuando el botón está presionado.',
    },
    {
      type: 'capi_sensor_compare',
      message0: '%1 %2 %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'SENSOR',
          options: [
            ['☀️ luz', 'LIGHT'],
            ['🎚️ potenciómetro', 'POTENTIOMETER'],
          ],
        },
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
      return { kind: 'buttonPressed' };
    case 'capi_sensor_compare':
      return {
        kind: 'sensor',
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
          color: block.getFieldValue('COLOR'),
          blockId,
        });
        break;
      case 'capi_led':
        result.push({
          op: 'led',
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
          action: block.getFieldValue('ACTION'),
          speed: numberField(block, 'SPEED', 70),
          blockId,
        });
        break;
      case 'capi_servo':
        result.push({
          op: 'servo',
          angle: numberField(block, 'ANGLE', 90),
          blockId,
        });
        break;
      case 'capi_buzzer':
        result.push({
          op: 'buzzer',
          kind: block.getFieldValue('KIND'),
          frequency: numberField(block, 'FREQUENCY', 660),
          durationMs: numberField(block, 'DURATION', 250),
          blockId,
        });
        break;
      case 'capi_tone':
        result.push({
          op: 'tone',
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

const BlocklyWorkspace = forwardRef<
  BlocklyWorkspaceHandle,
  BlocklyWorkspaceProps
>(function BlocklyWorkspace(
  { initialWorkspace, revision, onChange, onBlockSnap },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<BlocklyWorkspaceSvg | null>(null);
  const blocklyRef = useRef<BlocklyApi | null>(null);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstWorkspaceRef = useRef(initialWorkspace);
  const onChangeRef = useRef(onChange);
  const onBlockSnapRef = useRef(onBlockSnap);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
    onBlockSnapRef.current = onBlockSnap;
  }, [onBlockSnap, onChange]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    void import('blockly').then((Blockly) => {
      if (disposed || !hostRef.current) return;
      blocklyRef.current = Blockly;
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
      Blockly.serialization.workspaces.load(
        firstWorkspaceRef.current,
        workspace,
      );
      workspace.addChangeListener((event) => {
        if (event.isUiEvent) return;
        if (event.type === Blockly.Events.BLOCK_MOVE && event.recordUndo)
          onBlockSnapRef.current?.();
        if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
        changeTimerRef.current = setTimeout(() => {
          if (!workspaceRef.current) return;
          onChangeRef.current(
            Blockly.serialization.workspaces.save(
              workspaceRef.current,
            ) as Record<string, unknown>,
          );
        }, 180);
      });
      resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace));
      resizeObserver.observe(hostRef.current);
      setReady(true);
    });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      workspaceRef.current?.dispose();
      workspaceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !ready ||
      revision === 0 ||
      !workspaceRef.current ||
      !blocklyRef.current
    )
      return;
    const Blockly = blocklyRef.current;
    Blockly.Events.disable();
    try {
      workspaceRef.current.clear();
      Blockly.serialization.workspaces.load(
        initialWorkspace,
        workspaceRef.current,
      );
    } finally {
      Blockly.Events.enable();
    }
    workspaceRef.current.cleanUp();
    workspaceRef.current.zoomToFit();
    onChange(
      Blockly.serialization.workspaces.save(workspaceRef.current) as Record<
        string,
        unknown
      >,
    );
  }, [initialWorkspace, onChange, ready, revision]);

  useImperativeHandle(ref, () => ({
    save() {
      if (!workspaceRef.current || !blocklyRef.current) return {};
      return blocklyRef.current.serialization.workspaces.save(
        workspaceRef.current,
      ) as Record<string, unknown>;
    },
    load(data) {
      if (!workspaceRef.current || !blocklyRef.current) return;
      workspaceRef.current.clear();
      blocklyRef.current.serialization.workspaces.load(
        data,
        workspaceRef.current,
      );
      workspaceRef.current.zoomToFit();
    },
    compile() {
      if (!workspaceRef.current) return [];
      const start = workspaceRef.current
        .getTopBlocks(true)
        .find((block) => block.type === 'capi_start');
      return start ? compileStack(start) : [];
    },
    highlight(blockId) {
      workspaceRef.current?.highlightBlock(blockId ?? null);
    },
    zoomToFit() {
      workspaceRef.current?.zoomToFit();
    },
  }));

  return (
    <div className="blockly-shell">
      {!ready && <div className="editor-loading">Preparando los bloques…</div>}
      <div
        ref={hostRef}
        className="blockly-host"
        aria-label="Editor visual de bloques"
      />
    </div>
  );
});

export default BlocklyWorkspace;
