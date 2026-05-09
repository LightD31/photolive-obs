import type {
  AuditLogEntry,
  EventDto,
  ImageDto,
  ImageStatus,
  PhotographerDto,
  PhotographerWithSecretDto,
  SettingsDto,
} from '@photolive/shared';
import { clearToken, getToken } from './auth';

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    // Stale token: drop it and bounce back to LoginGate so the user can re-enter.
    if (res.status === 401 && getToken()) {
      clearToken();
      window.location.reload();
    }
    throw new ApiError(`API ${res.status}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  events: {
    list: () => request<{ events: EventDto[] }>('/api/events').then((r) => r.events),
    active: () => request<{ event: EventDto | null }>('/api/events/active').then((r) => r.event),
    get: (id: string) => request<{ event: EventDto }>(`/api/events/${id}`).then((r) => r.event),
    create: (input: { name: string; slug: string; photosDir: string; displayMode?: string }) =>
      request<{ event: EventDto }>('/api/events', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.event),
    update: (id: string, patch: Partial<EventDto>) =>
      request<{ event: EventDto }>(`/api/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).then((r) => r.event),
    activate: (id: string) =>
      request<{ event: EventDto }>(`/api/events/${id}/activate`, { method: 'POST' }).then(
        (r) => r.event,
      ),
    archive: (id: string) =>
      request<{ event: EventDto }>(`/api/events/${id}/archive`, { method: 'POST' }).then(
        (r) => r.event,
      ),
    unarchive: (id: string) =>
      request<{ event: EventDto }>(`/api/events/${id}/unarchive`, { method: 'POST' }).then(
        (r) => r.event,
      ),
    delete: (id: string) => request<{ ok: boolean }>(`/api/events/${id}`, { method: 'DELETE' }),
    audit: (id: string, limit = 200) =>
      request<{ entries: AuditLogEntry[] }>(`/api/events/${id}/audit?limit=${limit}`).then(
        (r) => r.entries,
      ),
  },
  photographers: {
    list: (eventId: string) =>
      request<{ photographers: PhotographerDto[] }>(`/api/events/${eventId}/photographers`).then(
        (r) => r.photographers,
      ),
    create: (eventId: string, input: { displayName: string; color: string }) =>
      request<{ photographer: PhotographerWithSecretDto }>(`/api/events/${eventId}/photographers`, {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.photographer),
    update: (id: string, patch: Partial<PhotographerDto>) =>
      request<{ photographer: PhotographerDto }>(`/api/photographers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).then((r) => r.photographer),
    rotatePassword: (id: string) =>
      request<{ photographer: PhotographerWithSecretDto }>(
        `/api/photographers/${id}/rotate-password`,
        { method: 'POST' },
      ).then((r) => r.photographer),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/photographers/${id}`, { method: 'DELETE' }),
  },
  images: {
    list: (eventId: string, opts?: { status?: ImageStatus[]; limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.status) params.set('status', opts.status.join(','));
      if (opts?.limit) params.set('limit', String(opts.limit));
      const qs = params.toString();
      return request<{ images: ImageDto[]; counts: Record<ImageStatus, number> }>(
        `/api/events/${eventId}/images${qs ? `?${qs}` : ''}`,
      );
    },
    pending: (eventId: string) =>
      request<{ images: ImageDto[] }>(`/api/events/${eventId}/images/pending`).then(
        (r) => r.images,
      ),
    queue: (eventId: string) =>
      request<{ images: ImageDto[] }>(`/api/events/${eventId}/images/queue`).then((r) => r.images),
    latency: (eventId: string) =>
      request<{ averageMs: number | null }>(`/api/events/${eventId}/latency`).then(
        (r) => r.averageMs,
      ),
    approve: (id: string) =>
      request<{ image: ImageDto }>(`/api/images/${id}/approve`, { method: 'POST' }),
    reject: (id: string, reason?: string) =>
      request<{ image: ImageDto }>(`/api/images/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    exclude: (id: string, reason?: string) =>
      request<{ image: ImageDto }>(`/api/images/${id}/exclude`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    include: (id: string) =>
      request<{ image: ImageDto }>(`/api/images/${id}/include`, { method: 'POST' }),
    setCaption: (id: string, text: string) =>
      request<{ image: ImageDto }>(`/api/images/${id}/caption`, {
        method: 'PUT',
        body: JSON.stringify({ text }),
      }),
    reorderQueue: (eventId: string, imageIds: string[]) =>
      request<{ ok: boolean }>(`/api/events/${eventId}/queue`, {
        method: 'PUT',
        body: JSON.stringify({ imageIds }),
      }),
  },
  network: {
    info: () => request<{ ftpHost: string; ftpPort: number }>('/api/network-info'),
  },
  settings: {
    get: (eventId: string) =>
      request<{ settings: SettingsDto }>(`/api/events/${eventId}/settings`).then((r) => r.settings),
    update: (eventId: string, patch: Partial<SettingsDto>) =>
      request<{ settings: SettingsDto }>(`/api/events/${eventId}/settings`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }).then((r) => r.settings),
  },
};

export { ApiError };
