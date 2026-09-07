import {
  isProjectLink,
  projectFingerprint,
  type ProjectLink,
} from './project-library';
import { decodeProject } from './capiblocks';

// Sólo recuperación local. PostgreSQL sigue siendo la fuente del proyecto guardado.
export const RECOVERY_DB = 'capibloques-recovery';
const TABLE = 'drafts';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const LIMIT_BYTES = 50 * 1024 * 1024;
const LIMIT_DRAFTS = 30;
export type DurableSave = {
  copy: boolean;
  url: string;
  method: 'POST' | 'PUT';
  body: string;
  fingerprint: string;
};
export type RecoveryDraft = {
  id: string;
  accountId: string;
  version: 1;
  sequence: number;
  updatedAt: number;
  title: string;
  document: string;
  remote: ProjectLink | null;
  pending: DurableSave | null;
  bytes: number;
};
type Slot = { id: string; sequence: number };
type Usage = {
  initialized: true;
  count: number;
  bytes: number;
  updatedAt: number;
  epoch?: number;
  lastRemoval?: string;
};
export type RecoverySnapshot = { accountId: string; epoch: number; updatedAt: number; removalId: string; rows: RecoveryDraft[] };
function usage(value: Usage | undefined): Usage {
  if (!value) return { initialized: true, count: 0, bytes: 0, updatedAt: 0 };
  if (
    !value.initialized ||
    ![value.count, value.bytes, value.updatedAt, value.epoch ?? 0].every(
      (number) => Number.isSafeInteger(number) && number >= 0,
    )
  )
    throw new Error(
      'Los metadatos de recuperación necesitan revisión. No se sobrescribieron.',
    );
  return value;
}

function validate(row: RecoveryDraft, accountId: string): RecoveryDraft {
  if (
    !row ||
    row.accountId !== accountId ||
    row.version !== 1 ||
    !UUID.test(row.id) ||
    !Number.isSafeInteger(row.sequence) ||
    row.sequence < 1 ||
    typeof row.document !== 'string' ||
    row.document.length > 2 * 1024 * 1024 ||
    (row.remote !== null && !isProjectLink(row.remote))
  )
    throw new Error(
      'Una copia local está dañada. No la sobrescribimos. Exportá tu editor antes de continuar.',
    );
  const decoded = decodeProject(JSON.parse(row.document));
  if (!decoded.project)
    throw new Error('La copia local no contiene un proyecto compatible.');
  if (row.pending) {
    const op = row.pending;
    if (
      typeof op.body !== 'string' ||
      op.body.length > 3 * 1024 * 1024 ||
      typeof op.copy !== 'boolean'
    )
      throw new Error('El envío pendiente no es válido.');
    const body = JSON.parse(op.body);
    const document = decodeProject(body.document).project;
    if (
      !UUID.test(body.operationId) ||
      !document ||
      projectFingerprint(document) !== op.fingerprint ||
      !(
        (op.method === 'POST' &&
          op.url === '/api/projects/' &&
          UUID.test(body.id)) ||
        (op.method === 'PUT' &&
          /^\/api\/projects\/[a-f0-9-]{36}\/$/i.test(op.url) &&
          Number.isSafeInteger(body.revision) &&
          body.revision > 0 &&
          row.remote?.id === op.url.split('/')[3])
      )
    )
      throw new Error(
        'El envío pendiente no coincide con su proyecto. No se envió.',
      );
  }
  return row;
}

// Cada pestaña tiene su revisión local. Si otra escribió la misma copia, se
// bifurca en la transacción en vez de sobreescribirla (también al duplicar tabs).
export class RecoveryJournal {
  private connection: Promise<IDBDatabase> | null = null;
  private slot: Slot = { id: crypto.randomUUID(), sequence: 0 };
  private tail: Promise<void> = Promise.resolve();
  private failure: unknown = null;
  private epoch: number | null = null;
  readonly pointerKey: string;
  constructor(readonly accountId: string) {
    this.pointerKey = `capibloques-account:${accountId}:recovery-tab`;
  }
  get id() {
    return this.slot.id;
  }
  newSlot() {
    this.slot = { id: crypto.randomUUID(), sequence: 0 };
  }

