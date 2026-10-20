#pragma once
static const char CAPI_REMOTE_PANEL[] = R"CAPIHTML(<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mando GorillaBot</title>
<style>
*{box-sizing:border-box}body{font:18px system-ui;background:#eff5fa;color:#19243d;margin:auto;padding:18px;max-width:580px}h1{font-size:1.5rem}button,input,select{font:inherit;border-radius:12px;padding:12px;border:2px solid #718096}button{background:white;min-height:54px;cursor:pointer}button:disabled{opacity:.45}button:active{background:#c9e9fd}label{display:block;margin:10px 0}input{max-width:100%;width:100%}.pad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:15px 0}.hold{touch-action:none;user-select:none;-webkit-user-select:none}.up{grid-column:2}.left{grid-column:1}.down{grid-column:2}.right{grid-column:3}.stop{background:#b91c36;color:white;width:100%;font-weight:bold}section{background:white;border-radius:16px;padding:14px;margin:12px 0}.info{font-size:.9rem}output{display:block}#status{min-height:3em}#missions button{margin:5px}
</style>
<h1>🦍 Mando GorillaBot</h1><p id="identity">Conectate al robot para ver su proyecto.</p>
<section><label>Clave del mando <input id="key" type="password" maxlength="32" autocomplete="off" placeholder="La muestra CapiBloques al configurar la placa"></label><button id="connect">Conectar mando</button><p id="status" role="status">Sin conexión. El robot no recibe órdenes de este mando.</p></section>
<section><label>Modo <select id="mode" disabled><option value="0">Manual</option><option value="1">Autónomo · misiones</option></select></label><button id="arm" disabled>Habilitar mando en reposo</button>
<div class="pad"><button class="hold up" data-dir="1" disabled>↑ Adelante</button><button class="hold left" data-dir="3" disabled>← Girar</button><button class="hold down" data-dir="2" disabled>↓ Atrás</button><button class="hold right" data-dir="4" disabled>Girar →</button></div>
<label>Ritmo <input id="rhythm" type="range" min="25" max="100" value="50"><output id="pace">50% · no supera el ritmo configurado</output></label><div id="missions"></div>
<button id="finish" disabled>Terminar marcha en apoyo</button><button id="stop" class="stop" disabled>DETENER AHORA</button></section>
<section><output id="activity">Sin telemetría</output><p class="info">Mantené una dirección presionada para caminar. Al soltar termina en apoyo. Si bloqueás el celular o perdés conexión, caduca en 500 ms y finaliza en apoyo. Detener conserva la última orden de los servos: no corta la alimentación ni garantiza equilibrio.</p><details><summary>Datos del robot</summary><pre id="data" style="white-space:pre-wrap"></pre><p class="info">Los ángulos son órdenes, no mediciones físicas.</p></details></section>
<script>
const $=id=>document.getElementById(id);
let session='',sequence=0,ticket=0,timer=0,pending=false,direction=0,mission=0,arm=false,stop=false,last=null,ready=false,held=null,generation=0;
function neutral(){direction=0;mission=0;held=null;}
function disconnect(message){generation++;clearTimeout(timer);session='';ready=false;neutral();arm=false;stop=false;$('status').textContent=message;render();}
function render(){
  $('mode').disabled=!session;$('arm').disabled=!session||!!last?.busy||!last?.running;
  $('finish').disabled=$('stop').disabled=!session;
  for(const b of document.querySelectorAll('[data-dir]'))b.disabled=!ready||$('mode').value!=='0'||(+b.dataset.dir>2&&!last?.turns);
  for(const b of document.querySelectorAll('[data-mission]'))b.disabled=!ready||$('mode').value!=='1';
}
async function request(body){const r=await fetch('/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(450),cache:'no-store'});const v=await r.json();if(!r.ok)throw Error(v.error||'El robot rechazó la orden.');return v;}
function update(v){
  last=v;sequence=v.sequence;ticket=v.ticket;session=v.session;ready=!!v.armed&&!v.stopped&&!!v.running;
  $('identity').textContent=(v.robot||'GorillaBot')+' · '+(v.project||'Proyecto');
  $('status').textContent=v.stopped?'Detenido. Soltá los controles y habilitá nuevamente.':!v.running?'Programa detenido o pausado. Inicialo desde CapiBloques.':ready?'Mando conectado y habilitado.':v.busy?'Terminando en apoyo. Esperá para habilitar.':'Conectado. Habilitá el mando en reposo.';
  $('activity').textContent=(v.busy?'Ejecutando movimiento':'En reposo')+' · Distancia: '+(v.valid?v.distance+' cm':'sin lectura válida')+' · Botón: '+(v.button?'presionado':'suelto')+' · Última marcha: '+(v.outcome||'ninguno');
  $('data').textContent='Ángulos ordenados: '+(v.angles||[]).map(n=>Math.round(n)).join(', ')+(v.error?'\nControlador con error':'');
  const names=JSON.stringify(v.missions||[]);if($('missions').dataset.names!==names){$('missions').dataset.names=names;$('missions').replaceChildren();(v.missions||[]).forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.dataset.mission=String(i+1);b.onclick=()=>{if(ready&&$('mode').value==='1'){neutral();mission=i+1;}};$('missions').append(b);});}
  render();
}
async function pump(){
  if(!session||pending)return;pending=true;const g=generation;const a=arm,s=stop;arm=stop=false;
  try{const v=await request({type:'intent',key:$('key').value,session,sequence:sequence+1,ticket,direction,rhythm:+$('rhythm').value,mode:+$('mode').value,mission,arm:a,stop:s});if(g===generation)update(v);}catch(e){if(g===generation)disconnect('Sin conexión: '+e.message);}finally{pending=false;if(g===generation&&session)timer=setTimeout(pump,100);}
}
$('connect').onclick=async()=>{disconnect('Conectando…');const g=generation;try{const v=await request({type:'claim',key:$('key').value});if(g!==generation)return;$('mode').value='0';update(v);pump();}catch(e){if(g===generation)disconnect(e.message);}};
$('arm').onclick=()=>{neutral();arm=true;};
$('mode').onchange=()=>{neutral();ready=false;render();};
$('finish').onclick=()=>neutral();$('stop').onclick=()=>{neutral();stop=true;ready=false;render();};
$('rhythm').oninput=()=>{$('pace').textContent=$('rhythm').value+'% · se aplica al iniciar cada ciclo';};
for(const b of document.querySelectorAll('[data-dir]')){
  b.onpointerdown=e=>{if(!ready||held!==null)return;e.preventDefault();held=e.pointerId;b.setPointerCapture(e.pointerId);mission=0;direction=+b.dataset.dir;};
  b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{neutral();};
  b.oncontextmenu=e=>e.preventDefault();
}
const keys={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4};let keyboard='';
window.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||e.repeat||!ready||$('mode').value!=='0')return;const d=keys[e.key];if(d&&(!keyboard)&&(d<3||last?.turns)){e.preventDefault();keyboard=e.key;direction=d;mission=0;}if(e.key==='Escape'){$('stop').click();}});
window.addEventListener('keyup',e=>{if(e.key===keyboard){keyboard='';neutral();}});
window.addEventListener('blur',()=>{keyboard='';disconnect('Mando fuera de foco. Reconectá para continuar.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)disconnect('Mando en segundo plano. Reconectá para continuar.');});
window.addEventListener('pagehide',()=>disconnect('Mando cerrado.'));
render();
</script></html>)CAPIHTML";
