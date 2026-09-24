import assert from 'node:assert/strict';
import { createCapiRules } from '../lib/capi-rules.ts';
import { generateEsp32CodeResult, generateEspIdfCodeResult, makeProject, decodeProject, validateProgramForScene } from '../lib/capiblocks.ts';
import { addDeviceToScene, createEmptyScene, validateScene } from '../lib/scene-model.ts';

const added = addDeviceToScene(createEmptyScene('Luces RGB'), 'smartLights');
const lights = added.device;
assert.equal(lights.kind, 'smartLights');
assert.equal(lights.config.profile, 'WS2812B');
assert.equal(lights.config.count, 8);
assert.equal(validateScene(added.scene).valid, true);
lights.config.geometry = 'matrix';
lights.config.count = 64;
lights.config.width = 8;
lights.config.height = 8;
lights.config.layout = 'zigzag';
lights.config.origin = 'bottom-right';

const program = { version: 2, variables: [], timers: [], threads: [{ id: 'start', startBlockId: 'start', nodes: [
  { op: 'rgbFill', deviceId: lights.id, color: '#123456', brightness: 35, blockId: 'fill' },
  { op: 'rgbPixel', deviceId: lights.id, pixel: 3, color: '#ff00aa', blockId: 'pixel' },
  { op: 'rgbSegment', deviceId: lights.id, from: 2, to: 7, color: '#00ffaa', blockId: 'segment' },
  { op: 'rgbCoordinate', deviceId: lights.id, x: 2, y: 3, color: '#ffffff', blockId: 'coordinate' },
  { op: 'rgbGradient', deviceId: lights.id, from: 1, to: 8, startColor: '#ff0000', endColor: '#0000ff', blockId: 'gradient' },
  { op: 'rgbPattern', deviceId: lights.id, pattern: 'HEART', color: '#ff2266', blockId: 'pattern' },
  { op: 'rgbAnimation', deviceId: lights.id, effect: 'PULSE', color: '#ffffff', repeat: 2, blockId: 'animation' },
  { op: 'visualWait', deviceId: lights.id, blockId: 'wait-animation' },
] }] };
assert.deepEqual(validateProgramForScene(program, added.scene).filter(item => item.severity === 'error'), []);

const arduino = generateEsp32CodeResult(program, 'Luces RGB', added.scene);
assert.equal(arduino.diagnostics.some(item => item.severity === 'error'), false);
assert.match(arduino.code, /Adafruit_NeoPixel/);
assert.match(arduino.code, /capiRgbService_/);
assert.match(arduino.code, /capiRgbAnimationActive_/);
assert.match(arduino.code, /capiRgbGradient_/);
assert.match(arduino.code, /capiRgbPattern_/);

const idf = generateEspIdfCodeResult(program, 'Luces RGB', added.scene);
assert.equal(idf.diagnostics.some(item => item.severity === 'error'), false);
assert.match(idf.code, /driver\/rmt_tx\.h/);
assert.match(idf.code, /rmt_new_bytes_encoder/);
assert.match(idf.code, /RGB_BYTES_/);

const rules = createCapiRules(program, added.scene, 'wemos-d1-r32');
assert.ok(rules.requiredCapabilities.includes('smart-lights'));
const decoded = decodeProject(JSON.parse(JSON.stringify(makeProject('Luces RGB', added.scene, { blocks: { languageVersion: 0, blocks: [] } }))));
assert.equal(decoded.project?.scene.devices[0].kind, 'smartLights');
console.log('Smart lights: scene, JSON, native generators and interpreter rules passed.');
