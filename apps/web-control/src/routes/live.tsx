import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn, formatLatency } from '@/lib/utils';
import { WsClient } from '@/lib/ws';
import type { ImageDto, SlideshowState } from '@photolive/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Activity, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import * as React from 'react';

export const Route = createFileRoute('/live')({
  component: LivePage,
});

function LivePage(): JSX.Element {
  const activeEvent = useQuery({ queryKey: ['active-event'], queryFn: api.events.active });
  const [state, setState] = React.useState<SlideshowState | null>(null);
  const wsRef = React.useRef<WsClient | null>(null);

  const queue = useQuery({
    queryKey: ['queue', activeEvent.data?.id],
    queryFn: () => api.images.queue(activeEvent.data!.id),
    enabled: Boolean(activeEvent.data),
    refetchInterval: 5_000,
  });

  const latency = useQuery({
    queryKey: ['latency', activeEvent.data?.id],
    queryFn: () => api.images.latency(activeEvent.data!.id),
    enabled: Boolean(activeEvent.data),
    refetchInterval: 4_000,
  });

  React.useEffect(() => {
    const ws = new WsClient('control');
    ws.connect();
    wsRef.current = ws;
    const off1 = ws.on('slideshow.state', setState);
    const off2 = ws.on('slideshow.advanced', () => {
      // image change → refetch queue + latency
      void queue.refetch();
      void latency.refetch();
    });
    return () => {
      off1();
      off2();
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (cmd: 'next' | 'prev' | 'pause' | 'resume') => {
    const ws = wsRef.current;
    if (!ws) return;
    if (cmd === 'next') ws.send('slideshow.next', {});
    if (cmd === 'prev') ws.send('slideshow.prev', {});
    if (cmd === 'pause') ws.send('slideshow.pause', {});
    if (cmd === 'resume') ws.send('slideshow.resume', {});
  };

  if (!activeEvent.data) {
    return (
      <>
        <PageHeader title="Live" />
        <div className="flex-1 px-6 py-4">
          <EmptyState message="Activate an event first." />
        </div>
      </>
    );
  }

  const current = queue.data?.find((i) => i.id === state?.currentImageId);
  const next = queue.data?.find((i) => i.id === state?.nextImageId);

  return (
    <>
      <PageHeader
        title="Live"
        subtitle={activeEvent.data.name}
        actions={<LatencyBadge ms={latency.data ?? null} />}
      />
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
        <div className="grid gap-4 [grid-template-columns:2fr_1fr]">
          <SlidePreview label="Current" image={current ?? null} />
          <SlidePreview label="Next" image={next ?? null} />
        </div>

        <CaptionBox imageId={current?.id ?? null} initial={current?.caption ?? null} />

        <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => send('prev')} title="Previous (←)">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => send(state?.isPlaying ? 'pause' : 'resume')}
              title={state?.isPlaying ? 'Pause (Space)' : 'Resume (Space)'}
            >
              {state?.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => send('next')} title="Next (→)">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
          <div className="font-mono text-xs tabular-nums text-zinc-500">
            queue: {state?.queueLength ?? 0} · pending: {state?.pendingCount ?? 0}
          </div>
        </div>
      </div>
    </>
  );
}

function SlidePreview({ label, image }: { label: string; image: ImageDto | null }): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        {image?.photographerName ? (
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: image.photographerColor ?? '#71717a' }}
            />
            {image.photographerName}
          </span>
        ) : null}
      </div>
      <div className="relative aspect-video overflow-hidden rounded-md border border-zinc-800 bg-black">
        {image ? (
          <img
            src={image.displayUrl}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            no image
          </div>
        )}
      </div>
    </div>
  );
}

function LatencyBadge({ ms }: { ms: number | null }): JSX.Element {
  const tone =
    ms == null
      ? 'text-zinc-500'
      : ms > 15_000
        ? 'text-red-400'
        : ms > 10_000
          ? 'text-amber-400'
          : 'text-zinc-400';
  return (
    <span className={cn('flex items-center gap-1.5 font-mono text-xs tabular-nums', tone)}>
      <Activity className="h-3.5 w-3.5" />
      latency {formatLatency(ms)}
    </span>
  );
}

function CaptionBox({
  imageId,
  initial,
}: {
  imageId: string | null;
  initial: string | null;
}): JSX.Element {
  const qc = useQueryClient();
  const [text, setText] = React.useState(initial ?? '');
  React.useEffect(() => setText(initial ?? ''), [initial, imageId]);

  const save = useMutation({
    mutationFn: () => {
      if (!imageId) throw new Error('no image');
      return api.images.setCaption(imageId, text);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] }),
  });

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (imageId) save.mutate();
      }}
    >
      <Input
        placeholder={imageId ? 'Caption (Enter to save)' : 'No current image'}
        disabled={!imageId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" variant="primary" disabled={!imageId || save.isPending}>
        Save
      </Button>
    </form>
  );
}
