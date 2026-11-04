import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { addDeviceToScene, createSceneFromTemplate } from '../lib/scene-model';
import { projectTargetForBoard } from '../lib/board-profiles';

async function openTraffic(page:Page){
  await mockEditorSession(page);await page.goto('/');await expect(page.locator('.blocklySvg')).toBeVisible();
  let scene=createSceneFromTemplate('intersection');
  while(scene.devices.length<4)scene=addDeviceToScene(scene,'trafficLight').scene;
  scene.devices.forEach((device,i)=>{device.name=`Semáforo ${i+1} en la esquina de la escuela`;if(device.kind==='trafficLight'){device.config.vehicleDisplay=true;device.config.pedestrianDisplay=true;}});
  const project=makeProject('Tráfico: fidelidad',scene,{blocks:{languageVersion:0,blocks:[{type:'capi_start',id:'start'}]}},1,projectTargetForBoard('waveshare-esp32-s3-touch-lcd-5-28117'));
  await page.locator('input[type="file"]').setInputFiles({name:'traffic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  const replacement=page.getByRole('alertdialog',{name:'Antes de reemplazar el editor'});
  await expect(page.getByRole('textbox',{name:'Nombre del proyecto'}).or(replacement)).toBeVisible();
  if(await replacement.isVisible())await replacement.getByRole('button',{name:'Conservar copia local y abrir'}).click();
  await expect(page.getByRole('textbox',{name:'Nombre del proyecto'})).toHaveValue(project.metadata.title);
  return scene;
}

async function composition(stage:Locator){
  return stage.evaluate(element=>{
    const frame=element.getBoundingClientRect();
    return {
      devices:[...element.querySelectorAll<HTMLElement>('[data-device-id]')].map(device=>{const box=device.getBoundingClientRect();return {id:device.dataset.deviceId,x:(box.x+box.width/2-frame.x)/frame.width,y:(box.y+box.height/2-frame.y)/frame.height,width:box.width/frame.width,height:box.height/frame.height};}).sort((a,b)=>a.id!.localeCompare(b.id!)),
      labels:[...element.querySelectorAll<SVGGraphicsElement>('[data-traffic-label]')].map(label=>{const b=label.getBBox();return {id:label.dataset.trafficLabel,x:b.x,y:b.y,width:b.width,height:b.height};}).sort((a,b)=>a.id!.localeCompare(b.id!)),
    };
  });
}

test('tráfico: mismo tamaño, posiciones y nombres en editor, simulador, zoom y ventana pequeña',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const scene=await openTraffic(page);let stage=page.getByTestId('scene-stage').first();
  await expect(stage.locator('[data-traffic-label]')).toHaveCount(4);
  const baseline=await composition(stage);
  for(const actual of baseline.devices){const device=scene.devices.find(d=>d.id===actual.id)!;expect(actual.x).toBeCloseTo(device.position.x/960,2);expect(actual.y).toBeCloseTo(device.position.y/540,2);expect(actual.width).toBeCloseTo(100/960,2);expect(actual.height).toBeCloseTo(88/540,2);}
  for(const label of baseline.labels)for(const other of baseline.labels){if(label.id===other.id)continue;expect(label.x<other.x+other.width&&label.x+label.width>other.x&&label.y<other.y+other.height&&label.y+label.height>other.y).toBe(false);}
  await page.getByRole('button',{name:'Armar escena',exact:true}).click();
  const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Editor de escenas',exact:true})});
  stage=dialog.getByTestId('scene-stage');await expect(stage).toBeVisible();
  const editor=await composition(stage);expect(editor.labels).toEqual(baseline.labels);
  for(let i=0;i<editor.devices.length;i++)for(const key of ['x','y','width','height'] as const)expect(editor.devices[i][key]).toBeCloseTo(baseline.devices[i][key],2);
  await dialog.getByRole('button',{name:'Acercar escena',exact:true}).click();
  expect((await composition(stage)).labels).toEqual(baseline.labels);
  await dialog.getByRole('button',{name:'Ajustar escena',exact:true}).click();
  await page.setViewportSize({width:900,height:800});
  expect((await composition(stage)).labels).toEqual(baseline.labels);
  await page.screenshot({path:info.outputPath('traffic-editor.png')});
  await dialog.getByRole('button',{name:'Guardar escena',exact:true}).click();await expect(dialog).toBeHidden();
  expect((await composition(page.getByTestId('scene-stage').first())).labels).toEqual(baseline.labels);
  expect(errors).toEqual([]);
});

test('tráfico: cambiar nombre, deshacer/rehacer y cancelar conserva la composición publicada',async({page})=>{
  await openTraffic(page);const baseline=await composition(page.getByTestId('scene-stage').first());
  await page.getByRole('button',{name:'Armar escena',exact:true}).click();
  const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Editor de escenas',exact:true})});
  await dialog.locator('[data-device-id]').first().click();
  await dialog.locator('#selected-device-name').fill('Cruce de la biblioteca');
  await dialog.getByRole('button',{name:'Guardar cambios',exact:false}).click();
  await expect(dialog.locator('[data-traffic-label][aria-label="Cruce de la biblioteca"]')).toHaveCount(1);
  await dialog.getByRole('button',{name:'Deshacer último cambio'}).click();expect((await composition(dialog.getByTestId('scene-stage'))).labels).toEqual(baseline.labels);
  await dialog.getByRole('button',{name:'Rehacer último cambio'}).click();await expect(dialog.locator('[data-traffic-label][aria-label="Cruce de la biblioteca"]')).toHaveCount(1);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  const discard=page.getByRole('button',{name:'Salir sin guardar',exact:true});if(await discard.isVisible())await discard.click();
  await expect(dialog).toBeHidden();expect((await composition(page.getByTestId('scene-stage').first())).labels).toEqual(baseline.labels);
});
