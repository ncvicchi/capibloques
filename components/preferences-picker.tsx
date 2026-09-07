'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/user-avatar';
import {
  avatarCatalog,
  favoriteCatalog,
  findAvatar,
  PreferenceError,
  validFavorite,
  type Preferences,
} from '@/lib/user-preferences';

export default function PreferencesPicker({
  kind,
  preferences,
  busy,
  verified,
  error: connectionError,
  onRetry,
  onSave,
  onClose,
}: {
  kind: 'avatar' | 'favorites';
  preferences: Preferences;
  busy: boolean;
  verified: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
  onSave: (
    patch: Partial<Pick<Preferences, 'avatarId' | 'favorites'>>,
    version: number,
  ) => Promise<Preferences>;
}) {
  const [avatar, setAvatar] = useState(findAvatar(preferences.avatarId).id);
  const [favorites, setFavorites] = useState(
    preferences.favorites.filter(validFavorite),
  );
  const [base, setBase] = useState(preferences);
  const [category, setCategory] = useState('Todos');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dirty =
    kind === 'avatar'
      ? avatar !== base.avatarId
      : JSON.stringify(favorites) !== JSON.stringify(base.favorites);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const categories = [
    'Todos',
    ...new Set(
      (kind === 'avatar' ? avatarCatalog : favoriteCatalog).map(
        (item) => item.category,
      ),
    ),
  ];
  async function save(overwrite = false) {
    setError('');
    try {
      await onSave(
        kind === 'avatar' ? { avatarId: avatar } : { favorites },
        overwrite ? preferences.version : base.version,
      );
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No pudimos guardar. Tu selección sigue aquí.',
      );
      if (error instanceof PreferenceError && error.code === 'stale_revision')
        setConflict(true);
    }
  }
  function useSaved() {
    setAvatar(findAvatar(preferences.avatarId).id);
    setFavorites(preferences.favorites.filter(validFavorite));
    setBase(preferences);
    setConflict(false);
    setError('');
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) {
            if (dirty) setDiscard(true);
            else onClose();
          }
        }}
      >
        <DialogContent className="preferences-dialog">
          <DialogHeader>
            <DialogTitle>
              {kind === 'avatar'
                ? 'Elegí tu avatar'
                : 'Elegí tus bloques favoritos'}
            </DialogTitle>
            <DialogDescription>
              {kind === 'avatar'
                ? 'Un compañero para tu cuenta. Todos están disponibles; no necesitás subir una foto.'
                : 'Marcá estrellas para encontrar estos bloques en la primera categoría. Guardar los lleva a tu cuenta; Cancelar deja todo como estaba.'}
            </DialogDescription>
          </DialogHeader>
          {kind === 'avatar' && (
            <div className="avatar-preview">
              <UserAvatar id={avatar} size={82} />
              <strong>{findAvatar(avatar).name}</strong>
            </div>
          )}
          <label className="preferences-category">
            Categoría
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={busy}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <fieldset
            className={kind === 'avatar' ? 'avatar-grid' : 'favorite-grid'}
            disabled={busy}
          >
            <legend className="visually-hidden">
              {kind === 'avatar'
                ? 'Avatares disponibles'
                : 'Tipos de bloque favoritos'}
            </legend>
            {kind === 'avatar'
              ? avatarCatalog
                  .filter(
                    (item) =>
                      category === 'Todos' || item.category === category,
                  )
                  .map((item) => (
                    <label
                      key={item.id}
                      className={`avatar-choice ${avatar === item.id ? 'is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="avatar"
                        value={item.id}
                        checked={avatar === item.id}
                        onChange={() => setAvatar(item.id)}
                      />
                      <UserAvatar id={item.id} size={68} decorative />
                      <span>{item.name}</span>
                      {avatar === item.id && <strong>✓ Elegido</strong>}
                    </label>
                  ))
              : favoriteCatalog
                  .filter(
                    (item) =>
                      category === 'Todos' || item.category === category,
                  )
                  .map((item) => (
                    <label
                      key={item.type}
                      className={`favorite-choice ${favorites.includes(item.type) ? 'is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={favorites.includes(item.type)}
                        onChange={(event) =>
                          setFavorites((current) =>
                            event.target.checked
                              ? [...current, item.type]
                              : current.filter((type) => type !== item.type),
                          )
                        }
                      />
                      <span aria-hidden="true">
                        {favorites.includes(item.type) ? '★' : '☆'}
                      </span>
                      <span>
                        {item.name}
                        <small>{item.category}</small>
                      </span>
                    </label>
                  ))}
          </fieldset>
          {kind === 'favorites' && (
            <p>
              {favorites.length} favoritos. Se conserva el orden en que los
              agregás; no se mueve según el uso.
            </p>
          )}
          {(error || connectionError) && (
            <p className="account-error" role="alert">
              {error || connectionError}
            </p>
          )}
          {!verified && (
            <Button variant="outline" disabled={busy} onClick={onRetry}>
              Reintentar conexión de preferencias
            </Button>
          )}
          {conflict && (
            <div className="preferences-conflict">
              <p>
                Hay otra selección guardada. Podés cargarla o reemplazarla
                explícitamente con la que preparaste aquí.
              </p>
              <Button
                variant="outline"
                disabled={busy || !verified}
                onClick={useSaved}
              >
                Usar lo guardado
              </Button>
              <Button
                disabled={busy || !verified}
                onClick={() => void save(true)}
              >
                Guardar mi selección igualmente
              </Button>
            </div>
          )}
          <div className="account-actions">
            <Button
              disabled={busy || !verified || conflict}
              onClick={() => void save()}
            >
              {busy
                ? 'Guardando…'
                : kind === 'avatar'
                  ? 'Guardar avatar'
                  : 'Guardar favoritos'}
            </Button>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Cancelar {kind === 'avatar' ? 'avatar' : 'favoritos'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta selección?</AlertDialogTitle>
            <AlertDialogDescription>
              Todavía no la guardaste. Tus preferencias de la cuenta no
              cambiarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir eligiendo</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>
              Descartar selección
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