  private db() {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(RECOVERY_DB, 1);
      const timeout = window.setTimeout(
        () =>
          reject(
            new Error(
              'La recuperación local no responde. Cerrá otras pestañas y reintentá.',
            ),
          ),
        10000,
      );
      request.onupgradeneeded = () => {
        const table = request.result.createObjectStore(TABLE, {
          keyPath: 'id',
        });
        table.createIndex('account', 'accountId');
        table.createIndex('recent', ['accountId', 'updatedAt']);
        request.result.createObjectStore('accounts');
      };
      request.onsuccess = () => {
        window.clearTimeout(timeout);
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        window.clearTimeout(timeout);
        reject(request.error);
      };
      request.onblocked = () => {
        window.clearTimeout(timeout);
        reject(
          new Error(
            'Otra pestaña bloquea la recuperación local. Cerrala y recargá.',
          ),
        );
      };
    });
    return this.connection;
  }

  async list() {
    const db = await this.db();
    return new Promise<RecoveryDraft[]>((resolve, reject) => {
      const tx = db.transaction([TABLE, 'accounts'], 'readonly');
      const request = tx
        .objectStore(TABLE)
        .index('account')
        .getAll(this.accountId);
      tx.oncomplete = () => {
        try {
          resolve(
            (request.result as RecoveryDraft[])
              .map((row) => validate(row, this.accountId))
              .sort((a, b) => b.updatedAt - a.updatedAt),
          );
        } catch (error) {
          reject(error);
        }
      };
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async restore(id?: string) {
    await this.flush();
    let pointer: string | null = null;
    try {
      pointer = sessionStorage.getItem(this.pointerKey);
    } catch {
      /* Recuperar la más reciente. */
    }
    const db = await this.db();
    const row = await new Promise<RecoveryDraft | null>((resolve, reject) => {
      const tx = db.transaction([TABLE, 'accounts'], 'readonly');
      const account = tx.objectStore('accounts').get(this.accountId);
      const table = tx.objectStore(TABLE);
      let found: RecoveryDraft | null = null;
      const recent = () => {
        const cursor = table
          .index('recent')
          .openCursor(
            IDBKeyRange.bound(
              [this.accountId, 0],
              [this.accountId, Number.MAX_SAFE_INTEGER],
            ),
            'prev',
          );
        cursor.onsuccess = () => {
          found = cursor.result?.value ?? null;
        };
      };
      if (id || pointer) {
        const request = table.get(id ?? pointer!);
        request.onsuccess = () => {
          if (request.result?.accountId === this.accountId)
            found = request.result;
          else if (!id) recent();
        };
      } else recent();
      tx.oncomplete = () => {
        try {
          const epoch = usage(account.result).epoch ?? 0;
          if (this.epoch !== null && this.epoch !== epoch) throw new Error('Las copias locales se retiraron desde otra pestaña. Recargá antes de continuar.');
          this.epoch = epoch;
          resolve(found ? validate(found, this.accountId) : null);
        } catch (error) {
          reject(error);
        }
      };
      tx.onabort = () => reject(tx.error);
    });
    if (id && !row) throw new Error('Esta copia local ya no está disponible.');
    if (row) {
      this.slot = { id: row.id, sequence: row.sequence };
      this.remember(this.slot);
    }
    return row ?? null;
  }

  async initialized() {
    const db = await this.db();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('accounts', 'readonly');
      const request = tx.objectStore('accounts').get(this.accountId);
      tx.oncomplete = () => resolve(request.result?.initialized === true);
      tx.onabort = () => reject(tx.error);
    });
  }

  private remember(slot: Slot) {
    try {
      sessionStorage.setItem(this.pointerKey, slot.id);
    } catch {
      /* El listado sigue disponible. */
    }
  }

  write(value: {
    document: string;
    remote: ProjectLink | null;
    pending: DurableSave | null;
  }) {
    // Congelar asociación y contenido antes de encolar: un cambio de proyecto
    // no puede desviar una escritura previa al siguiente proyecto.
    const slot = this.slot;
    const snapshot = structuredClone(value);
    const task = this.tail.then(async () => {
      const db = await this.db();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([TABLE, 'accounts'], 'readwrite', {
          durability: 'strict',
        });
        const table = tx.objectStore(TABLE);
        const current = table.get(slot.id);
        const account = tx.objectStore('accounts').get(this.accountId);
        let saved: RecoveryDraft;
        let failure: unknown;
        const write = () => {
          if (current.readyState !== 'done' || account.readyState !== 'done')
            return;
          try {
            const previous = current.result as RecoveryDraft | undefined;
            const meta = usage(account.result);
            this.epoch ??= meta.epoch ?? 0;
            if (this.epoch !== (meta.epoch ?? 0)) throw new Error('Las copias locales se retiraron desde otra pestaña. No volvimos a crearlas. Recargá antes de continuar.');
            const fork = previous
              ? previous.accountId !== this.accountId ||
                previous.sequence !== slot.sequence
              : slot.sequence !== 0;
            const id = fork ? crypto.randomUUID() : slot.id;
            saved = {
              ...snapshot,
              version: 1,
              id,
              accountId: this.accountId,
              sequence: fork ? 1 : slot.sequence + 1,
              updatedAt: Math.max(Date.now(), meta.updatedAt + 1),
              title: String(
                JSON.parse(snapshot.document).metadata?.title ?? 'Mi proyecto',
              ).slice(0, 80),
              bytes: 0,
            };
            saved.bytes = new TextEncoder().encode(
              JSON.stringify(saved),
            ).byteLength;
            const count = meta.count + (previous && !fork ? 0 : 1);
            const bytes =
              meta.bytes -
              (previous && !fork ? previous.bytes : 0) +
              saved.bytes;
            if (
              count > LIMIT_DRAFTS ||
              bytes > LIMIT_BYTES ||
              !Number.isSafeInteger(bytes) ||
              bytes < 0
            )
              throw new Error(
                'Llegaste al límite de 30 copias locales o 50 MB. Exportá y quitá una copia desde Mis proyectos. No borramos tu trabajo.',
              );
            table.put(saved);
            tx.objectStore('accounts').put(
              {
                ...meta,
                initialized: true,
                count,
                bytes,
                updatedAt: saved.updatedAt,
              } satisfies Usage,
              this.accountId,
            );
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
        current.onsuccess = write;
        account.onsuccess = write;
        tx.oncomplete = () => {
          slot.id = saved.id;
          slot.sequence = saved.sequence;
          if (this.slot === slot) this.remember(slot);
          resolve();
        };
        tx.onabort = () =>
          reject(
            failure ??
              tx.error ??
              new Error('No pudimos conservar la copia local.'),
          );
        tx.onerror = () => {
          failure ??= tx.error;
        };
      });
    });
    this.tail = task.then(
      () => {
        this.failure = null;
      },
      (error) => {
        this.failure = error;
      },
    );
    return task;
  }

  async flush() {
    await this.tail;
    if (this.failure) throw this.failure;
  }

  async remove(id: string, sequence: number, discardingCurrent = false) {
    if (id === this.id && !discardingCurrent)
      throw new Error('No se puede quitar la copia que está abierta.');
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([TABLE, 'accounts'], 'readwrite', {
        durability: 'strict',
      });
      const table = tx.objectStore(TABLE),
        request = table.get(id);
      let error: unknown;
      const account = tx.objectStore('accounts').get(this.accountId);
      const remove = () => {
        if (request.readyState !== 'done' || account.readyState !== 'done')
          return;
        const row = request.result as RecoveryDraft | undefined;
        if (
          !row ||
          row.accountId !== this.accountId ||
          row.sequence !== sequence
        ) {
          error = new Error(
            'La copia cambió en otra pestaña. Actualizá antes de quitarla.',
          );
          tx.abort();
          return;
        }
        try {
          const meta = usage(account.result);
          table.delete(id);
          tx.objectStore('accounts').put(
            { ...meta, count: meta.count - 1, bytes: meta.bytes - row.bytes },
            this.accountId,
          );
        } catch (failure) {
          error = failure;
          tx.abort();
        }
      };
      request.onsuccess = remove;
      account.onsuccess = remove;
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(error ?? tx.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async discardCurrent() {
    await this.flush();
    if (this.slot.sequence)
      await this.remove(this.id, this.slot.sequence, true);
    this.newSlot();
  }

  async snapshot(): Promise<RecoverySnapshot> {
    await this.flush();
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TABLE, 'accounts'], 'readonly');
      const account = tx.objectStore('accounts').get(this.accountId);
      const rows = tx.objectStore(TABLE).index('account').getAll(this.accountId);
      tx.oncomplete = () => {
        try {
          const meta = usage(account.result);
          resolve({ accountId: this.accountId, epoch: meta.epoch ?? 0, updatedAt: meta.updatedAt, removalId: crypto.randomUUID(), rows: rows.result.map(row => validate(row, this.accountId)) });
        } catch (error) { reject(error); }
      };
      tx.onabort = () => reject(tx.error);
    });
  }

  // Retira exactamente el conjunto confirmado, nunca los cambios que otra
  // pestaña escribió después de la vista previa. La época bloquea escritores
  // viejos incluso si no recibieron BroadcastChannel o estuvieron congelados.
  async removeAll(snapshot: RecoverySnapshot) {
    if (snapshot.accountId !== this.accountId) throw new Error('La cuenta de las copias cambió.');
    await this.flush();
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([TABLE, 'accounts'], 'readwrite', { durability: 'strict' });
      const table = tx.objectStore(TABLE), accounts = tx.objectStore('accounts');
      const account = accounts.get(this.accountId);
      const rows = table.index('account').getAll(this.accountId);
      let failure: unknown;
      const remove = () => {
        if (account.readyState !== 'done' || rows.readyState !== 'done') return;
        try {
          const meta = usage(account.result);
          if (meta.lastRemoval === snapshot.removalId) return;
          if ((meta.epoch ?? 0) !== snapshot.epoch || meta.updatedAt !== snapshot.updatedAt ||
              rows.result.length !== snapshot.rows.length || rows.result.some(row => !snapshot.rows.some(expected => expected.id === row.id && expected.sequence === row.sequence))) {
            throw new Error('Las copias cambiaron en otra pestaña. No se quitaron: ingresá nuevamente para revisarlas.');
          }
          for (const row of rows.result) table.delete(row.id);
          accounts.put({ initialized: true, count: 0, bytes: 0, updatedAt: Math.max(Date.now(), meta.updatedAt + 1), epoch: snapshot.epoch + 1, lastRemoval: snapshot.removalId } satisfies Usage, this.accountId);
        } catch (error) { failure = error; tx.abort(); }
      };
      account.onsuccess = remove; rows.onsuccess = remove;
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('No se pudieron quitar las copias locales.'));
    });
    try { sessionStorage.removeItem(this.pointerKey); } catch { /* La referencia no contiene el documento. */ }
  }
}
