import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { FieldHint, Input, Label } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { SettingsDto, Transition } from '@photolive/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import * as React from 'react';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage(): JSX.Element {
  const activeEvent = useQuery({ queryKey: ['active-event'], queryFn: api.events.active });
  const settings = useQuery({
    queryKey: ['settings', activeEvent.data?.id],
    queryFn: () => api.settings.get(activeEvent.data!.id),
    enabled: Boolean(activeEvent.data),
  });

  if (!activeEvent.data) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="flex-1 px-6 py-4">
          <EmptyState message="Activate an event to edit its settings." />
        </div>
      </>
    );
  }

  if (!settings.data) {
    return (
      <>
        <PageHeader title="Settings" subtitle={activeEvent.data.name} />
        <div className="flex-1 px-6 py-4 text-sm text-zinc-500">Loading…</div>
      </>
    );
  }

  return (
    <SettingsForm
      eventId={activeEvent.data.id}
      eventName={activeEvent.data.name}
      initial={settings.data}
    />
  );
}

function SettingsForm({
  eventId,
  eventName,
  initial,
}: {
  eventId: string;
  eventName: string;
  initial: SettingsDto;
}): JSX.Element {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<SettingsDto>(initial);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const save = useMutation({
    mutationFn: (patch: Partial<SettingsDto>) => api.settings.update(eventId, patch),
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setDraft(next);
      setSavedAt(Date.now());
    },
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={eventName}
        actions={
          <div className="flex items-center gap-2">
            {savedAt && !dirty ? <span className="text-xs text-zinc-500">saved</span> : null}
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(initial)}>
              Reset
            </Button>
            <Button
              variant="primary"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(draft)}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Slideshow
            </h2>

            <Field
              label="Interval"
              hint="Time on screen per image"
              control={
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1000}
                    max={60_000}
                    step={500}
                    value={draft.intervalMs}
                    onChange={(e) =>
                      setDraft({ ...draft, intervalMs: Number(e.target.value) || 0 })
                    }
                    className="w-24 font-mono"
                  />
                  <span className="text-xs text-zinc-500">ms</span>
                </div>
              }
            />

            <Field
              label="Transition"
              control={
                <Select
                  value={draft.transition}
                  onValueChange={(v) => setDraft({ ...draft, transition: v as Transition })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">none</SelectItem>
                    <SelectItem value="fade">fade</SelectItem>
                    <SelectItem value="slide-blur">slide-blur</SelectItem>
                  </SelectContent>
                </Select>
              }
            />

            <Field
              label="Transition duration"
              control={
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={5000}
                    step={50}
                    value={draft.transitionDurationMs}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        transitionDurationMs: Number(e.target.value) || 0,
                      })
                    }
                    className="w-24 font-mono"
                  />
                  <span className="text-xs text-zinc-500">ms</span>
                </div>
              }
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Audience overlays
            </h2>

            <ToggleField
              label="Show photographer attribution"
              checked={draft.showPhotographer}
              onChange={(v) => setDraft({ ...draft, showPhotographer: v })}
            />
            <ToggleField
              label="Show live caption"
              checked={draft.showCaption}
              onChange={(v) => setDraft({ ...draft, showCaption: v })}
            />
            <ToggleField
              label='Show "time since shot"'
              checked={draft.showTimeAgo}
              onChange={(v) => setDraft({ ...draft, showTimeAgo: v })}
            />
            <ToggleField
              label="Show event branding"
              checked={draft.showBranding}
              onChange={(v) => setDraft({ ...draft, showBranding: v })}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              OBS / compositing
            </h2>

            <ToggleField
              label="Transparent background"
              hint="Drops the black backdrop so an OBS Browser Source can composite the slideshow over the scene below. Letterboxing around portrait images becomes transparent too."
              checked={draft.transparentBackground}
              onChange={(v) => setDraft({ ...draft, transparentBackground: v })}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Quality
            </h2>

            <Field
              label="Blur threshold"
              hint="Used in auto-skip-blurry mode. Higher = stricter. Typical range 50–200."
              control={
                <Input
                  type="number"
                  min={0}
                  max={10_000}
                  step={10}
                  value={draft.blurThreshold}
                  onChange={(e) =>
                    setDraft({ ...draft, blurThreshold: Number(e.target.value) || 0 })
                  }
                  className="w-24 font-mono"
                />
              }
            />
          </section>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
}): JSX.Element {
  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-4">
      <div className="pt-1.5">
        <Label>{label}</Label>
        {hint ? <FieldHint className="mt-0.5">{hint}</FieldHint> : null}
      </div>
      <div>{control}</div>
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-blue-500 focus:ring-2 focus:ring-blue-500"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-zinc-300">{label}</span>
        {hint ? <FieldHint>{hint}</FieldHint> : null}
      </span>
    </label>
  );
}
