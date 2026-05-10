import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
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
import { setToken } from '@/lib/auth';
import { isElectron, openLogs, pickFolder, relaunch, revealDataDir } from '@/lib/electron';
import { cn } from '@/lib/utils';
import type { AppSettingsFile, AppSettingsPatch } from '@photolive/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Copy, Eye, EyeOff, FolderOpen, RotateCw } from 'lucide-react';
import * as React from 'react';

export const Route = createFileRoute('/settings')({
  component: AppSettingsPage,
});

function AppSettingsPage(): JSX.Element {
  const inElectron = isElectron();
  const get = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => api.appSettings.get(),
  });

  if (!get.data) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="flex-1 px-6 py-4 text-sm text-zinc-500">Loading…</div>
      </>
    );
  }

  return (
    <SettingsForm
      key={get.data.dataDir}
      data={get.data}
      mutable={get.data.mutable}
      inElectron={inElectron}
    />
  );
}

type Data = Awaited<ReturnType<typeof api.appSettings.get>>;

function SettingsForm({
  data,
  mutable,
  inElectron,
}: {
  data: Data;
  mutable: boolean;
  inElectron: boolean;
}): JSX.Element {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<AppSettingsFile>(data.settings);
  const [reload, setReload] = React.useState<{
    requiresRestart: boolean;
    reasons: string[];
  } | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const editable = mutable && inElectron;

  const save = useMutation({
    mutationFn: (patch: AppSettingsPatch) => api.appSettings.update(patch),
    onSuccess: (res) => {
      setReload(res.reload);
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });

  const onSave = (): void => {
    const patch: AppSettingsPatch = diffSettings(data.settings, draft);
    save.mutate(patch);
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={inElectron ? 'Photolive desktop' : 'Read-only — running outside the desktop app'}
        actions={
          <div className="flex items-center gap-2">
            {savedAt && !dirty ? <span className="text-xs text-zinc-500">saved</span> : null}
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(data.settings)}>
              Reset
            </Button>
            <Button
              variant="primary"
              disabled={!editable || !dirty || save.isPending}
              onClick={onSave}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {!mutable ? (
            <Banner intent="info">
              The server was launched from a <code>.env</code> file, so settings can't be edited
              from the UI. Edit your <code>.env</code> at <code>{data.dataDir}/.env</code> (or
              wherever it lives) and restart the server, or run with{' '}
              <code>--settings &lt;path/to/settings.json&gt;</code>.
            </Banner>
          ) : null}

          {!inElectron && mutable ? (
            <Banner intent="info">
              You're viewing this page in a browser tab. App-level settings can only be mutated from
              the Photolive desktop app. View-only here.
            </Banner>
          ) : null}

          {reload?.reasons.length ? (
            <Banner intent="warn">
              <div className="space-y-2">
                <div>
                  Saved. Some changes need a full restart before they take effect:
                  <ul className="ml-5 mt-1 list-disc text-xs">
                    {reload.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                {inElectron ? (
                  <Button variant="primary" size="sm" onClick={() => void relaunch()}>
                    Restart now
                  </Button>
                ) : (
                  <p className="text-xs">Quit and relaunch the desktop app to apply.</p>
                )}
              </div>
            </Banner>
          ) : null}

          <SectionGeneral
            draft={draft}
            setDraft={setDraft}
            editable={editable}
            inElectron={inElectron}
            dataDir={data.dataDir}
            settingsPath={data.settingsPath}
          />

          <SectionNetwork draft={draft} setDraft={setDraft} editable={editable} />

          <SectionStorage
            draft={draft}
            setDraft={setDraft}
            editable={editable}
            inElectron={inElectron}
            dataDir={data.dataDir}
          />

          <SectionFtp draft={draft} setDraft={setDraft} editable={editable} />

          <SectionObs draft={draft} setDraft={setDraft} editable={editable} />

          <SectionAuth current={data.settings} editable={editable} />
        </div>
      </div>
    </>
  );
}

// -- Sections --------------------------------------------------------------

function SectionGeneral({
  draft,
  setDraft,
  editable,
  inElectron,
  dataDir,
  settingsPath,
}: {
  draft: AppSettingsFile;
  setDraft: React.Dispatch<React.SetStateAction<AppSettingsFile>>;
  editable: boolean;
  inElectron: boolean;
  dataDir: string;
  settingsPath: string | null;
}): JSX.Element {
  return (
    <Section title="General">
      <Field
        label="Log level"
        hint="pino verbosity. trace is most verbose, fatal least."
        control={
          <Select
            value={draft.logLevel}
            onValueChange={(v) =>
              setDraft({ ...draft, logLevel: v as AppSettingsFile['logLevel'] })
            }
            disabled={!editable}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trace">trace</SelectItem>
              <SelectItem value="debug">debug</SelectItem>
              <SelectItem value="info">info</SelectItem>
              <SelectItem value="warn">warn</SelectItem>
              <SelectItem value="error">error</SelectItem>
              <SelectItem value="fatal">fatal</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Field
        label="Data directory"
        hint="Resolved at startup. Override under Storage to change."
        control={
          <div className="flex items-center gap-2">
            <code className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-300">{dataDir}</code>
            {inElectron ? (
              <Button variant="ghost" size="sm" onClick={() => void revealDataDir()}>
                <FolderOpen className="h-3.5 w-3.5" />
                Reveal
              </Button>
            ) : null}
          </div>
        }
      />

      {settingsPath ? (
        <Field
          label="settings.json"
          control={
            <code className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
              {settingsPath}
            </code>
          }
        />
      ) : null}

      {inElectron ? (
        <Field
          label="Logs"
          control={
            <Button variant="ghost" size="sm" onClick={() => void openLogs()}>
              <FolderOpen className="h-3.5 w-3.5" />
              Open logs folder
            </Button>
          }
        />
      ) : null}
    </Section>
  );
}

function SectionNetwork({
  draft,
  setDraft,
  editable,
}: {
  draft: AppSettingsFile;
  setDraft: React.Dispatch<React.SetStateAction<AppSettingsFile>>;
  editable: boolean;
}): JSX.Element {
  return (
    <Section title="Network" badge="Restart required">
      <Field
        label="HTTP port"
        hint="Slideshow + control panel + WebSocket all listen here."
        control={
          <Input
            type="number"
            min={1}
            max={65535}
            value={draft.network.port}
            disabled={!editable}
            onChange={(e) =>
              setDraft({
                ...draft,
                network: { ...draft.network, port: Number(e.target.value) || 0 },
              })
            }
            className="w-28 font-mono"
          />
        }
      />

      <Field
        label="Bind host"
        hint='"0.0.0.0" for LAN access (e.g. OBS browser source on another machine), "127.0.0.1" for local-only.'
        control={
          <Input
            value={draft.network.host}
            disabled={!editable}
            onChange={(e) =>
              setDraft({ ...draft, network: { ...draft.network, host: e.target.value } })
            }
            className="w-40 font-mono"
          />
        }
      />

      <Field
        label="Allowed origins"
        hint="Comma-separated CORS origins. http://127.0.0.1:<port> and http://localhost:<port> are auto-allowed."
        control={
          <Input
            value={draft.network.allowedOrigins.join(', ')}
            disabled={!editable}
            onChange={(e) =>
              setDraft({
                ...draft,
                network: {
                  ...draft.network,
                  allowedOrigins: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
            placeholder="https://obs-pc.local, https://laptop.lan"
            className="w-full max-w-md"
          />
        }
      />
    </Section>
  );
}

function SectionStorage({
  draft,
  setDraft,
  editable,
  inElectron,
  dataDir,
}: {
  draft: AppSettingsFile;
  setDraft: React.Dispatch<React.SetStateAction<AppSettingsFile>>;
  editable: boolean;
  inElectron: boolean;
  dataDir: string;
}): JSX.Element {
  const onPickFolder = (key: 'dataDir' | 'photosRoot' | 'renditionsRoot') => async () => {
    if (!inElectron) return;
    const picked = await pickFolder(draft.storage[key] ?? dataDir);
    if (picked) {
      setDraft({ ...draft, storage: { ...draft.storage, [key]: picked } });
    }
  };

  return (
    <Section title="Storage" badge="Restart required">
      <Field
        label="Data directory override"
        hint="Leave blank to auto-detect (next to the app exe, falling back to userData)."
        control={
          <PathInput
            value={draft.storage.dataDir ?? ''}
            placeholder="(auto)"
            disabled={!editable}
            onChange={(v) =>
              setDraft({ ...draft, storage: { ...draft.storage, dataDir: v || null } })
            }
            onPick={inElectron ? onPickFolder('dataDir') : null}
          />
        }
      />

      <Field
        label="Photos root"
        hint="Where uploaded JPEGs land. Defaults to <dataDir>/photos."
        control={
          <PathInput
            value={draft.storage.photosRoot ?? ''}
            placeholder={`${dataDir}/photos`}
            disabled={!editable}
            onChange={(v) =>
              setDraft({ ...draft, storage: { ...draft.storage, photosRoot: v || null } })
            }
            onPick={inElectron ? onPickFolder('photosRoot') : null}
          />
        }
      />

      <Field
        label="Renditions root"
        hint="Where Sharp emits the resized + thumbnail outputs. Defaults to <dataDir>/renditions."
        control={
          <PathInput
            value={draft.storage.renditionsRoot ?? ''}
            placeholder={`${dataDir}/renditions`}
            disabled={!editable}
            onChange={(v) =>
              setDraft({ ...draft, storage: { ...draft.storage, renditionsRoot: v || null } })
            }
            onPick={inElectron ? onPickFolder('renditionsRoot') : null}
          />
        }
      />
    </Section>
  );
}

function SectionFtp({
  draft,
  setDraft,
  editable,
}: {
  draft: AppSettingsFile;
  setDraft: React.Dispatch<React.SetStateAction<AppSettingsFile>>;
  editable: boolean;
}): JSX.Element {
  return (
    <Section title="FTP server">
      <Field
        label="Bind host"
        control={
          <Input
            value={draft.ftp.host}
            disabled={!editable}
            onChange={(e) => setDraft({ ...draft, ftp: { ...draft.ftp, host: e.target.value } })}
            className="w-40 font-mono"
          />
        }
      />
      <Field
        label="Port"
        control={
          <Input
            type="number"
            min={1}
            max={65535}
            value={draft.ftp.port}
            disabled={!editable}
            onChange={(e) =>
              setDraft({ ...draft, ftp: { ...draft.ftp, port: Number(e.target.value) || 0 } })
            }
            className="w-28 font-mono"
          />
        }
      />
      <Field
        label="PASV advertised URL"
        hint="What the camera sees as the data-channel host. Usually the LAN IP of this machine."
        control={
          <Input
            value={draft.ftp.pasvUrl}
            disabled={!editable}
            onChange={(e) => setDraft({ ...draft, ftp: { ...draft.ftp, pasvUrl: e.target.value } })}
            className="w-48 font-mono"
          />
        }
      />
      <Field
        label="PASV port range"
        control={
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={draft.ftp.pasvMin}
              disabled={!editable}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  ftp: { ...draft.ftp, pasvMin: Number(e.target.value) || 0 },
                })
              }
              className="w-24 font-mono"
            />
            <span className="text-xs text-zinc-500">to</span>
            <Input
              type="number"
              value={draft.ftp.pasvMax}
              disabled={!editable}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  ftp: { ...draft.ftp, pasvMax: Number(e.target.value) || 0 },
                })
              }
              className="w-24 font-mono"
            />
          </div>
        }
      />
    </Section>
  );
}

function SectionObs({
  draft,
  setDraft,
  editable,
}: {
  draft: AppSettingsFile;
  setDraft: React.Dispatch<React.SetStateAction<AppSettingsFile>>;
  editable: boolean;
}): JSX.Element {
  return (
    <Section title="OBS WebSocket">
      <Field
        label="WebSocket URL"
        hint="From OBS: Tools → WebSocket Server Settings. Leave empty to disable the integration."
        control={
          <Input
            type="text"
            value={draft.obs.url}
            disabled={!editable}
            onChange={(e) => setDraft({ ...draft, obs: { ...draft.obs, url: e.target.value } })}
            placeholder="ws://localhost:4455"
            className="w-72 font-mono"
          />
        }
      />
      <Field
        label="Password"
        control={
          <Input
            type="password"
            value={draft.obs.password}
            disabled={!editable}
            onChange={(e) =>
              setDraft({ ...draft, obs: { ...draft.obs, password: e.target.value } })
            }
            className="w-72 font-mono"
            placeholder="(leave blank for no password)"
          />
        }
      />
    </Section>
  );
}

function SectionAuth({
  current,
  editable,
}: {
  current: AppSettingsFile;
  editable: boolean;
}): JSX.Element {
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [confirmingRotate, setConfirmingRotate] = React.useState(false);

  const reveal = useMutation({
    mutationFn: () => api.appSettings.get(true),
    onSuccess: (res) => setRevealed(res.settings.authToken),
  });

  const rotate = useMutation({
    mutationFn: () => api.appSettings.rotateToken(),
    onSuccess: (res) => {
      setToken(res.newToken);
      // Reload so every authenticated component (websocket, queries) reconnects with the new token.
      window.location.reload();
    },
  });

  const display = revealed ?? current.authToken;

  return (
    <Section title="Authentication">
      <Field
        label="Bearer token"
        hint="Sent as Authorization: Bearer <token>. Photographers don't see this — it's only for the operator UI and the slideshow's WebSocket."
        control={
          <div className="flex items-center gap-2">
            <code
              className={cn(
                'rounded bg-zinc-900 px-2 py-1 font-mono text-xs',
                revealed ? 'text-zinc-50' : 'text-zinc-500',
              )}
            >
              {display}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (revealed) setRevealed(null);
                else reveal.mutate();
              }}
              disabled={reveal.isPending}
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealed ? 'Hide' : 'Reveal'}
            </Button>
            {revealed ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(revealed);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            ) : null}
          </div>
        }
      />

      <Field
        label="Rotate"
        hint="Generates a fresh 256-bit token and invalidates the old one immediately. All connected clients must re-authenticate."
        control={
          confirmingRotate ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-300">
                Rotate now? Existing sessions will drop.
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => rotate.mutate()}
                disabled={rotate.isPending}
              >
                {rotate.isPending ? 'Rotating…' : 'Confirm'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingRotate(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingRotate(true)}
              disabled={!editable}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Rotate token
            </Button>
          )
        }
      />
    </Section>
  );
}

