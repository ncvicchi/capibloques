'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { createWeatherWorldState, weatherBindings, weatherSlots, weatherLabels, type WeatherWorldState } from '@/lib/weather-world';
export default function WeatherWorld({ scene, state }: { scene: SceneDefinition; state?: WeatherWorldState }) {
  const b = weatherBindings(scene), roof = scene.devices.find(d => d.id === b.roof);
  const w = state ?? createWeatherWorldState(scene.canvas.weatherEnvironment, roof?.kind === 'servo' ? roof.config.angle : 90);
  const raining = w.environment.condition === 'rain' || w.environment.condition === 'heavyRain', heavy = w.environment.condition === 'heavyRain';
  return <div className="scene-world" data-weather-condition={w.environment.condition} data-weather-night={w.environment.night} data-weather-roof={w.roofAngle.toFixed(1)} data-weather-table={w.tableWater.toFixed(1)} data-weather-detector={w.detectorWater.toFixed(1)}>
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label="Estación meteorológica exterior y puesto con techo móvil">
      <rect width="960" height="540" fill={w.environment.night ? '#2e405e' : '#c3e4ee'} /><rect y="330" width="960" height="210" fill={w.environment.night ? '#637b63' : '#b4cf96'} />
      <path d="M0 390Q220 340 440 405T960 390V540H0Z" fill={w.environment.night ? '#758571' : '#c1d9a8'} />
      <circle cx="70" cy="80" r="27" fill={w.environment.night ? '#f0edce' : '#ffd573'} />
      {w.environment.night && [150, 320, 470, 820, 900].map((x, i) => <circle key={x} cx={x} cy={45 + i % 3 * 22} r="2" fill="#f5f0df" />)}
      {w.environment.condition !== 'sunny' && [200, 480, 760].map(x => <g key={x} fill={raining ? '#9daebd' : '#e5edf1'}><ellipse cx={x} cy="95" rx="85" ry="25" /><circle cx={x - 22} cy="75" r="30" /><circle cx={x + 22} cy="70" r="35" /></g>)}
      {raining && Array.from({ length: heavy ? 50 : 24 }, (_, i) => { const x = 35 + i * 73 % 890, y = 115 + (i * 37 + w.timeMs * (heavy ? 0.15 : 0.09)) % 205; return <path key={i} d={`M${x} ${y}l-4 11`} stroke="#5c9cc5" strokeWidth="2" opacity=".8" />; })}
      <path d="M165 375V180H390" fill="none" stroke="#718f91" strokeWidth="9" /><path d="M140 375h55" stroke="#718f91" strokeWidth="9" />
      <rect x="160" y="203" width="105" height="15" rx="4" fill="#f2eee2" /><path d="M160 197h105m-105-7h105" stroke="#8bb3bc" strokeWidth="5" />
      <rect x="325" y="202" width="40" height="20" rx="7" fill="#eedda2" /><path d="M330 365h80" stroke="#637b81" strokeWidth="12" />
      <rect x="350" y="346" width="40" height="16" rx="3" fill="#81b0be" /><path d="M354 350h32m-32 5h32" stroke="#407c92" strokeWidth="2" />
      <path d="M600 245V415M850 245V415" stroke="#997457" strokeWidth="9" /><rect x="590" y="300" width="270" height="20" rx="5" fill="#b48d67" /><path d="M620 320V370M830 320V370" stroke="#997457" strokeWidth="8" />
      <ellipse cx="730" cy="306" rx={Math.max(1, w.tableWater * 1.05)} ry="9" fill="#74b3d3" opacity={w.tableWater ? '.85' : '0'} />
      <rect x="600" y="230" width="250" height="13" rx="4" fill="#c79b62" stroke="#927251" strokeWidth="3" transform={`rotate(${-w.roofAngle * 0.75} 600 238)`} />
      {weatherSlots.map(slot => { const name = scene.devices.find(d => d.id === b[slot.role])?.name ?? `${slot.name} · falta`; return <text key={slot.role} x={slot.x} y={slot.y + 33} textAnchor="middle" fontSize="12" fontWeight="800" fill={w.environment.night ? '#fff1d7' : '#2d4d51'}><title>{name}</title>{name.length > 24 ? name.slice(0, 23) + '…' : name}</text>; })}
      <text x="40" y="38" fontSize="22" fontWeight="900" fill={w.environment.night ? '#f1eddb' : '#2d4d51'}>ESTACIÓN METEOROLÓGICA</text>
      <text x="40" y="435" fontSize="16" fill={w.environment.night ? '#fff1d7' : '#2d4d51'}>{weatherLabels[w.environment.condition]} · {w.environment.night ? 'Noche' : 'Día'}</text>
      <text x="40" y="465" fontSize="14" fill={w.environment.night ? '#fff1d7' : '#2d4d51'}>{w.temperature.toFixed(1)} °C · Humedad {w.humidity.toFixed(1)}% · {w.pressure.toFixed(1)} hPa</text>
      <text x="40" y="492" fontSize="14" fill={w.environment.night ? '#fff1d7' : '#2d4d51'}>Detector mojado: {w.detectorWater.toFixed(0)}% (no mide mm)</text>
      <text x="40" y="518" fontSize="13" fill={w.environment.night ? '#fff1d7' : '#2d4d51'}>Mesa mojada: {w.tableWater.toFixed(0)}% · consecuencia visual, no sensor</text>
    </svg>
  </div>;
}
