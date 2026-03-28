import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  [
    'inline-flex items-center rounded-[var(--ns-radius-full)] px-2.5 py-0.5',
    'text-xs font-semibold',
    'transition-colors duration-[var(--ns-duration-fast)]',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border border-border text-foreground',
        success:
          'border-transparent bg-[var(--ns-color-success)] text-[var(--ns-color-foreground-inverse)]',
        warning:
          'border-transparent bg-[var(--ns-color-warning)] text-[var(--ns-color-foreground-inverse)]',
        info: 'border-transparent bg-[var(--ns-color-info)] text-[var(--ns-color-foreground-inverse)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
