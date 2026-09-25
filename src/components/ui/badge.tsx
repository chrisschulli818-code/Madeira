import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-primary-soft text-primary-hover',
      muted: 'bg-muted text-subtle',
      accent: 'bg-teal-50 text-accent',
      danger: 'bg-red-50 text-danger',
    },
  },
  defaultVariants: { variant: 'default' },
});

export const Badge = ({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
