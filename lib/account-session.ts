import { isProjectLink, type ProjectLink } from './project-library';

export type Account = { id: string; alias: string; displayName: string; roles: string[]; mustChangePassword: boolean };
export type Session = { user: Account | null; csrfToken: string };
export type EditorSession = Session & { user: Account; context: string };

const channelName = 'capibloques-account-session';
const signalKey = 'capibloques-session-change';

// Sólo señales de invalidación: nunca identidad, contraseñas ni cookies.
export function announceSessionChange(changing = false) {
  const message = { changing, at: Date.now(), nonce: Math.random() };
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

export function watchSessionChange(callback: (changing: boolean) => void) {
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(channelName) : null;
  if (channel) channel.onmessage = event => callback(event.data?.changing === true);
  const storage = (event: StorageEvent) => { if (event.key === signalKey) callback(sessionChangePending()); };
  const local = (event: Event) => callback((event as CustomEvent).detail?.changing === true);
  window.addEventListener('storage', storage);
  window.addEventListener(channelName, local);
  return () => { channel?.close(); window.removeEventListener('storage', storage); window.removeEventListener(channelName, local); };
}

export type AccountDraftStore = ReturnType<typeof createAccountDraftStore>;

// El dueño queda fijado al crear el editor. Nunca se toma de un alias ni de
// una variable global que pueda cambiar mientras hay un autoguardado pendiente.
export function createAccountDraftStore(accountId: string) {
  const prefix = `capibloques-account:${accountId}:`;
  return {
    active: true,
    libraryMode: false,
    remote: null as ProjectLink | null,
    projectKey: `${prefix}project-v2`,
    libraryKey: `${prefix}library-draft-v1`,
    mutedKey: `${prefix}muted`,
    attach(remote: ProjectLink | null) { this.remote = remote; this.libraryMode = true; },
    read() {
      const stored = localStorage.getItem(this.libraryKey);
      if (stored) {
        const bundle = JSON.parse(stored) as { version?: number; accountId?: string; document?: string; remote?: unknown };
        if (bundle.version !== 1 || bundle.accountId !== accountId || typeof bundle.document !== 'string' || (bundle.remote !== null && !isProjectLink(bundle.remote))) throw new Error('El borrador de biblioteca necesita recuperación. No se sobrescribió.');
        this.libraryMode = true; this.remote = bundle.remote as ProjectLink | null;
        return bundle.document;
      }
      return localStorage.getItem(this.projectKey);
    },
    write(value: string) {
      if (!this.active) return;
      if (this.libraryMode) localStorage.setItem(this.libraryKey, JSON.stringify({ version: 1, accountId, document: value, remote: this.remote }));
      else localStorage.setItem(this.projectKey, value);
    },
  };
}
