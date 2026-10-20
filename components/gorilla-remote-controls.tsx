'use client';
import { useEffect, useRef, useState } from 'react';
import type { GorillaRemoteConfig, RemoteIntent } from '@/lib/gorilla-remote';
export default function GorillaRemoteControls({
  values,
  config,
  turns,
  disabled,
  onChange,
}: {
  values: Record<string, number | string | boolean>;
  config: GorillaRemoteConfig;
  turns: boolean;
  disabled: boolean;
  onChange: (value: object) => void;
}) {
  const [mode, setMode] = useState(0),
    [rhythm, setRhythm] = useState(50);
  const current = useRef({ values, onChange, disabled, mode, rhythm });
  useEffect(() => {
    current.current = { values, onChange, disabled, mode, rhythm };
  });
  const intent = useRef({ direction: 0, mission: 0, arm: false, stop: false });
  const release = () => {
    intent.current.direction = intent.current.mission = 0;
  };
  const disconnect = () => {
    release();
    intent.current.arm = false;
  };
  const [renew, setRenew] = useState(false);
  useEffect(() => {
    if (!renew || disabled) return;
    const timer = setInterval(() => {
      const c = current.current;
      if (c.disabled || document.hidden) return;
      const v: RemoteIntent = {
        ...intent.current,
        mode: c.mode,
        rhythm: c.rhythm,
        sequence: Number(c.values.remoteSequence ?? 0) + 1,
        ticket: Number(c.values.remoteTicket ?? 0),
      };
      c.onChange(v);
      intent.current.arm = intent.current.stop = false;
    }, 100);
    const lose = () => {
      disconnect();
      setRenew(false);
    };
    window.addEventListener('blur', lose);
    document.addEventListener('visibilitychange', lose);
    return () => {
      clearInterval(timer);
      window.removeEventListener('blur', lose);
      document.removeEventListener('visibilitychange', lose);
    };
  }, [renew, disabled]);
  const connected = !!values.remoteConnected && renew && !disabled,
    armed = connected && !!values.remoteArmed && !values.remoteStopped;
  return (
    <fieldset disabled={disabled} className="message-test-panel">
      <legend>🎮 Mando remoto · ensayo en simulador</legend>
      {disabled&&<p>La placa se controla desde su panel local. Este ensayo web no reproduce sus órdenes Wi-Fi ni mide el robot.</p>}
      <output>
        {!connected
          ? 'Mando desconectado'
          : values.remoteStopped
            ? 'Detenido'
            : armed
              ? 'Mando habilitado'
              : values.moving
                ? 'Terminando en apoyo'
                : 'Conectado · habilitá en reposo'}
      </output>
      <button
        type="button"
        onClick={() => {
          disconnect();
          onChange({ claim: true });
          setRenew(true);
        }}
      >
        Conectar mando simulado
      </button>
      <button
        type="button"
        disabled={!connected || !!values.moving}
        onClick={() => {
          release();
          intent.current.arm = true;
        }}
      >
        Habilitar mando en reposo
      </button>
      <label>
        Modo{' '}
        <select
          aria-label="Modo del mando"
          value={mode}
          disabled={!connected}
          onChange={(e) => {
            release();
            setMode(Number(e.target.value));
          }}
        >
          <option value="0">Manual</option>
          <option value="1">Autónomo · misiones</option>
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['Adelante', 'Atrás', 'Izquierda', 'Derecha'].map((name, i) => (
          <button
            type="button"
            key={name}
            style={{ touchAction: 'none', minHeight: 52 }}
            disabled={!armed || mode !== 0 || (i > 1 && !turns)}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              intent.current.direction = i + 1;
              intent.current.mission = 0;
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
          >
            {name}
          </button>
        ))}
      </div>
      <label>
        Ritmo {rhythm}%{' '}
        <input
          type="range"
          aria-label="Ritmo del mando"
          min="25"
          max="100"
          value={rhythm}
          onChange={(e) => setRhythm(Number(e.target.value))}
        />
      </label>
      {config.missions.map((name, i) => (
        <button
          key={name}
          type="button"
          disabled={!armed || mode !== 1}
          onClick={() => {
            release();
            intent.current.mission = i + 1;
          }}
        >
          {name}
        </button>
      ))}
      <button type="button" disabled={!connected} onClick={release}>
        Terminar marcha en apoyo
      </button>
      <button
        type="button"
        disabled={!connected}
        onClick={() => {
          release();
          intent.current.stop = true;
        }}
      >
        DETENER AHORA
      </button>
      <button
        type="button"
        onClick={() => {
          disconnect();
          setRenew(false);
        }}
      >
        Ensayar pérdida de conexión
      </button>
      <small>
        Ejecutá el programa primero. Mantené una dirección presionada. La
        conexión caduca en 500 ms reales, independientemente de la velocidad de
        simulación. Giros sólo con verificación adulta. No manda órdenes a una
        placa física.
      </small>
    </fieldset>
  );
}
