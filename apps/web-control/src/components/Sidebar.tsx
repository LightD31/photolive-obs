import { Button } from '@/components/ui/button';
import { clearToken } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  CalendarDays,
  FileText,
  ListVideo,
  LogOut,
  Play,
  Settings,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

const NAV = [
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/photographers', label: 'Photographers', icon: Users },
  { to: '/queue', label: 'Queue', icon: ListVideo },
  { to: '/live', label: 'Live', icon: Play },
  { to: '/event-settings', label: 'Event settings', icon: SlidersHorizontal },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/audit', label: 'Audit', icon: FileText },
] as const;

export function Sidebar(): JSX.Element {
  const { location } = useRouterState();

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-12 items-center border-b border-zinc-800 px-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-zinc-50">
          photolive
        </span>
      </div>
      <nav className="flex-1 px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    'flex h-8 items-center gap-2 rounded px-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-900 text-zinc-50'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-zinc-800 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            clearToken();
            window.location.reload();
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
