'use client';
import { useState } from 'react';
import UserAvatar from '@/components/user-avatar';
import PreferencesPicker from '@/components/preferences-picker';
import { useAccountPreferences } from '@/components/use-account-preferences';
import { Button } from '@/components/ui/button';

export default function AccountPersonality({
  accountId,
}: {
  accountId: string;
}) {
  const prefs = useAccountPreferences(accountId);
  const [open, setOpen] = useState(false);
  return (
    <section className="account-personality" aria-label="Mi avatar">
      <div>
        <UserAvatar id={prefs.preferences?.avatarId} size={64} />
        <div>
          <h2>Tu compañero de aventuras</h2>
          <p>
            {prefs.preferences?.configured
              ? 'Podés cambiarlo cuando quieras.'
              : 'Elegí un avatar si te gusta; podés seguir programando sin elegirlo.'}
          </p>
        </div>
      </div>
      {prefs.error && (
        <p role="alert" className="account-error">
          {prefs.error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={!prefs.verified}
        onClick={() => setOpen(true)}
      >
        Elegir avatar
      </Button>
      {!prefs.verified && (
        <Button variant="ghost" onClick={() => void prefs.refresh()}>
          Reintentar preferencias
        </Button>
      )}
      {open && prefs.preferences && (
        <PreferencesPicker
          kind="avatar"
          {...prefs}
          preferences={prefs.preferences}
          onSave={prefs.save}
          onRetry={() => void prefs.refresh()}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
