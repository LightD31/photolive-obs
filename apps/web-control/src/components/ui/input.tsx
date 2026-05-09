import { cn } from '@/lib/utils';
import * as React from 'react';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-8 w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-50',
      'placeholder:text-zinc-500',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      'disabled:cursor-not-allowed disabled:opacity-50',
      type === 'file' &&
        'file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-xs file:text-zinc-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[60px] w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-50',
      'placeholder:text-zinc-500',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>): JSX.Element {
  return <label className={cn('text-xs font-medium text-zinc-400', className)} {...props} />;
}

export function FieldHint({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return <p className={cn('text-xs text-zinc-500', className)} {...props} />;
}

export function FieldError({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return <p className={cn('text-xs text-red-400', className)} {...props} />;
}
