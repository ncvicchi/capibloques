import assert from 'node:assert/strict';
import { drawPixelShape, pixelIsOn, setPixel, transformPixelRows } from '../lib/pixel-art.ts';
import { displayArtworkEffectSteps, displayTextEffectSteps } from '../lib/display-graphics.ts';

let rows = Array(8).fill(0);
rows = drawPixelShape(rows, 16, 'line', { x: 0, y: 0 }, { x: 15, y: 7 });
assert.equal(pixelIsOn(rows, 16, 0, 0), true);
assert.equal(pixelIsOn(rows, 16, 15, 7), true);
rows = drawPixelShape(rows, 16, 'rectangle', { x: 2, y: 2 }, { x: 6, y: 5 });
assert.equal(pixelIsOn(rows, 16, 2, 3), true);
assert.equal(pixelIsOn(rows, 16, 4, 3), false);
rows = drawPixelShape(rows, 16, 'fill', { x: 4, y: 3 }, { x: 4, y: 3 });
assert.equal(pixelIsOn(rows, 16, 4, 3), true);
const flipped = transformPixelRows(setPixel(Array(8).fill(0), 16, { x: 0, y: 0 }, true), 16, 'flip-horizontal');
assert.equal(pixelIsOn(flipped, 16, 15, 0), true);
assert.equal(displayTextEffectSteps('bounce', 16, 2, 32), 32);
assert.equal(displayArtworkEffectSteps('center'), 8);
console.log('Pixel art editor: drawing tools, fill, transforms and bounded effect timelines passed.');
