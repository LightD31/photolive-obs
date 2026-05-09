import { cn } from '@/lib/utils';
import * as React from 'react';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

export const THead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500',
      className,
    )}
    {...props}
  />
));
THead.displayName = 'THead';

export const TBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TBody.displayName = 'TBody';

export const TR = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { active?: boolean }
>(({ className, active, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-zinc-900 transition-colors hover:bg-zinc-900/50',
      active && 'border-l-2 border-l-blue-500 bg-zinc-900',
      className,
    )}
    {...props}
  />
));
TR.displayName = 'TR';

export const TH = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn('h-9 px-3 text-left align-middle font-medium text-zinc-500', className)}
    {...props}
  />
));
TH.displayName = 'TH';

export const TD = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-3 py-2 align-middle', className)} {...props} />
));
TD.displayName = 'TD';
