export type SceneCamera = { zoom: number; x: number; y: number };
export const fittedCamera: SceneCamera = { zoom: 1, x: 0, y: 0 };
export const MIN_SCENE_ZOOM = 0.25;
export const MAX_SCENE_ZOOM = 4;

/** Camera offsets use viewport pixels; project/device coordinates never change. */
export function zoomScene(camera: SceneCamera, zoom: number, anchor: { x: number; y: number }): SceneCamera {
  const next = Math.max(MIN_SCENE_ZOOM, Math.min(MAX_SCENE_ZOOM, zoom));
  const ratio = next / camera.zoom;
  return { zoom: next, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}

export function constrainCamera(camera: SceneCamera, viewport: { width: number; height: number }, scene: { width: number; height: number }): SceneCamera {
  const scale = Math.min(viewport.width / scene.width, viewport.height / scene.height) * camera.zoom;
  const limitX = Math.max(0, (viewport.width + scene.width * scale) / 2 - 48);
  const limitY = Math.max(0, (viewport.height + scene.height * scale) / 2 - 48);
  return { ...camera, x: Math.max(-limitX, Math.min(limitX, camera.x)), y: Math.max(-limitY, Math.min(limitY, camera.y)) };
}
