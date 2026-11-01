import assert from 'node:assert/strict';
import { addDeviceToScene, assignSafePins, createEmptyScene, isSceneDefinition, validateScene } from '../lib/scene-model.ts';
import { planTrafficWiring, invertTrafficPins, validDirectTraffic, trafficOrientation } from '../lib/traffic-wiring.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import { generateEsp32CodeResult, makeProject, decodeProject } from '../lib/capiblocks.ts';
import { projectTargetForBoard } from '../lib/board-profiles.ts';

for (const board of ['wemos-d1-r32', 'diymall-esp32-s3-devkitc-v1-n16r8']) {
  let scene = createEmptyScene('Cruce', { canvas: { background: 'crossroads' } });
  for (let count = 1; count <= 4; count++) {
    scene = addDeviceToScene(scene, 'trafficLight', { boardProfile: board }).scene;
    assert.equal(isSceneDefinition(scene), true);
    assert.equal(validateScene(scene, board).hardwareReady, true, JSON.stringify(validateScene(scene, board).issues));
    const traffic = scene.devices;
    assert.equal(traffic.every(device => count <= 2 ? validDirectTraffic(device.pins, board) : device.pins.common == null), true);
    const actualPins = traffic.flatMap(device => [device.pins.common, device.pins.red, device.pins.yellow, device.pins.green]).filter(pin => pin != null);
    assert.equal(new Set(actualPins).size, actualPins.length);
    if (board === 'wemos-d1-r32') {
      assert.equal(actualPins.some(pin => [1, 3, 12, 34, 35, 36, 39].includes(pin)), false);
      if (count <= 2) assert.equal(actualPins.some(pin => [21, 22].includes(pin)), false);
      if (count === 1) assert.deepEqual([traffic[0].pins.common, traffic[0].pins.red, traffic[0].pins.yellow, traffic[0].pins.green], [26, 25, 17, 16]);
      if (count === 2) assert.deepEqual([traffic[1].pins.common, traffic[1].pins.red, traffic[1].pins.yellow, traffic[1].pins.green], [5, 23, 19, 18]);
    }
    const program = { version: 2, threads: [{ id: 'main', startBlockId: 'main', nodes: traffic.map((device, index) => ({ op: 'traffic', deviceId: device.id, color: 'GREEN', blockId: `green-${index}` })) }] };
    const rules = createCapiRules(program, scene, board);
    assert.equal(rules.resourceRequirements.pwmChannels, 0);
    assert.ok(rules.requiredCapabilities.includes('traffic-digital'));
    if (count <= 2) assert.ok(rules.requiredCapabilities.includes('traffic-direct'));
    for (const framework of ['arduino', 'esp-idf']) {
      const code = generateEsp32CodeResult(program, 'Cruce', scene, framework, board);
      assert.equal(code.diagnostics.some(item => item.severity === 'error'), false);
      assert.match(code.code, /uint8_t common/);
      assert.match(code.code, /device.common/);
    }
    assert.ok(decodeProject(makeProject('Cruce', scene, {}, 1, projectTargetForBoard(board))).project);
  }
  const original = planTrafficWiring(board, 1, new Set())[0];
  const reduced = structuredClone(scene);
  reduced.devices = reduced.devices.slice(0, 2);
  assert.equal(assignSafePins(reduced, { boardProfile: board, reassignTraffic: true }).scene.devices.every(device => validDirectTraffic(device.pins, board)), true);
  const inverted = invertTrafficPins(original);
  assert.equal(validDirectTraffic(inverted, board), true);
  assert.equal(trafficOrientation(inverted, board), 'inverted');
  assert.deepEqual(invertTrafficPins(inverted), original);
  const oriented = addDeviceToScene(createEmptyScene('Orientación', { canvas: { background: 'crossroads' } }), 'trafficLight', { boardProfile: board }).scene;
  oriented.devices[0].pins = { ...oriented.devices[0].pins, ...inverted };
  assert.equal(trafficOrientation(assignSafePins(oriented, { boardProfile: board, reassignAll: true }).scene.devices[0].pins, board), 'inverted');
  const virtualProgram = { version: 2, threads: [{ id: 'main', startBlockId: 'main', nodes: [{ op: 'traffic', deviceId: oriented.devices[0].id, color: 'RED', blockId: 'red' }] }] };
  const virtual = createCapiRules(virtualProgram, oriented, 'waveshare-esp32-s3-touch-lcd-5-28117');
  assert.equal(Object.values(virtual.document.resources.devices[0].pins).every(pin => pin === null), true);
  assert.equal(oriented.devices[0].pins.common, inverted.common);
  const held = new Set(Object.values(original));
  const occupied = planTrafficWiring(board, 2, held);
  assert.equal(occupied.flatMap(item => Object.values(item)).filter(pin => pin != null).some(pin => held.has(pin)), false);
  const legacy = structuredClone(scene);
  for (const device of legacy.devices) delete device.pins.common;
  assert.equal(isSceneDefinition(legacy), true);
  assert.deepEqual(assignSafePins(legacy, { boardProfile: board }).scene, legacy);
}
assert.throws(() => createCapiRules({ version: 2, threads: [{ id: 'raw', startBlockId: 'raw', nodes: [{ op: 'pin', pin: 5, value: true, blockId: 'raw' }] }] }, createEmptyScene(), 'wemos-d1-r32'), /GPIO 5/);
console.log('Traffic wiring: 1–4 modules, physical groups/tabs, inversion, conflicts, JSON, exports and zero LEDC channels');
