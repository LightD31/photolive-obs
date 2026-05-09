import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { PhotographerDto, PhotographerWithSecretDto } from '@photolive/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Copy, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import * as React from 'react';

export const Route = createFileRoute('/photographers')({
  component: PhotographersPage,
});

const COLOR_PRESETS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6'];

function PhotographersPage(): JSX.Element {
  const activeEvent = useQuery({ queryKey: ['active-event'], queryFn: api.events.active });
  const photographers = useQuery({
    queryKey: ['photographers', activeEvent.data?.id],
    queryFn: () => api.photographers.list(activeEvent.data!.id),
    enabled: Boolean(activeEvent.data),
  });
  const [createOpen, setCreateOpen] = React.useState(false);
  const [secretView, setSecretView] = React.useState<PhotographerWithSecretDto | null>(null);
  const [infoView, setInfoView] = React.useState<PhotographerDto | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<PhotographerDto | null>(null);

  const rotate = useMutation({
    mutationFn: (id: string) => api.photographers.rotatePassword(id),
    onSuccess: (next) => setSecretView(next),
  });

  if (!activeEvent.isLoading && !activeEvent.data) {
    return (
      <>
        <PageHeader title="Photographers" />
        <div className="flex-1 px-6 py-4">
          <EmptyState message="Activate an event first to manage its photographers." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Photographers"
        subtitle={activeEvent.data ? `for ${activeEvent.data.name}` : undefined}
        actions={
          <Button
            variant="primary"
            disabled={!activeEvent.data}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add photographer
          </Button>
        }
      />
      <div className="flex-1 overflow-auto px-6 py-4">
        {photographers.data && photographers.data.length > 0 ? (
          <div className="rounded-md border border-zinc-800">
            <Table>
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>FTP username</TH>
                  <TH>State</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {photographers.data.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: p.color }}
                          aria-hidden
                        />
                        <span className="font-medium">{p.displayName}</span>
                      </div>
                    </TD>
                    <TD className="font-mono text-xs text-zinc-400">{p.ftpUsername}</TD>
                    <TD>
                      {p.isActive ? (
                        <Badge tone="active">active</Badge>
                      ) : (
                        <Badge tone="neutral">inactive</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setInfoView(p)}
                          title="Show FTP info (host / username, no password)"
                        >
                          <Eye className="h-3 w-3" />
                          Info
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={rotate.isPending}
                          onClick={() => rotate.mutate(p.id)}
                          title="Generate a new FTP password (invalidates the old one)"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Rotate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(p)}
                          title="Delete photographer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            message="No photographers in this event yet."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add the first one
              </Button>
            }
          />
        )}
      </div>

      {rotate.error ? (
        <div className="px-6 pb-2 text-xs text-red-400">
          Rotate failed: {rotate.error instanceof Error ? rotate.error.message : 'unknown error'}
        </div>
      ) : null}

      <CreatePhotographerDialog
        open={createOpen}
        eventId={activeEvent.data?.id ?? null}
        onOpenChange={setCreateOpen}
        onCreated={(p) => setSecretView(p)}
      />
      <SecretRevealDialog photographer={secretView} onOpenChange={() => setSecretView(null)} />
      <FtpInfoDialog photographer={infoView} onOpenChange={() => setInfoView(null)} />
      <DeletePhotographerDialog
        photographer={confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
      />
    </>
  );
}

function useFtpHost(): { host: string; port: number } {
  const info = useQuery({
    queryKey: ['network-info'],
    queryFn: api.network.info,
    staleTime: 5 * 60 * 1000,
  });
  return {
    host: info.data?.ftpHost ?? window.location.hostname,
    port: info.data?.ftpPort ?? 2121,
  };
}

