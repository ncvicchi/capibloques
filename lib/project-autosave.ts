// Sólo planificación del envío. Revisión, identidad y permisos siguen siendo
// responsabilidad del contrato de guardado existente y del servidor.
export class AutosaveSchedule {
  private identity: string | null = null;
  private fingerprint = '';
  private firstChange: number | null = null;
  private lastChange = 0;
  private retryAt = 0;
  private failures = 0;

  observe(
    identity: string | null,
    fingerprint: string,
    needed: boolean,
    now: number,
  ) {
    if (identity !== this.identity || !needed) {
      this.identity = identity;
      this.firstChange = null;
      this.retryAt = 0;
      this.failures = 0;
    }
    if (identity && needed) {
      if (this.firstChange === null) {
        this.firstChange = now;
        this.lastChange = now;
      }
      if (fingerprint !== this.fingerprint) this.lastChange = now;
    }
    this.fingerprint = fingerprint;
  }

  due(now: number) {
    return (
      this.identity !== null &&
      this.firstChange !== null &&
      now >=
        Math.max(
          this.retryAt,
          Math.min(this.lastChange + 1500, this.firstChange + 10000),
        )
    );
  }

  result(success: boolean, now: number) {
    if (success) {
      this.failures = 0;
      this.retryAt = 0;
      // Los cambios hechos mientras se enviaba se agrupan en otro envío.
      this.firstChange = null;
      this.lastChange = now;
    } else {
      this.retryAt =
        now + Math.min(30000, 5000 * 2 ** Math.min(this.failures++, 3));
    }
  }

  reconnect() {
    this.retryAt = 0;
  }
}
