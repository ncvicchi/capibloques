// Una cadencia compartida por pestaña. Recuperar foco/visibilidad no consulta
// la sesión: los permisos se siguen comprobando en cada operación del servidor.
export const SESSION_REFRESH_MS = 60_000;
type Subscription = { refresh: () => void | Promise<unknown>; pending: boolean };
const subscriptions = new Set<Subscription>();
let disposeClock: (() => void) | undefined;

export function watchPeriodicRefresh(refresh: Subscription['refresh']) {
  const subscription = { refresh, pending: false };
  subscriptions.add(subscription);
  if (!disposeClock) {
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      for (const item of subscriptions) {
        if (item.pending) continue;
        item.pending = true;
        void Promise.resolve().then(() => {
          if (subscriptions.has(item)) return item.refresh();
        }).catch(() => { /* Cada consumidor informa su propio error. */ })
          .finally(() => { item.pending = false; });
      }
    };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) tick(); };
    const timer = window.setInterval(tick, SESSION_REFRESH_MS);
    window.addEventListener('online', tick);
    window.addEventListener('pageshow', restored);
    disposeClock = () => {
      window.clearInterval(timer);
      window.removeEventListener('online', tick);
      window.removeEventListener('pageshow', restored);
      disposeClock = undefined;
    };
  }
  return () => { subscriptions.delete(subscription); if (!subscriptions.size) disposeClock?.(); };
}