// -- Layout primitives -----------------------------------------------------

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
        {badge ? <Badge tone="warning">{badge}</Badge> : null}
      </h2>
      {children}
    </section>
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

function PathInput({
  value,
  placeholder,
  disabled,
  onChange,
  onPick,
}: {
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onPick: (() => void) | null;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-md font-mono text-xs"
      />
      {onPick ? (
        <Button variant="ghost" size="sm" onClick={() => void onPick()} disabled={disabled}>
          <FolderOpen className="h-3.5 w-3.5" />
          Browse
        </Button>
      ) : null}
    </div>
  );
}

function Banner({
  intent,
  children,
}: {
  intent: 'info' | 'warn';
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded border px-4 py-3 text-sm',
        intent === 'info'
          ? 'border-zinc-800 bg-zinc-950 text-zinc-300'
          : 'border-amber-900 bg-amber-950/30 text-amber-200',
      )}
    >
      {children}
    </div>
  );
}

// -- Helpers ---------------------------------------------------------------

function diffSettings(prev: AppSettingsFile, next: AppSettingsFile): AppSettingsPatch {
  const patch: AppSettingsPatch = {};
  if (prev.logLevel !== next.logLevel) patch.logLevel = next.logLevel;
  if (JSON.stringify(prev.network) !== JSON.stringify(next.network)) patch.network = next.network;
  if (JSON.stringify(prev.storage) !== JSON.stringify(next.storage)) patch.storage = next.storage;
  if (JSON.stringify(prev.ftp) !== JSON.stringify(next.ftp)) patch.ftp = next.ftp;
  if (JSON.stringify(prev.obs) !== JSON.stringify(next.obs)) patch.obs = next.obs;
  return patch;
}
