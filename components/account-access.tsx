'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Account = { id: string; alias: string; displayName: string; roles: string[]; mustChangePassword: boolean };
type Session = { user: Account | null; csrfToken: string };

export default function AccountAccess() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const knownSession = useRef<Session | null>(null);

  const clearSecrets = useCallback(() => {
    setPassword(''); setNewPassword(''); setConfirmation(''); setShowPassword(false);
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    const current = ++epoch.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      const response = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
      const body = await response.json() as Session;
      if (typeof body.csrfToken !== 'string' || !('user' in body)) throw new Error();
      if (current === epoch.current) {
        if (!quiet || body.user?.id !== knownSession.current?.user?.id || body.user?.mustChangePassword !== knownSession.current?.user?.mustChangePassword) {
          clearSecrets(); setEditingPassword(false);
        }
        knownSession.current = body; setSession(body);
      }
    } catch {
      if (current === epoch.current) {
        knownSession.current = null; setSession(null); clearSecrets();
        setError('No pudimos conectar con las cuentas. Tu proyecto local sigue disponible en el editor.');
      }
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }, [clearSecrets]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(); });
    const onVisible = () => { if (document.visibilityState === 'visible' && !inFlight.current) void refresh(true); };
    const onFocus = () => { if (!inFlight.current) void refresh(true); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    const messages = 'BroadcastChannel' in window ? new BroadcastChannel('capibloques-account-session') : null;
    channel.current = messages;
    if (messages) messages.onmessage = () => { void refresh(true); };
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      messages?.close();
    };
  }, [refresh]);

  async function submit(path: string, payload?: Record<string, string>) {
    if (inFlight.current || !session) return;
    inFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    const current = ++epoch.current;
    try {
      const response = await fetch(`/api/auth/${path}/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': session.csrfToken },
        body: JSON.stringify(payload ?? {}), signal: AbortSignal.timeout(15000),
      });
      const body = await response.json() as Session & { error?: string; code?: string };
      if (current !== epoch.current) return;
      if (!response.ok) {
        if (body.code === 'csrf_failed' || body.code === 'login_required') {
          await refresh();
          setError('Tu sesión cambió. Revisá quién está conectado y volvé a intentar.');
        } else {
          setError(body.error || 'No pudimos completar la acción. Volvé a intentar.');
        }
        return;
      }
      knownSession.current = body; setSession(body); clearSecrets(); setEditingPassword(false);
      setNotice(path === 'password' ? 'Contraseña guardada. Las otras sesiones quedaron cerradas.'
        : path.startsWith('logout') ? 'Sesión cerrada.' : '¡Ya ingresaste!');
      channel.current?.postMessage('changed');
    } catch {
      if (current === epoch.current) {
        // La petición pudo completarse aunque se perdiera la respuesta.
        await refresh();
        setError('Se interrumpió la conexión. Actualizamos el estado; verificá el resultado antes de repetir.');
      }
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }

  const user = session?.user;
  const changing = Boolean(user && (user.mustChangePassword || editingPassword));
  const fieldType = showPassword ? 'text' : 'password';

  return (
    <main className="account-page">
      <Link className="account-back" href="/" prefetch={false}><ArrowLeft size={18} /> Volver al editor local</Link>
      <section className="account-card" aria-labelledby="account-title" aria-busy={loading || busy}>
        <header className="account-heading">
          <span className="brand-mark" aria-hidden="true">🐾</span>
          <div><span className="account-brand">CapiBloques</span><h1 id="account-title">{user ? 'Mi cuenta' : 'Ingresar'}</h1></div>
        </header>
        {loading ? <output>Comprobando tu sesión…</output> : <>
          {error && <p className="account-error" role="alert">{error}</p>}
          {notice && <output className="account-notice">{notice}</output>}
          {!session ? <Button className="account-action" onClick={() => void refresh()}>Reintentar conexión</Button> : !user ? <>
            <p>Usá el alias que te dio tu administrador. No necesitás correo electrónico.</p>
            <form onSubmit={event => { event.preventDefault(); void submit('login', { alias, password }); }}>
              <fieldset disabled={busy}>
                <label htmlFor="account-alias">Alias</label>
                <Input id="account-alias" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={32} required value={alias} onChange={event => setAlias(event.target.value)} />
                <label htmlFor="account-password">Contraseña</label>
                <Input id="account-password" type={fieldType} autoComplete="current-password" maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} />
                <Button type="button" variant="ghost" className="account-reveal" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />} {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</Button>
                <Button className="account-action" type="submit">{busy ? 'Ingresando…' : 'Ingresar'}</Button>
              </fieldset>
            </form>
            <p className="account-help">¿Olvidaste tu contraseña? Pedile ayuda al administrador. No hay registro público.</p>
          </> : <>
            <div className="account-identity"><ShieldCheck aria-hidden="true" /><div><strong>{user.displayName}</strong><span>@{user.alias} · {user.roles.join(' y ')}</span></div></div>
            {changing ? <form onSubmit={event => { event.preventDefault(); void submit('password', { currentPassword: password, newPassword, confirmation }); }}>
              <h2>{user.mustChangePassword ? 'Elegí tu contraseña' : 'Cambiar contraseña'}</h2>
              <p id="password-help">Usá 10 caracteres o más. Una frase que recuerdes es una buena opción. No uses sólo números ni tu alias.</p>
              {user.mustChangePassword && <p className="account-notice">Tu contraseña es temporal. Cambiala antes de usar las funciones de tu cuenta.</p>}
              <fieldset disabled={busy}>
                <label htmlFor="current-password">Contraseña actual</label>
                <Input id="current-password" type={fieldType} autoComplete="current-password" maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} />
                <label htmlFor="new-password">Contraseña nueva</label>
                <Input id="new-password" type={fieldType} autoComplete="new-password" minLength={10} maxLength={256} aria-describedby="password-help" required value={newPassword} onChange={event => setNewPassword(event.target.value)} />
                <label htmlFor="confirm-password">Repetir contraseña nueva</label>
                <Input id="confirm-password" type={fieldType} autoComplete="new-password" minLength={10} maxLength={256} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
                <Button type="button" variant="ghost" className="account-reveal" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />} {showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Button>
                <p className="account-help">Al guardar, las otras sesiones de tu cuenta se cierran.</p>
                <div className="account-actions"><Button className="account-action" type="submit">{busy ? 'Guardando…' : 'Guardar contraseña'}</Button>
                  {!user.mustChangePassword && <Button type="button" variant="outline" className="account-action" onClick={() => { setEditingPassword(false); clearSecrets(); setError(''); }}>Cancelar</Button>}</div>
              </fieldset>
            </form> : <Button variant="outline" className="account-action" disabled={busy} onClick={() => { setEditingPassword(true); setNotice(''); }}><KeyRound /> Cambiar contraseña</Button>}
            <div className="account-session-actions">
              <Button variant="outline" className="account-action" disabled={busy} onClick={() => void submit('logout')}><LogOut /> Cerrar sesión</Button>
              <Button variant="ghost" className="account-action" disabled={busy} onClick={() => void submit('logout-all')}>Cerrar todas mis sesiones</Button>
            </div>
          </>}
        </>}
        <aside className="account-local-note"><strong>El editor todavía guarda en esta computadora.</strong><p>Ingresar no sube tus proyectos a la cuenta ni los separa por usuario. Exportá JSON para llevarte una copia; no uses aún este entorno como biblioteca de alumnos.</p></aside>
      </section>
    </main>
  );
}
