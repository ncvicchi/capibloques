import assert from 'node:assert/strict';
import {
  examples,
  generateEsp32Code,
  isProjectFile,
  makeProject,
} from '../lib/capiblocks.ts';

const program = [
  { op: 'counterSet', value: 0, blockId: 'counter-set' },
  {
    op: 'repeat',
    count: 3,
    blockId: 'repeat',
    body: [
      { op: 'counterChange', delta: 1, blockId: 'counter-change' },
      { op: 'led', brightness: 65, blockId: 'led' },
      { op: 'wait', ms: 25, blockId: 'wait' },
    ],
  },
  {
    op: 'if',
    condition: { kind: 'counter', operator: 'GTE', value: 3 },
    consequent: [
      { op: 'traffic', color: 'GREEN', blockId: 'traffic' },
      { op: 'servo', angle: 125, blockId: 'servo' },
      {
        op: 'buzzer',
        kind: 'ACTIVE',
        frequency: 880,
        durationMs: 100,
        blockId: 'active-buzzer',
      },
      {
        op: 'tone',
        frequency: 660,
        durationMs: 100,
        blockId: 'passive-buzzer',
      },
      { op: 'robot', action: 'FORWARD', speed: 50, blockId: 'robot' },
      { op: 'pin', pin: 26, value: true, blockId: 'pin' },
      { op: 'wifi', timeoutMs: 5000, blockId: 'wifi' },
      { op: 'serial', text: 'Listo', blockId: 'serial' },
    ],
    otherwise: [{ op: 'traffic', color: 'RED', blockId: 'traffic-error' }],
    blockId: 'if',
  },
];

const code = generateEsp32Code(program, 'Prueba completa');

assert.match(code, /esp32:esp32:d1_uno32/);
assert.match(code, /PIN_RED = D2/);
assert.match(code, /PIN_SERVO = D7/);
assert.match(code, /#include <WiFi\.h>/);
assert.match(code, /ledcAttach\(PIN_SERVO, 50, 16\)/);
assert.match(code, /for \(uint8_t budget = 0; budget < 32;/);
assert.doesNotMatch(code, /delay\s*\(/);
assert.doesNotMatch(code, /PIN_(ACTIVE|PASSIVE)_BUZZER/);
assert.equal(code, generateEsp32Code(program, 'Prueba completa'));

const project = makeProject('Prueba', 'traffic', examples[0].workspace);
const roundTrip = JSON.parse(JSON.stringify(project));
assert.equal(isProjectFile(roundTrip), true);
assert.equal(roundTrip.target.fqbn, 'esp32:esp32:d1_uno32');
assert.equal(roundTrip.target.coreVersion, '3.3.11');
assert.equal(roundTrip.target.pinAssignments.trafficRed, 26);

console.log('Smoke test correcto: JSON y generador ESP32 validados.');
