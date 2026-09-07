import { isProjectLink, type ProjectLink } from './project-library';
import { RecoveryJournal, type DurableSave } from './project-recovery';

export type Account = { id: string; alias: string; displayName: string; roles: string[]; mustChangePassword: boolean };
export type Session = { user: Account | null; csrfToken: string };
export type EditorSession = Session & { user: Account; context: string };

const channelName = 'capibloques-account-session';
const signalKey = 'capibloques-session-change';

// Sólo señales de invalidación: nunca identidad, contraseñas ni cookies.
export function announceSessionChange(changing = false, origin?: string) {
  const message = { changing, origin, at: Date.now(), nonce: Math.random() };
  try { localStorage.setItem(signalKey, JSON.stringify(message)); } catch { /* Canal alternativo abajo. */ }
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(message);
    channel.close();
  }
  window.dispatchEvent(new CustomEvent(channelName, { detail: message }));
}

export function sessionChangePending() {
  try {
    const signal = JSON.parse(localStorage.getItem(signalKey) ?? 'null');
    return signal?.changing === true && Date.now() - signal.at < 30000;
  } catch { return false; }
}

export function watchSessionChange(callback: (changing: boolean) => void, ignoredOrigin?: string) {
  const receive = (data: { changing?: boolean; origin?: string }) => {
    if (ignoredOrigin && data?.origin === ignoredOrigin) return;
    callback(data?.changing === true);
  };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(channelName) : null;
  if (channel) channel.onmessage = event => receive(event.data);
  const storage = (event: StorageEvent) => { if (event.key === signalKey) callback(sessionChangePending()); };
  const local = (event: Event) => receive((event as CustomEvent).detail);
  window.addEventListener('storage', storage);
  window.addEventListener(channelName, local);
  return () => { channel?.close(); window.removeEventListener('storage', storage); window.removeEventListener(channelName, local); };
}

export type AccountDraftStore = ReturnType<typeof createAccountDraftStore>;

// El dueño queda fijado al crear el editor. Nunca se toma de un alias ni de
// una variable global que pueda cambiar mientras hay un autoguardado pendiente.
export function createAccountDraftStore(accountId: string) {
  const prefix = `capibloques-account:${accountId}:`;
  const recovery = new RecoveryJournal(accountId);
  const listeners = new Set<() => void>();
  let loaded: Promise<string | null> | null = null;
  let writes = 0;
  return {
    active: true,
    libraryMode: false,
    remote: null as ProjectLink | null,
    pending: null as DurableSave | null,
    recovery,
    recoveryError: '',
    recovering: false,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    notify() { for (const listener of listeners) listener(); },
    projectKey: `${prefix}project-v2`,
    libraryKey: `${prefix}library-draft-v1`,
    mutedKey: `${prefix}muted`,
    attach(remote: ProjectLink | null) { this.remote = remote; this.libraryMode = true; },
    setPending(pending: DurableSave | null) { this.pending = pending; },
    start(remote: ProjectLink | null) { recovery.newSlot(); this.pending = null; this.attach(remote); },
    legacyRead() {
      const stored = localStorage.getItem(this.libraryKey);
      if (stored) {
        const bundle = JSON.parse(stored) as { version?: number; accountId?: string; document?: string; remote?: unknown };
        if (bundle.version !== 1 || bundle.accountId !== accountId || typeof bundle.document !== 'string' || (bundle.remote !== null && !isProjectLink(bundle.remote))) throw new Error('El borrador de biblioteca necesita recuperación. No se sobrescribió.');
        this.libraryMode = true; this.remote = bundle.remote as ProjectLink | null;
        return bundle.document;
      }
      return localStorage.getItem(this.projectKey);
    },
    read(): Promise<string | null> {
      loaded ??= (async () => {
        try {
          const row = await recovery.restore();
          if (row) { this.attach(row.remote); this.pending = row.pending; return row.document; }
          return await recovery.initialized() ? null : this.legacyRead();
        } catch (error) { this.recoveryError = error instanceof Error ? error.message : 'No pudimos abrir la recuperación local.'; this.notify(); throw error; }
      })();
      return loaded;
    },
    async restore(id: string) {
      const row = await recovery.restore(id);
      if (!row) throw new Error('No encontramos la copia local.');
      this.attach(row.remote); this.pending = row.pending;
      this.notify();
      return row;
    },
    write(value: string) {
      if (!this.active) return;
      writes++; this.recovering = true;
      this.notify();
      void recovery.write({ document: value, remote: this.remote, pending: this.pending }).then(() => {
        this.recovering = --writes > 0; this.recoveryError = ''; this.notify();
      }, error => {
        this.recovering = --writes > 0; this.recoveryError = error instanceof Error ? error.message : 'No pudimos guardar la copia local. Exportá JSON antes de salir.'; this.notify();
      });
    },
    async flush() { await recovery.flush(); },
  };
}
