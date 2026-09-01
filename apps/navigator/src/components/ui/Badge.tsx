import type { ReactNode } from 'react';

export type BadgeVariant = 'brand' | 'good' | 'warn' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  good: 'bg-success-100 text-success-500 border-success-500/25',
  warn: 'bg-warning-100 text-warning-500 border-warning-500/25',
  neutral: 'bg-surface-800 text-surface-300 border-surface-700',
};

/** Etichetta di stato compatta: prezzo, livello, "Posseduta", ecc. */
export function Badge({ variant = 'neutral', icon, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${variantClasses[variant]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