function CameraFtpSettings({
  host,
  port,
  username,
  password,
}: {
  host: string;
  port: number;
  username: string;
  password?: string;
}): JSX.Element {
  // Sony Alpha menu path: Network -> FTP Transfer Func. -> Server Setting -> Server [N].
  // The A7 IV doesn't support active-mode FTP, so passive must be on. We don't
  // serve TLS, so Secure Protocol must be Off.
  return (
    <div className="space-y-3">
      <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
        On the camera:{' '}
        <span className="text-zinc-300">
          Network → FTP Transfer Func. → Server Setting → Server 1
        </span>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Display Name</dt>
        <dd className="font-mono text-zinc-50">
          PhotoLive <span className="text-zinc-500 italic">(any label)</span>
        </dd>

        <dt className="text-zinc-500">Host Name</dt>
        <dd className="flex items-center gap-1.5 font-mono text-zinc-50">
          {host}
          <CopyButton value={host} />
        </dd>

        <dt className="text-zinc-500">Secure Protocol</dt>
        <dd className="font-mono text-zinc-50">Off</dd>

        <dt className="text-zinc-500">Port</dt>
        <dd className="flex items-center gap-1.5 font-mono text-zinc-50">
          {port}
          <CopyButton value={String(port)} />
        </dd>

        <dt className="text-zinc-500">Specify Directory</dt>
        <dd className="font-mono text-zinc-500 italic">leave empty</dd>

        <dt className="text-zinc-500">User</dt>
        <dd className="flex items-center gap-1.5 font-mono text-zinc-50">
          {username}
          <CopyButton value={username} />
        </dd>

        <dt className="text-zinc-500">Password</dt>
        {password ? (
          <dd className="flex items-center gap-1.5 font-mono text-zinc-50">
            {password}
            <CopyButton value={password} />
          </dd>
        ) : (
          <dd className="text-zinc-500 italic">not retrievable — rotate to issue a new one</dd>
        )}

        <dt className="text-zinc-500">Passive Mode</dt>
        <dd className="font-mono text-zinc-50">On</dd>
      </dl>
      <p className="text-xs text-zinc-400">
        Then enable{' '}
        <span className="text-zinc-300">Network → FTP Transfer Func. → FTP Function: On</span>.
      </p>
    </div>
  );
}

function FtpInfoDialog({
  photographer,
  onOpenChange,
}: {
  photographer: PhotographerDto | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  const { host, port } = useFtpHost();
  if (!photographer) return null;
  return (
    <Dialog open={Boolean(photographer)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>FTP info for {photographer.displayName}</DialogTitle>
          <DialogDescription>
            The password is hashed on the server and can't be retrieved. If you need to share
            credentials again, click <strong>Rotate</strong> to generate a new password.
          </DialogDescription>
        </DialogHeader>
        <CameraFtpSettings host={host} port={port} username={photographer.ftpUsername} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePhotographerDialog({
  photographer,
  onOpenChange,
}: {
  photographer: PhotographerDto | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api.photographers.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photographers'] });
      onOpenChange(false);
    },
  });

  React.useEffect(() => {
    if (!photographer) remove.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photographer]);

  if (!photographer) return null;

  return (
    <Dialog open={Boolean(photographer)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete photographer?</DialogTitle>
          <DialogDescription>
            <strong>{photographer.displayName}</strong> will be removed and their FTP credentials
            invalidated. Photos they already uploaded stay attributed to them historically.
          </DialogDescription>
        </DialogHeader>
        {remove.error ? (
          <p className="text-xs text-red-400">
            {remove.error instanceof Error ? remove.error.message : 'Delete failed'}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(photographer.id)}
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePhotographerDialog({
  open,
  onOpenChange,
  eventId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  onCreated: (p: PhotographerWithSecretDto) => void;
}): JSX.Element {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = React.useState('');
  const [color, setColor] = React.useState<string>(COLOR_PRESETS[0] ?? '#3b82f6');

  React.useEffect(() => {
    if (!open) {
      setDisplayName('');
      setColor(COLOR_PRESETS[0] ?? '#3b82f6');
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () => api.photographers.create(eventId!, { displayName, color }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['photographers'] });
      onOpenChange(false);
      onCreated(p);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add photographer</DialogTitle>
          <DialogDescription>
            FTP credentials are issued automatically. The password is shown <strong>once</strong>{' '}
            after creation — you can rotate it anytime.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alice"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex gap-1">
              {COLOR_PRESETS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-6 w-6 rounded border border-zinc-800 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  style={{
                    backgroundColor: c,
                    outline: c === color ? '2px solid currentColor' : 'none',
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SecretRevealDialog({
  photographer,
  onOpenChange,
}: {
  photographer: PhotographerWithSecretDto | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  const [qr, setQr] = React.useState<string | null>(null);
  const open = Boolean(photographer);
  const { host, port } = useFtpHost();

  React.useEffect(() => {
    if (!photographer) {
      setQr(null);
      return;
    }
    const url = `ftp://${photographer.ftpUsername}:${photographer.ftpPassword}@${host}:${port}`;
    QRCode.toDataURL(url, { margin: 1, width: 192, color: { dark: '#fafafa', light: '#09090b' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [photographer, host, port]);

  if (!photographer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>FTP credentials for {photographer.displayName}</DialogTitle>
          <DialogDescription>
            This is the only time the password is shown. Save it or scan the QR code from the
            camera.
          </DialogDescription>
        </DialogHeader>
        <CameraFtpSettings
          host={host}
          port={port}
          username={photographer.ftpUsername}
          password={photographer.ftpPassword}
        />
        {qr ? (
          <div className="flex justify-center pt-2">
            <img
              src={qr}
              alt="FTP credentials QR code"
              className="rounded border border-zinc-800"
            />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({ value }: { value: string }): JSX.Element {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-50"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={copied ? 'Copied' : 'Copy'}
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}
