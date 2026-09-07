'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { AutosaveSchedule } from '@/lib/project-autosave';

type Options = {
  identity: string | null;
  fingerprint: string;
  needed: boolean;
  enabled: boolean;
  paused: boolean;
  ready: () => boolean;
  save: () => Promise<boolean>;
};

export function useProjectAutosave(options: Options) {
  const latest = useRef(options);
  const schedule = useRef(new AutosaveSchedule());
  useLayoutEffect(() => {
    latest.current = options;
    schedule.current.observe(
      options.identity,
      options.fingerprint,
      options.needed,
      Date.now(),
    );
  });
  useEffect(() => {
    let disposed = false,
      running = false;
    const heldPointers = new Set<number>();
    const tick = async () => {
      const current = latest.current;
      if (
        disposed ||
        running ||
        !current.enabled ||
        current.paused ||
        !current.identity ||
        !current.needed ||
        !current.ready() ||
        !navigator.onLine ||
        document.visibilityState !== 'visible' ||
        heldPointers.size ||
        !schedule.current.due(Date.now())
      )
        return;
      running = true;
      try {
        const success = await current.save();
        if (!disposed && latest.current.identity === current.identity) {
          schedule.current.result(success, Date.now());
          const fresh = latest.current;
          schedule.current.observe(
            fresh.identity,
            fresh.fingerprint,
            fresh.needed,
            Date.now(),
          );
        }
      } finally {
        running = false;
      }
    };
    const online = () => {
      schedule.current.reconnect();
      void tick();
    };
    const down = (event: PointerEvent) => heldPointers.add(event.pointerId);
    const up = (event: PointerEvent) => heldPointers.delete(event.pointerId);
    const blur = () => heldPointers.clear();
    const timer = window.setInterval(() => void tick(), 250);
    window.addEventListener('online', online);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', blur);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', blur);
    };
  }, []);
}
