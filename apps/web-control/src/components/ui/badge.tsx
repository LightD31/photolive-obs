import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
  {
    variants: {
      tone: {
        neutral: 'border border-zinc-800 bg-zinc-900 text-zinc-300',
        active: 'border border-blue-500/30 bg-blue-500/10 text-blue-300',
        success: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        warning: 'border border-amber-500/30 bg-amber-500/10 text-amber-300',
        danger: 'border border-red-500/30 bg-red-500/10 text-red-300',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}

export function StatusDot({ tone = 'neutral' }: { tone?: BadgeProps['tone'] }): JSX.Element {
  const colors = {
    neutral: 'bg-zinc-500',
    active: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  } as const;
  return (
    <span className={cn('inline-block h-1.5 w-1.5 rounded-full', colors[tone ?? 'neutral'])} />
  );
}
