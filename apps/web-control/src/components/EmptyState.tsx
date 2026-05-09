import { cn } from '@/lib/utils';
import type * as React from 'react';

export function EmptyState({
  message,
  action,
  className,
}: {
  message: string;
  action?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center gap-3 py-16 text-center', className)}>
      <p className="text-sm text-zinc-500">{message}</p>
      {action}
    </div>
  );
}
