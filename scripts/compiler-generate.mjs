// Fixed generator: no evaluated input, sources, paths or flags from the client.
import * as Blockly from 'blockly';
import { decodeProject, generateEsp32CodeResult, programUsesWifi } from '../lib/capiblocks.ts';
import { espIdfProjectFiles } from '../lib/firmware-archive.ts';
import { registerBlocks, ensureSingleStart, compileWorkspace, workspaceDevices,
  serializedDeviceIds, serializedAreaIds, collectSerializedDeviceIds, refreshDeviceFields } from '../lib/blockly-engine.ts';

export function generateBuild(document, framework, wifi = null) {
  if (!['arduino', 'esp-idf'].includes(framework)) throw new Error('Framework no permitido.');
  const decoded = decodeProject(document);
  if (!decoded.project) throw new Error('Proyecto no válido.');
  const project = decoded.project;
  registerBlocks(Blockly);
  const workspace = new Blockly.Workspace();
  workspaceDevices.set(workspace, project.scene.devices);
  serializedDeviceIds.set(workspace, collectSerializedDeviceIds(project.workspace));
  serializedAreaIds.set(workspace, collectSerializedDeviceIds(project.workspace, 'AREA_ID'));
  Blockly.Events.disable();
  let result;
  try {
    Blockly.serialization.workspaces.load(project.workspace, workspace);
    ensureSingleStart(Blockly, workspace);
    refreshDeviceFields(Blockly, workspace);
    result = generateEsp32CodeResult(compileWorkspace(workspace), project.metadata.title, project.scene, framework);
  } finally { workspace.dispose(); Blockly.Events.enable(); }
  if (result.diagnostics.some(item => item.severity === 'error')) throw new Error('Corregí los bloques y las conexiones antes de compilar.');
  const usesWifi = programUsesWifi(result.program);
  if (usesWifi && !wifi) throw new Error('Este programa necesita configurar Wi-Fi.');
  if (!usesWifi && wifi) throw new Error('Este programa no utiliza Wi-Fi.');
  // Fixed-width octal byte escapes prevent C++/preprocessor injection.
  const literal = value => '"' + [...Buffer.from(value, 'utf8')].map(byte => '\\' + byte.toString(8).padStart(3, '0')).join('') + '"';
  const files = framework === 'esp-idf' ? espIdfProjectFiles(result) : { 'capibloques/capibloques.ino': result.code };
  if (wifi) {
    if (framework === 'esp-idf') files['main/wifi_config.h'] = `#pragma once\n#define CAPI_WIFI_SSID ${literal(wifi.ssid)}\n#define CAPI_WIFI_PASSWORD ${literal(wifi.password)}\n`;
    else files['capibloques/capibloques.ino'] = result.code.replace('const char* WIFI_SSID = "TU_RED";', `const char* WIFI_SSID = ${literal(wifi.ssid)};`).replace('const char* WIFI_PASSWORD = "TU_CLAVE";', `const char* WIFI_PASSWORD = ${literal(wifi.password)};`);
  }
  return { files, usesWifi, program: result.program };
}

if (process.argv[1]?.endsWith('compiler-generate.mjs')) {
  let input = '';
  for await (const part of process.stdin) {
    input += part;
    if (Buffer.byteLength(input) > 2_100_000) process.exit(2);
  }
  try {
    const data = JSON.parse(input);
    const { files, usesWifi } = generateBuild(data.document, data.framework, data.wifi);
    process.stdout.write(JSON.stringify({ files, usesWifi }));
  } catch {
    // Never log submitted fields, generated sources or dependency diagnostics.
    process.stderr.write('No se pudo generar: revisá bloques, conexiones y configuración Wi-Fi.\n');
    process.exitCode = 2;
  }
}
