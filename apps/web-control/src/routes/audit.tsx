import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/audit')({
  component: AuditPage,
});

function AuditPage(): JSX.Element {
  const activeEvent = useQuery({ queryKey: ['active-event'], queryFn: api.events.active });
  const audit = useQuery({
    queryKey: ['audit', activeEvent.data?.id],
    queryFn: () => api.events.audit(activeEvent.data!.id, 200),
    enabled: Boolean(activeEvent.data),
    refetchInterval: 5_000,
  });

  if (!activeEvent.data) {
    return (
      <>
        <PageHeader title="Audit log" />
        <div className="flex-1 px-6 py-4">
          <EmptyState message="Activate an event to see its audit log." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Audit log" subtitle={activeEvent.data.name} />
      <div className="flex-1 overflow-auto px-6 py-4 font-mono text-xs">
        {audit.data && audit.data.length > 0 ? (
          <div className="rounded-md border border-zinc-800">
            <Table>
              <THead>
                <tr>
                  <TH className="w-44">Time</TH>
                  <TH className="w-24">Actor</TH>
                  <TH className="w-56">Action</TH>
                  <TH>Payload</TH>
                </tr>
              </THead>
              <TBody>
                {audit.data.map((entry) => (
                  <TR key={entry.id}>
                    <TD className="tabular-nums text-zinc-400">
                      {new Date(entry.ts).toLocaleString()}
                    </TD>
                    <TD className="text-zinc-300">{entry.actor}</TD>
                    <TD className="text-zinc-50">{entry.action}</TD>
                    <TD className="text-zinc-500 break-all">
                      {entry.payload ? JSON.stringify(entry.payload) : ''}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : (
          <EmptyState message="No audit entries yet." />
        )}
      </div>
    </>
  );
}
