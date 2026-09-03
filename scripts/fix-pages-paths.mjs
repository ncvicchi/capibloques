import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDirectory = fileURLToPath(
  new URL('../dist/client/', import.meta.url),
);
const textExtensions = new Set(['.html', '.rsc', '.json']);
let changedFiles = 0;

async function visit(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;
    const before = await readFile(path, 'utf8');
    const after = before.replaceAll('/./_next/', './_next/');
    if (after !== before) {
      await writeFile(path, after, 'utf8');
      changedFiles += 1;
    }
  }
}

await visit(outputDirectory);
console.log(
  `Rutas relativas de GitHub Pages verificadas (${changedFiles} archivo(s) ajustado(s)).`,
);
