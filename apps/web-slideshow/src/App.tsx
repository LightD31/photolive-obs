import type {
  EventDto,
  ImageDto,
  ServerEventMap,
  SettingsDto,
  SlideshowState,
  Transition,
} from '@photolive/shared';
import { DEFAULT_SETTINGS } from '@photolive/shared';
import * as React from 'react';

/**
 * Slideshow page. Audience-facing. Has to render correctly on PC browser, OBS
 * browser source, and Chromecast/Apple TV. Pure CSS transitions, no framework
 * other than React itself.
 *
 * Auth: ?token=<bearer> in the URL. The token is also passed to the WS upgrade.
 */

function getQueryToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

interface SlideState {
  current: ImageDto | null;
  prev: ImageDto | null;
}

interface Connection {
  state: 'connecting' | 'open' | 'closed';
  attempts: number;
}

type AuthStatus = 'ok' | 'missing-token' | 'invalid-token';

export function App(): JSX.Element {
  const [event, setEvent] = React.useState<EventDto | null>(null);
  const [settings, setSettings] = React.useState<SettingsDto>(DEFAULT_SETTINGS);
  const [slideshow, setSlideshow] = React.useState<SlideshowState | null>(null);
  const [conn, setConn] = React.useState<Connection>({ state: 'connecting', attempts: 0 });
  const [{ current, prev }, setSlide] = React.useState<SlideState>({ current: null, prev: null });
  const [imageMap, setImageMap] = React.useState<Map<string, ImageDto>>(new Map());
  const [authStatus, setAuthStatus] = React.useState<AuthStatus>('ok');
  const wsRef = React.useRef<WebSocket | null>(null);

  const token = getQueryToken() ?? '';

  // Bootstrap: fetch active event + settings via REST, then open WS.
  React.useEffect(() => {
    if (!token) {
      setAuthStatus('missing-token');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const eventRes = await fetch('/api/events/active', { headers });
        if (eventRes.status === 401) {
          if (!cancelled) setAuthStatus('invalid-token');
          return;
        }
        if (!eventRes.ok) {
          if (!cancelled) setConn({ state: 'closed', attempts: 0 });
          return;
        }
        if (!cancelled) setAuthStatus('ok');
        const eventBody = (await eventRes.json()) as { event: EventDto | null };
        const ev = eventBody.event;
        if (!ev) {
          if (!cancelled) setEvent(null);
          return;
        }
        if (cancelled) return;
        setEvent(ev);
        const [settingsRes, queueRes] = await Promise.all([
          fetch(`/api/events/${ev.id}/settings`, { headers }),
          fetch(`/api/events/${ev.id}/images/queue`, { headers }),
        ]);
        if (settingsRes.ok) {
          const body = (await settingsRes.json()) as { settings: SettingsDto };
          if (!cancelled) setSettings(body.settings);
        }
        if (queueRes.ok) {
          const body = (await queueRes.json()) as { images: ImageDto[] };
          if (!cancelled) {
            setImageMap((map) => {
              const next = new Map(map);
              for (const img of body.images) next.set(img.id, img);
              return next;
            });
          }
        }
      } catch {
        if (!cancelled) setConn({ state: 'closed', attempts: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // WebSocket
  React.useEffect(() => {
    if (authStatus !== 'ok') return;
    let intentional = false;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws?role=slideshow&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setConn({ state: 'connecting', attempts });

      ws.onopen = () => {
        attempts = 0;
        setConn({ state: 'open', attempts: 0 });
      };
      ws.onmessage = (msg) => {
        let parsed: { type: keyof ServerEventMap; payload: unknown };
        try {
          parsed = JSON.parse(msg.data);
        } catch {
          return;
        }
        handleServerEvent(parsed.type, parsed.payload);
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (intentional) return;
        attempts++;
        setConn({ state: 'closed', attempts });
        const delay = Math.min(15_000, 500 * 2 ** attempts);
        reconnectTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    const handleServerEvent = <K extends keyof ServerEventMap>(
      type: K,
      rawPayload: unknown,
    ): void => {
      const payload = rawPayload as ServerEventMap[K];
      switch (type) {
        case 'event.activated':
        case 'event.updated':
          setEvent((payload as ServerEventMap['event.activated']).event);
          break;
        case 'settings.updated':
          setSettings((payload as ServerEventMap['settings.updated']).settings);
          break;
        case 'slideshow.state':
          setSlideshow(payload as ServerEventMap['slideshow.state']);
          break;
        case 'slideshow.advanced': {
          const p = payload as ServerEventMap['slideshow.advanced'];
          setSlideshow((prev) =>
            prev ? { ...prev, currentImageId: p.currentImageId, nextImageId: p.nextImageId } : prev,
          );
          break;
        }
        case 'image.added':
        case 'image.updated': {
          const p = payload as ServerEventMap['image.added'] | ServerEventMap['image.updated'];
          setImageMap((map) => {
            const next = new Map(map);
            next.set(p.image.id, p.image);
            return next;
          });
          break;
        }
        case 'image.removed': {
          const p = payload as ServerEventMap['image.removed'];
          setImageMap((map) => {
            const next = new Map(map);
            next.delete(p.imageId);
            return next;
          });
          break;
        }
        default:
          break;
      }
    };

    connect();
    return () => {
      intentional = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [token, authStatus]);

  // Toggle the transparent-background class on <html> so OBS Browser Source
  // can composite the slideshow over the scene below.
  React.useEffect(() => {
    const root = document.documentElement;
    if (settings.transparentBackground) {
      root.classList.add('pl-transparent');
      return () => root.classList.remove('pl-transparent');
    }
    root.classList.remove('pl-transparent');
  }, [settings.transparentBackground]);

  // When the current image id changes, animate it in.
  React.useEffect(() => {
    if (!slideshow) return;
    const id = slideshow.currentImageId;
    const next = id ? imageMap.get(id) : null;
    if (!next) return;
    setSlide((s) => (s.current?.id === next.id ? s : { current: next, prev: s.current }));
  }, [slideshow?.currentImageId, imageMap]);

  if (authStatus !== 'ok') {
    return <AuthError status={authStatus} />;
  }
  if (!event) {
    return <ConnectionState conn={conn} message="Waiting for active event…" />;
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden text-zinc-50 ${settings.transparentBackground ? '' : 'bg-black'}`}
    >
      <SlideLayer
        image={prev}
        transition={settings.transition}
        durationMs={settings.transitionDurationMs}
        direction="out"
        layer="prev"
      />
      <SlideLayer
        image={current}
        transition={settings.transition}
        durationMs={settings.transitionDurationMs}
        direction="in"
        layer="current"
      />
      <Overlays event={event} image={current} settings={settings} />
      {conn.state !== 'open' ? <ConnectionDot conn={conn} /> : null}
    </div>
  );
}

function SlideLayer({
  image,
  transition,
  durationMs,
  direction,
  layer,
}: {
  image: ImageDto | null;
  transition: Transition;
  durationMs: number;
  direction: 'in' | 'out';
  layer: 'current' | 'prev';
}): JSX.Element | null {
  if (!image) return null;
  const animationName =
    transition === 'none'
      ? 'none'
      : transition === 'fade'
        ? direction === 'in'
          ? 'pl-fade-in'
          : 'pl-fade-out'
        : direction === 'in'
          ? 'pl-slide-blur-in'
          : 'pl-slide-blur-out';
  return (
    <div
      key={`${layer}-${image.id}`}
      className="absolute inset-0 flex items-center justify-center"
      style={{
        animationName,
        animationDuration: `${durationMs}ms`,
        animationFillMode: 'forwards',
        animationTimingFunction: 'ease-out',
        zIndex: layer === 'current' ? 2 : 1,
      }}
    >
      <img
        src={image.displayUrl}
        alt=""
        className="max-h-full max-w-full select-none"
        style={{ objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );
}

function Overlays({
  event,
  image,
  settings,
}: {
  event: EventDto;
  image: ImageDto | null;
  settings: SettingsDto;
}): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {settings.showPhotographer && image?.photographerName ? (
        <div className="absolute bottom-6 left-6 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm text-zinc-100 backdrop-blur-sm">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: image.photographerColor ?? '#fafafa' }}
          />
          <span>{image.photographerName}</span>
        </div>
      ) : null}
      {settings.showCaption && image?.caption ? (
        <div className="absolute bottom-12 left-1/2 max-w-[60%] -translate-x-1/2 px-4 py-2 text-center text-2xl font-medium leading-tight text-zinc-50 [text-shadow:0_2px_8px_rgba(0,0,0,0.7)]">
          {image.caption}
        </div>
      ) : null}
      {settings.showTimeAgo && image?.takenAt ? <TimeAgo iso={image.takenAt} /> : null}
      {settings.showBranding ? (
        <div className="absolute right-6 top-6 font-mono text-xs uppercase tracking-wider text-zinc-300">
          {event.name}
        </div>
      ) : null}
    </div>
  );
}

function TimeAgo({ iso }: { iso: string }): JSX.Element {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = Date.now() - Date.parse(iso);
  let text = '';
  if (ms < 60_000) text = 'just now';
  else if (ms < 3_600_000) text = `${Math.floor(ms / 60_000)} min ago`;
  else text = `${Math.floor(ms / 3_600_000)} h ago`;
  return <div className="absolute bottom-6 right-6 font-mono text-xs text-zinc-400">{text}</div>;
}

function AuthError({ status }: { status: 'missing-token' | 'invalid-token' }): JSX.Element {
  const exampleUrl = `${window.location.origin}/?token=YOUR_TOKEN`;
  const heading = status === 'missing-token' ? 'Token required' : 'Token rejected';
  const detail =
    status === 'missing-token'
      ? 'Open the slideshow with a ?token=... query parameter. The value is your PHOTOLIVE_AUTH_TOKEN from the server .env.'
      : 'The token in the URL was rejected by the server. Check that it matches PHOTOLIVE_AUTH_TOKEN in the server .env.';
  return (
    <div className="flex h-full w-full items-center justify-center bg-black p-8 text-zinc-300">
      <div className="flex max-w-xl flex-col gap-4">
        <div className="font-mono text-xs uppercase tracking-wider text-zinc-500">photolive</div>
        <h1 className="text-2xl font-semibold text-zinc-50">{heading}</h1>
        <p className="text-sm leading-relaxed text-zinc-400">{detail}</p>
        <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 font-mono text-xs text-zinc-300">
          {exampleUrl}
        </div>
      </div>
    </div>
  );
}

function ConnectionState({
  conn,
  message,
}: {
  conn: Connection;
  message: string;
}): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black text-zinc-500">
      <div className="flex flex-col items-center gap-3">
        <div className="font-mono text-xs uppercase tracking-wider">photolive</div>
        <div className="text-sm">{message}</div>
        <div className="text-xs text-zinc-600">
          {conn.state === 'connecting'
            ? 'connecting…'
            : conn.state === 'closed'
              ? 'disconnected (retrying…)'
              : ''}
        </div>
      </div>
    </div>
  );
}

function ConnectionDot({ conn }: { conn: Connection }): JSX.Element {
  return (
    <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 font-mono text-[10px] uppercase text-zinc-400 backdrop-blur-sm">
      <span
        className={
          conn.state === 'open'
            ? 'h-1.5 w-1.5 rounded-full bg-emerald-500'
            : conn.state === 'connecting'
              ? 'h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500'
              : 'h-1.5 w-1.5 rounded-full bg-red-500'
        }
      />
      {conn.state}
    </div>
  );
}
