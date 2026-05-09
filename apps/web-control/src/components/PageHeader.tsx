import { cn } from '@/lib/utils';
import type * as React from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-zinc-800 px-6 py-3',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-zinc-50">{title}</h1>
        {subtitle ? <span className="text-sm text-zinc-500">{subtitle}</span> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
