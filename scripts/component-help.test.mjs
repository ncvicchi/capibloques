import assert from 'node:assert/strict';
import { allComponentHelp, COMPONENT_HELP_VERSION, componentHelp, ottoHelpProfiles } from '../lib/component-help.ts';
import { displayProfiles } from '../lib/display-model.ts';
import { addDeviceToScene, createEmptyScene, sceneComponentCatalog } from '../lib/scene-model.ts';

const entries = allComponentHelp();
const ids = new Set(entries.map(entry => entry.helpId));
assert.equal(ids.size, entries.length, 'cada ficha/perfil debe tener un helpId único');

for (const item of sceneComponentCatalog) {
  const help = componentHelp(item.kind);
  assert.equal(help.helpVersion, COMPONENT_HELP_VERSION);
  assert.equal(help.kind, item.kind);
  assert.equal(help.illustration.type, 'illustrative');
  assert.match(help.illustration.alt, /no es una fotografía/i);
  assert(help.summary.length >= 30 && help.detail.length >= 50);
  assert(help.needs.length && help.care.length && help.firstProgram.length >= 2 && help.troubleshooting.length >= 2);
}

for (const profile of Object.keys(displayProfiles)) assert(ids.has(`component.display.${profile}`), `falta ayuda display ${profile}`);
for (const profile of ottoHelpProfiles) assert(ids.has(`component.otto.${profile}`), `falta ayuda Otto ${profile}`);

for (const item of sceneComponentCatalog) {
  const added = addDeviceToScene(createEmptyScene('Ayuda'), item.kind);
  const help = componentHelp(item.kind, added.device);
  assert(help.friendlyName && help.technicalName && help.behavior && help.capiblocks && help.simulator && help.limits && help.teacher);
}

console.log(`Ayuda contextual: ${entries.length} fichas base/perfil con cobertura completa OK`);
