import { Sidebar } from '@/components/Sidebar';
import type { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <Sidebar />
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
