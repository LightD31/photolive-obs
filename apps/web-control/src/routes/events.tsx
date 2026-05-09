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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { EventDto } from '@photolive/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Archive, ArchiveRestore, Plus, Power, Trash2 } from 'lucide-react';
import * as React from 'react';

export const Route = createFileRoute('/events')({
  component: EventsPage,
});

function EventsPage(): JSX.Element {
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ['events'], queryFn: api.events.list });
  const [createOpen, setCreateOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<EventDto | null>(null);

  const activate = useMutation({
    mutationFn: (id: string) => api.events.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => api.events.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
  const unarchive = useMutation({
    mutationFn: (id: string) => api.events.unarchive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  return (
    <>
      <PageHeader
        title="Events"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New event
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        {events.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : events.data && events.data.length > 0 ? (
          <div className="rounded-md border border-zinc-800">
            <Table>
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>Slug</TH>
                  <TH>Mode</TH>
                  <TH>Created</TH>
                  <TH>State</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {events.data.map((event) => (
                  <TR key={event.id} active={event.isActive}>
                    <TD className="font-medium">{event.name}</TD>
                    <TD className="font-mono text-xs text-zinc-400">{event.slug}</TD>
                    <TD className="text-xs text-zinc-400">{event.displayMode}</TD>
                    <TD className="font-mono text-xs text-zinc-400">
                      {new Date(event.createdAt).toLocaleString()}
                    </TD>
                    <TD>
                      {event.archivedAt ? (
                        <Badge tone="neutral">archived</Badge>
                      ) : event.isActive ? (
                        <Badge tone="active">active</Badge>
                      ) : (
                        <Badge tone="neutral">inactive</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="inline-flex gap-1">
                        {!event.isActive && !event.archivedAt && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => activate.mutate(event.id)}
                          >
                            <Power className="h-3 w-3" />
                            Activate
                          </Button>
                        )}
                        {!event.archivedAt ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archive.mutate(event.id)}
                          >
                            <Archive className="h-3 w-3" />
                            Archive
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => unarchive.mutate(event.id)}
                            title="Restore from archive (does not activate)"
                          >
                            <ArchiveRestore className="h-3 w-3" />
                            Unarchive
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(event)}
                          title="Delete permanently"
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
            message="No events yet."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create the first event
              </Button>
            }
          />
        )}
      </div>

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeleteEventDialog event={confirmDelete} onOpenChange={() => setConfirmDelete(null)} />
    </>
  );
}

function DeleteEventDialog({
  event,
  onOpenChange,
}: {
  event: EventDto | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  const qc = useQueryClient();
  const [confirmText, setConfirmText] = React.useState('');

  React.useEffect(() => {
    if (!event) setConfirmText('');
  }, [event]);

  const remove = useMutation({
    mutationFn: (id: string) => api.events.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['active-event'] });
      onOpenChange(false);
    },
  });

  if (!event) return null;
  const matches = confirmText === event.slug;

  return (
    <Dialog open={Boolean(event)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete event permanently?</DialogTitle>
          <DialogDescription>
            This removes <strong>{event.name}</strong> and all its photographers, images, settings,
            and audit history. The photos directory and rendered thumbnails on disk are also
            deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-slug">
            Type the slug <span className="font-mono text-zinc-300">{event.slug}</span> to confirm
          </Label>
          <Input
            id="confirm-slug"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={event.slug}
            className="font-mono"
            autoFocus
          />
        </div>
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
            disabled={!matches || remove.isPending}
            onClick={() => remove.mutate(event.id)}
          >
            {remove.isPending ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateEventDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const qc = useQueryClient();
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [photosDir, setPhotosDir] = React.useState('./data/photos');
  const [displayMode, setDisplayMode] = React.useState('auto');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setPhotosDir('./data/photos');
      setDisplayMode('auto');
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    // Auto-derive slug from name as the user types, until they edit slug manually.
    const auto = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (auto && (slug === '' || slug.startsWith(auto.slice(0, slug.length)))) {
      setSlug(auto);
    }
    // intentionally not depending on slug — only mirror name changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const create = useMutation({
    mutationFn: () => api.events.create({ name, slug, photosDir, displayMode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      onOpenChange(false);
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Failed to create event');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>
            Photos arrive into <span className="font-mono text-zinc-300">photos dir</span>; one
            event is active at a time.
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
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sophie & Marc — 2026-06-12"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="sophie-marc"
              required
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photosDir">Photos directory</Label>
            <Input
              id="photosDir"
              value={photosDir}
              onChange={(e) => setPhotosDir(e.target.value)}
              required
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayMode">Curation mode</Label>
            <Select value={displayMode} onValueChange={setDisplayMode}>
              <SelectTrigger id="displayMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto — display everything</SelectItem>
                <SelectItem value="auto-skip-blurry">
                  auto-skip-blurry — hide low-sharpness shots
                </SelectItem>
                <SelectItem value="approval">approval — operator gates each image</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
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
