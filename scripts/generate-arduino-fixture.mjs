import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { generateEsp32CodeResult } from '../lib/capiblocks.ts';
import { firmwareFixture } from './firmware-fixtures.mjs';

const outputArgument = process.argv[2];
if (!outputArgument) throw new Error('Indicar ruta/sketch.ino');
const { scene, program } = firmwareFixture(process.argv[3] === 'auxiliary');
const generated = generateEsp32CodeResult(program, 'Fixture Arduino CI', scene);
const errors = generated.diagnostics.filter(item => item.severity === 'error');
if (errors.length) throw new Error(JSON.stringify(errors));
const outputPath = resolve(outputArgument);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, generated.code, 'utf8');
console.log(outputPath);
