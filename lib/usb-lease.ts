// One owner across flashing, monitor and CapiLink, including other tabs.
// Keep the lease until streams really close; a timeout is not a closed port.
let owner: object | null = null;
export async function acquireUsbLease(identity: object): Promise<() => Promise<void>> {
  if (owner) throw new Error('Otra conexión está usando USB o todavía se está cerrando. Cerrala antes de reintentar.');
  owner = identity;
  let releaseLock: (() => void) | undefined;
  let lockTask: Promise<unknown> | undefined;
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await new Promise<void>((resolve, reject) => {
        lockTask = navigator.locks.request('capibloques-usb', { ifAvailable: true }, async lock => {
          if (!lock) { reject(new Error('Otra pestaña está usando USB. Cerrá su conexión primero.')); return; }
          await new Promise<void>(release => { releaseLock = release; resolve(); });
        });
        void lockTask.catch(reject);
      });
    }
    let releasing: Promise<void> | undefined;
    return () => {
      if (releasing) return releasing;
      releaseLock?.();
      // Await the browser's release, not just the callback's local resolver.
      // Flash -> CapiLink otherwise races its own still-held Web Lock.
      if (!lockTask) { if (owner === identity) owner = null; return releasing = Promise.resolve(); }
      return releasing = lockTask.then(() => { if (owner === identity) owner = null; });
    };
  } catch (error) { if (owner === identity) owner = null; throw error; }
}

export async function usbDeadline<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
