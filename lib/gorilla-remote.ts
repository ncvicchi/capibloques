// Transport-independent control lease. Wall time, never simulation speed.
export const REMOTE_LEASE_MS = 500;
export interface GorillaRemoteConfig {
  missions: string[];
}
export function validGorillaRemote(
  value: unknown,
): value is GorillaRemoteConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as GorillaRemoteConfig;
  return (
    Object.keys(v).join() === 'missions' &&
    Array.isArray(v.missions) &&
    v.missions.length <= 4 &&
    v.missions.every(
      (s, i) =>
        typeof s === 'string' &&
        s === s.trim() &&
        s.length > 0 &&
        s.length <= 32 &&
        v.missions.indexOf(s) === i,
    )
  );
}
export interface RemoteIntent {
  sequence: number;
  ticket: number;
  direction: number;
  rhythm: number;
  mode: number;
  mission: number;
  arm: boolean;
  stop: boolean;
}
export class GorillaRemoteLease {
  session = '';
  sequence = 0;
  ticket = 0;
  issued = 0;
  renewed = 0;
  connected = false;
  armed = false;
  stopped = false;
  direction = 0;
  rhythm = 50;
  mode = 0;
  mission = 0;
  expire(now: number) {
    if (this.connected && now - this.renewed >= REMOTE_LEASE_MS) {
      this.connected = false;
      this.armed = false;
      this.direction = this.mission = 0;
    }
  }
  claim(session: string, now: number, ticket: number) {
    this.expire(now);
    if (this.connected || !session || !Number.isInteger(ticket) || ticket <= 0)
      return false;
    this.session = session;
    this.sequence = 0;
    this.ticket = ticket;
    this.issued = this.renewed = now;
    this.connected = true;
    this.armed = false;
    this.direction = this.mission = this.mode = 0;
    return true;
  }
  accept(
    session: string,
    v: RemoteIntent,
    now: number,
    nextTicket: number,
    busy: boolean,
    turns: boolean,
    missions: number,
  ) {
    this.expire(now);
    if (
      !this.connected ||
      session !== this.session ||
      !v ||
      v.sequence !== this.sequence + 1 ||
      v.ticket !== this.ticket ||
      now - this.issued >= REMOTE_LEASE_MS ||
      ![v.sequence, v.ticket, v.direction, v.rhythm, v.mode, v.mission].every(
        Number.isInteger,
      ) ||
      v.sequence > 0x7fffffff ||
      v.direction < 0 ||
      v.direction > 4 ||
      v.rhythm < 25 ||
      v.rhythm > 100 ||
      ![0, 1].includes(v.mode) ||
      v.mission < 0 ||
      v.mission > missions ||
      typeof v.arm !== 'boolean' ||
      typeof v.stop !== 'boolean' ||
      (!turns && v.direction > 2) ||
      (v.mode === 0 && v.mission !== 0) ||
      (v.mode === 1 && v.direction !== 0)
    )
      return false;
    const changed =
      this.mode !== v.mode ||
      (this.direction !== v.direction &&
        this.direction !== 0 &&
        v.direction !== 0) ||
      (this.mission !== v.mission && this.mission !== 0 && v.mission !== 0);
    this.sequence = v.sequence;
    this.ticket = nextTicket;
    this.issued = this.renewed = now;
    if (v.stop) {
      this.stopped = true;
      this.armed = false;
      this.direction = this.mission = 0;
      return true;
    }
    if (v.arm && v.direction === 0 && v.mission === 0 && !busy) {
      this.stopped = false;
      this.armed = true;
    }
    if (changed || (busy && this.direction === 0 && this.mission === 0))
      this.armed = false;
    this.mode = v.mode;
    this.rhythm = v.rhythm;
    this.direction = this.armed && !this.stopped ? v.direction : 0;
    this.mission = this.armed && !this.stopped ? v.mission : 0;
    return true;
  }
  values() {
    return {
      remoteConnected: this.connected,
      remoteArmed: this.armed,
      remoteStopped: this.stopped,
      remoteDirection: ['quieto', 'adelante', 'atrás', 'izquierda', 'derecha'][
        this.direction
      ],
      remoteRhythm: this.rhythm,
      remoteMode: this.mode ? 'autónomo' : 'manual',
      remoteMission: this.mission,
    };
  }
}
