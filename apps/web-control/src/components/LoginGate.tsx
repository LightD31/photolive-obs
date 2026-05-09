import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { clearToken, getToken, setToken } from '@/lib/auth';
import { getBootstrap } from '@/lib/electron';
import * as React from 'react';

export function LoginGate({ children }: { children: React.ReactNode }): JSX.Element {
  // First-paint precedence:
  //   1. localStorage (returning user, possibly across reloads)
  //   2. Electron preload bootstrap (window.photolive.bootstrap.token)
  //      — fresh launch where the desktop app generated/owns the token
  //   3. show the manual entry form (browser tab w/ unfamiliar token)
  // Once we resolve from (2), persist to localStorage so subsequent reloads
  // skip the bootstrap path and the token survives if Electron quits.
  React.useEffect(() => {
    if (getToken()) return;
    const boot = getBootstrap();
    if (boot?.token) setToken(boot.token);
  }, []);

  // 'checking' on mount when a stored token exists — verify it before letting children render.
  // Otherwise a rotated/stale token would silently 401 every API call.
  const [status, setStatus] = React.useState<'checking' | 'ok' | 'needs-token'>(() => {
    if (getToken()) return 'checking';
    if (getBootstrap()?.token) return 'checking';
    return 'needs-token';
  });
  const [value, setValue] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status !== 'checking') return;
    const token = getToken();
    if (!token) {
      setStatus('needs-token');
      return;
    }
    fetch('/api/events', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.ok) {
          setStatus('ok');
        } else if (res.status === 401) {
          clearToken();
          setStatus('needs-token');
        } else {
          // Server unreachable / 5xx — let the child app render and surface the error itself
          // rather than blocking on the gate.
          setStatus('ok');
        }
      })
      .catch(() => setStatus('ok'));
  }, [status]);

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Checking session…
      </div>
    );
  }
  if (status === 'ok') return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <form
        className="flex w-full max-w-sm flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!value) return;
          setSubmitting(true);
          setError(null);
          // Test the token against /api/events. If 401, reject.
          const res = await fetch('/api/events', {
            headers: { Authorization: `Bearer ${value}` },
          });
          setSubmitting(false);
          if (res.ok) {
            setToken(value);
            setStatus('ok');
          } else if (res.status === 401) {
            setError('Token rejected');
          } else {
            setError(`Server returned ${res.status}`);
          }
        }}
      >
        <div className="mb-1 flex flex-col gap-0.5">
          <span className="font-mono text-sm font-semibold text-zinc-50">photolive</span>
          <span className="text-xs text-zinc-500">Control panel</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="token">Auth token</Label>
          <Input
            id="token"
            type="password"
            autoFocus
            placeholder="Bearer token"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-zinc-500">
            Find it in your <span className="font-mono">.env</span> as{' '}
            <span className="font-mono text-zinc-300">PHOTOLIVE_AUTH_TOKEN</span>.
          </p>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <Button variant="primary" type="submit" disabled={submitting || !value}>
          {submitting ? 'Verifying…' : 'Continue'}
        </Button>
      </form>
    </div>
  );
}
