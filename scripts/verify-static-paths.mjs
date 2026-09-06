import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
let pages = 0;
async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await verify(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"]*_next\/[^"?#]+)(?:[?#][^"]*)?"/g)];
    for (const [, url] of references) {
      assert.ok(url.startsWith('/_next/'), `Asset relativo o inválido en ${path}: ${url}`);
      await access(join(root, url.slice(1)));
    }
    assert.ok(references.length > 0, `Faltan assets en ${path}`);
    pages++;
  }
}
await verify(root);
await access(join(root, 'cuenta', 'index.html'));
await access(join(root, 'gestion', 'usuarios', 'index.html'));
await access(join(root, 'gestion', 'colegio', 'index.html'));
console.log(`${pages} páginas estáticas verificadas: assets desde raíz, incluidas /cuenta/, /gestion/usuarios/ y /gestion/colegio/.`);
