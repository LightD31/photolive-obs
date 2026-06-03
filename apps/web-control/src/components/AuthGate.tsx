import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import {
  bootstrapLogin,
  fetchStatus,
  login,
  onUnauthorized,
  setup,
  setupSecretFromContext,
} from '@/lib/auth';
import { isElectron } from '@/lib/electron';
import * as React from 'react';

type State = 'loading' | 'setup' | 'login' | 'authed';

/**
 * Decide the initial auth state:
 *   1. Desktop (Electron) → try the silent bootstrap auto-login. It returns
 *      `authed`, `setup` (fresh install → show create-admin wizard), or
 *      `unavailable` (secret rejected) which falls through to the status check.
 *   2. Otherwise GET /api/auth/status → setup wizard / login form / authed.
 */
async function determineState(): Promise<State> {
  if (isElectron()) {
    const r = await bootstrapLogin();
    if (r === 'authed') return 'authed';
    if (r === 'setup') return 'setup';
  }
  const status = await fetchStatus();
  if (status.setupRequired) return 'setup';
  if (status.authenticated) return 'authed';
  return 'login';
}

export function AuthGate({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, setState] = React.useState<State>('loading');

  const refresh = React.useCallback(() => {
    determineState()
      .then(setState)
      .catch(() => setState('login'));
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // A 401 from any API call (expired session) drops us back to the gate.
  React.useEffect(() => onUnauthorized(refresh), [refresh]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Checking session…
      </div>
    );
  }
  if (state === 'authed') return <>{children}</>;
  if (state === 'setup') return <SetupForm onDone={() => setState('authed')} />;
  return <LoginForm onDone={() => setState('authed')} />;
}

function Shell({
  subtitle,
  children,
}: { subtitle: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <form
        className="flex w-full max-w-sm flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-6"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="mb-1 flex flex-col gap-0.5">
          <span className="font-mono text-sm font-semibold text-zinc-50">photolive</span>
          <span className="text-xs text-zinc-500">{subtitle}</span>
        </div>
        {children}
      </form>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }): JSX.Element {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (!username || !password) return;
    setSubmitting(true);
    setError(null);
    const res = await login(username, password);
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error ?? 'Login failed');
  };

  return (
    <Shell subtitle="Sign in to the control panel">
      <Field
        id="username"
        label="Username"
        value={username}
        onChange={setUsername}
        autoFocus
        autoComplete="username"
      />
      <Field
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        onEnter={submit}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <Button
        variant="primary"
        type="submit"
        disabled={submitting || !username || !password}
        onClick={submit}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </Shell>
  );
}

function SetupForm({ onDone }: { onDone: () => void }): JSX.Element {
  const ctxSecret = React.useMemo(() => setupSecretFromContext(), []);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const effectiveSecret = ctxSecret ?? secret;

  const submit = async (): Promise<void> => {
    if (!username || !password || !effectiveSecret) return;
    setSubmitting(true);
    setError(null);
    const res = await setup(username, password, effectiveSecret);
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error ?? 'Setup failed');
  };

  return (
    <Shell subtitle="Create the admin account">
      <p className="text-xs text-zinc-500">
        First-time setup. Choose the operator login for this Photolive server.
      </p>
      <Field
        id="username"
        label="Username"
        value={username}
        onChange={setUsername}
        autoFocus
        autoComplete="username"
      />
      <Field
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="At least 8 characters."
        onEnter={submit}
      />
      {ctxSecret ? null : (
        <Field
          id="secret"
          label="Setup token"
          value={secret}
          onChange={setSecret}
          hint="Shown in the server log on first start (or open the setup link it printed)."
          onEnter={submit}
        />
      )}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <Button
        variant="primary"
        type="submit"
        disabled={submitting || !username || !password || !effectiveSecret}
        onClick={submit}
      >
        {submitting ? 'Creating…' : 'Create account'}
      </Button>
    </Shell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoFocus,
  autoComplete,
  hint,
  onEnter,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  hint?: string;
  onEnter?: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
