import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { getToken, setToken } from '@/lib/auth';
import * as React from 'react';

export function LoginGate({ children }: { children: React.ReactNode }): JSX.Element {
  const [hasToken, setHasToken] = React.useState(() => Boolean(getToken()));
  const [value, setValue] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (hasToken) return <>{children}</>;

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
            setHasToken(true);
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
