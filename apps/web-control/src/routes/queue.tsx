import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ImageDto, ImageStatus } from '@photolive/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import * as React from 'react';

type Tab = 'approved' | 'pending' | 'auto-skipped' | 'excluded';

export const Route = createFileRoute('/queue')({
  component: QueuePage,
});

function QueuePage(): JSX.Element {
  const activeEvent = useQuery({ queryKey: ['active-event'], queryFn: api.events.active });
  const [tab, setTab] = React.useState<Tab>('approved');

  if (!activeEvent.data) {
    return (
      <>
        <PageHeader title="Queue" />
        <div className="flex-1 px-6 py-4">
          <EmptyState message="Activate an event to view its queue." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Queue"
        subtitle={activeEvent.data.name}
        actions={<TabBar value={tab} onValueChange={setTab} eventId={activeEvent.data.id} />}
      />
      <div className="flex-1 overflow-auto">
        <ImageGrid eventId={activeEvent.data.id} tab={tab} />
      </div>
    </>
  );
}

function TabBar({
  value,
  onValueChange,
  eventId,
}: {
  value: Tab;
  onValueChange: (t: Tab) => void;
  eventId: string;
}): JSX.Element {
  const counts = useQuery({
    queryKey: ['image-counts', eventId],
    queryFn: () => api.images.list(eventId, { limit: 0 }).then((r) => r.counts),
    refetchInterval: 5_000,
  });

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'approved', label: 'Approved', count: counts.data?.approved ?? 0 },
    { id: 'pending', label: 'Pending', count: counts.data?.pending ?? 0 },
    { id: 'auto-skipped', label: 'Skipped', count: counts.data?.['auto-skipped'] ?? 0 },
    { id: 'excluded', label: 'Excluded', count: counts.data?.excluded ?? 0 },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
      {tabs.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => onValueChange(t.id)}
          className={cn(
            'flex h-6 items-center gap-1.5 rounded px-2.5 text-xs transition-colors',
            value === t.id ? 'bg-zinc-900 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50',
          )}
        >
          {t.label}
          <span className="font-mono tabular-nums text-zinc-500">{t.count}</span>
        </button>
      ))}
    </div>
  );
}

function ImageGrid({ eventId, tab }: { eventId: string; tab: Tab }): JSX.Element {
  const status: ImageStatus[] =
    tab === 'approved'
      ? ['approved']
      : tab === 'pending'
        ? ['pending']
        : tab === 'auto-skipped'
          ? ['auto-skipped']
          : ['excluded'];

  const images = useQuery({
    queryKey: ['images', eventId, tab],
    queryFn: () => api.images.list(eventId, { status }).then((r) => r.images),
    refetchInterval: 3_000,
  });

  if (images.isLoading) {
    return <p className="px-6 py-4 text-sm text-zinc-500">Loading…</p>;
  }

  if (!images.data || images.data.length === 0) {
    return (
      <EmptyState
        message={
          tab === 'pending'
            ? 'Nothing pending. Approval-mode events will land photos here as they arrive.'
            : tab === 'auto-skipped'
              ? 'No images auto-skipped (yet).'
              : tab === 'excluded'
                ? 'No images excluded.'
                : 'No approved images yet.'
        }
      />
    );
  }

  return (
    <div className="grid gap-2 p-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
      {images.data.map((img) => (
        <ImageCell key={img.id} image={img} tab={tab} />
      ))}
    </div>
  );
}

function ImageCell({ image, tab }: { image: ImageDto; tab: Tab }): JSX.Element {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'images' || q.queryKey[0] === 'image-counts',
    });

  const approve = useMutation({
    mutationFn: () => api.images.approve(image.id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => api.images.reject(image.id),
    onSuccess: invalidate,
  });
  const exclude = useMutation({
    mutationFn: () => api.images.exclude(image.id),
    onSuccess: invalidate,
  });
  const include = useMutation({
    mutationFn: () => api.images.include(image.id),
    onSuccess: invalidate,
  });

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded border border-zinc-800 bg-zinc-900"
      style={{
        borderLeftColor: image.photographerColor ?? undefined,
        borderLeftWidth: image.photographerColor ? 4 : undefined,
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-950">
        <img
          src={image.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {image.sharpnessScore != null ? (
          <span className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-300">
            {image.sharpnessScore.toFixed(0)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
        <span className="truncate text-zinc-400">{image.photographerName ?? 'unattributed'}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
          {new Date(image.uploadedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="flex border-t border-zinc-800 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {tab === 'pending' ? (
          <>
            <ActionBtn
              onClick={() => approve.mutate()}
              icon={<Check className="h-3.5 w-3.5" />}
              label="Approve"
              tone="success"
            />
            <ActionBtn
              onClick={() => reject.mutate()}
              icon={<X className="h-3.5 w-3.5" />}
              label="Reject"
              tone="danger"
            />
          </>
        ) : tab === 'approved' ? (
          <ActionBtn
            onClick={() => exclude.mutate()}
            icon={<EyeOff className="h-3.5 w-3.5" />}
            label="Exclude"
            tone="neutral"
          />
        ) : (
          <ActionBtn
            onClick={() => include.mutate()}
            icon={<Eye className="h-3.5 w-3.5" />}
            label="Include"
            tone="neutral"
          />
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  onClick,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: 'success' | 'danger' | 'neutral';
}): JSX.Element {
  const colors = {
    success: 'hover:bg-emerald-500/10 hover:text-emerald-300',
    danger: 'hover:bg-red-500/10 hover:text-red-300',
    neutral: 'hover:bg-zinc-800 hover:text-zinc-50',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-xs text-zinc-400 transition-colors',
        colors[tone],
      )}
    >
      {icon}
      {label}
    </button>
  );
}
