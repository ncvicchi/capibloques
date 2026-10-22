import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { gorillaExample } from './gorilla-examples.ts';
import {
  defaultGorillaKinematics,
  gorillaPathPreset,
  // @ts-expect-error Node strip-types runner.
} from './gorilla-kinematics.ts';
export function gorillaPathExample(modular: boolean): ExampleDefinition {
  const e = structuredClone(gorillaExample(modular)),
    robot = e.scene.devices[0];
  if (robot.kind === 'gorilla') {
    robot.config.kinematics = defaultGorillaKinematics();
    robot.config.trajectories = [
      {
        id: 'lift',
        name: 'Levantar y apoyar',
        leg: 0,
        points: gorillaPathPreset('lift'),
      },
      {
        id: 'rectangle',
        name: 'Paso rectangular',
        leg: 0,
        points: gorillaPathPreset('rectangle'),
      },
      {
        id: 'arc',
        name: 'Arco por puntos',
        leg: 0,
        points: gorillaPathPreset('arc'),
      },
    ];
  }
  const visit = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    const b = v as Record<string, unknown>;
    if (b.type === 'capi_gorilla_joint' || b.type === 'capi_gorilla_pair') {
      const fields = b.fields as Record<string, unknown>,
        a = Number(fields.A);
      if (a === 0) {
        b.type = 'capi_gorilla_foot';
        b.fields = {
          DEVICE_ID: 'gorilla-robot',
          INDEX: '0',
          FORWARD: 0,
          UP: 0,
          SECONDS: 1,
        };
      } else {
        b.type = 'capi_gorilla_path';
        b.fields = {
          DEVICE_ID: 'gorilla-robot',
          TRAJECTORY_ID: a > 0 ? 'lift' : 'rectangle',
          TIMES: 1,
        };
      }
    }
    for (const value of Object.values(b))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
  };
  visit(e.workspace);
  const vars = e.workspace.variables as { name: string }[] | undefined;
  if (vars)
    for (const v of vars) {
      if (v.name === 'Pata a referencia') v.name = 'Pie a referencia';
      if (v.name === 'Mover la pata a un lado') v.name = 'Levantar y apoyar';
      if (v.name === 'Mover la pata al otro lado')
        v.name = 'Recorrer un rectángulo';
    }
  e.id = modular ? 'gorillaTrajectoriesProcedures' : 'gorillaTrajectories';
  e.title = modular
    ? 'GorillaBot: trayectorias con procedimientos'
    : 'GorillaBot: trayectorias de una pata';
  e.mission = 'Mové el eje del pie con coordenadas medidas, sin caminar.';
  e.description = modular
    ? 'Solución completa: referencia, levantar/apoyar y rectángulo, tres ciclos en tres procedimientos y dos pestañas. Geometría MG90S v3; montaje sostenido y calibración geométrica pendientes antes de hardware.'
    : 'Solución completa: preparar, referencia y tres ciclos de levantar/apoyar y rectángulo. Incluye un arco editable en la biblioteca. Vista previa en milímetros, no equilibrio ni marcha.';
  return e;
}
