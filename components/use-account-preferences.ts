'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { watchSessionChange } from '@/lib/account-session';
import {
  isPreferences,
  PreferenceError,
  type Preferences,
} from '@/lib/user-preferences';

const channelName = 'capibloques-preferences';
type PreferenceResponse = {
  preferences?: unknown;
  csrfToken?: unknown;
  error?: string;
  code?: string;
};
function announce() {
  window.dispatchEvent(new Event(channelName));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage('refresh');
    channel.close();
  }
}

export function useAccountPreferences(accountId: string, enabled = true) {
  const [stored, setStored] = useState<{
    id: string;
    value: Preferences;
    csrf: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const verifiedRef = useRef(false);
  const epoch = useRef(0),
    active = useRef(true),
    saving = useRef(false),
    allowed = useRef(enabled);
  const current = useRef(stored);
  useLayoutEffect(() => { allowed.current = enabled; current.current = stored; }, [enabled, stored]);
  const refresh = useCallback(async () => {
    if (
      !allowed.current ||
      saving.current ||
      document.visibilityState !== 'visible'
    )
      return;
    const ticket = ++epoch.current;
    try {
      const response = await fetch('/api/auth/preferences/', {
        cache: 'no-store',
        headers: { 'X-Capi-Account': accountId },
        signal: AbortSignal.timeout(12000),
      });
      const data = (await response.json()) as PreferenceResponse;
      if (!active.current || ticket !== epoch.current) return;
      if (
        !response.ok &&
        [
          'account_changed',
          'login_required',
          'password_change_required',
          'csrf_failed',
        ].includes(data.code ?? '')
      )
        setStored(null);
      if (
        !response.ok ||
        !isPreferences(data.preferences) ||
        typeof data.csrfToken !== 'string'
      )
        throw new Error(
          data.error ||
            'No pudimos cargar tus preferencias. Reintentá sin cerrar el proyecto.',
        );
      setStored({
        id: accountId,
        value: data.preferences,
        csrf: data.csrfToken,
      });
      setError('');
      verifiedRef.current = true;
      setVerified(true);
    } catch (error) {
      if (!active.current || ticket !== epoch.current) return;
      verifiedRef.current = false;
      setVerified(false);
      setError(
        error instanceof Error
          ? error.message
          : 'No pudimos cargar tus preferencias.',
      );
    }
  }, [accountId]);
  useEffect(() => {
    active.current = true;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void refresh();
    });
    const invalidated = () => void refresh();
    const stop = watchSessionChange((changing) => {
      ++epoch.current;
      setStored(null);
      verifiedRef.current = false;
      setVerified(false);
      if (!changing) void refresh();
    });
    const channel =
      'BroadcastChannel' in window ? new BroadcastChannel(channelName) : null;
    if (channel) channel.onmessage = invalidated;
    window.addEventListener('focus', invalidated);
    window.addEventListener(channelName, invalidated);
    document.addEventListener('visibilitychange', invalidated);
    return () => {
      disposed = true;
      active.current = false;
      // Época de red, no una referencia a un nodo DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      stop();
      channel?.close();
      window.removeEventListener('focus', invalidated);
      window.removeEventListener(channelName, invalidated);
      document.removeEventListener('visibilitychange', invalidated);
    };
  }, [refresh, enabled]);
  const save = useCallback(
    async (
      patch: Partial<Pick<Preferences, 'avatarId' | 'favorites'>>,
      version: number,
    ) => {
      const base = current.current;
      if (
        saving.current ||
        !allowed.current ||
        !verifiedRef.current ||
        !base ||
        base.id !== accountId
      )
        throw new PreferenceError(
          'Verificá la conexión antes de guardar preferencias.',
        );
      saving.current = true;
      setBusy(true);
      const ticket = ++epoch.current;
      try {
        const response = await fetch('/api/auth/preferences/', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Capi-Account': accountId,
            'X-CSRFToken': base.csrf,
          },
          body: JSON.stringify({ version, ...patch }),
          signal: AbortSignal.timeout(15000),
        });
        const data = (await response.json()) as PreferenceResponse;
        if (!active.current || ticket !== epoch.current)
          throw new PreferenceError(
            'La sesión cambió. No se aplicará esta respuesta en otra cuenta.',
            'account_changed',
          );
        if (
          isPreferences(data.preferences) &&
          typeof data.csrfToken === 'string'
        )
          setStored({
            id: accountId,
            value: data.preferences,
            csrf: data.csrfToken,
          });
        if (!response.ok) {
          if (
            [
              'account_changed',
              'login_required',
              'password_change_required',
              'csrf_failed',
            ].includes(data.code ?? '')
          )
            setStored(null);
          throw new PreferenceError(
            data.error || 'No se pudieron guardar tus preferencias.',
            data.code,
          );
        }
        if (!isPreferences(data.preferences))
          throw new PreferenceError(
            'La respuesta fue incompleta. Reintentá para verificar el resultado.',
          );
        setError('');
        return data.preferences;
      } finally {
        saving.current = false;
        if (active.current) setBusy(false);
        announce();
      }
    },
    [accountId],
  );
  return {
    preferences: stored?.id === accountId ? stored.value : null,
    error,
    busy,
    verified: verified && enabled,
    refresh,
    save,
  };
}
