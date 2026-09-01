import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-surface-950 hover:bg-brand-400 shadow-lg shadow-brand-900/40',
  secondary:
    'bg-surface-800 text-surface-50 border border-surface-700 hover:bg-surface-700 hover:border-surface-600',
  ghost: 'bg-transparent text-surface-200 hover:bg-surface-800',
  danger: 'bg-danger-500 text-surface-950 hover:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4.5 text-sm gap-2 rounded-xl',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-2xl',
};

/**
 * Unico bottone dell'app: ogni schermata lo usa invece di ridefinire
 * `className` ripetuti. Variante + dimensione bastano a coprire i casi.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    block = false,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium
        transition-all duration-200 active:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantClasses[variant]} ${sizeClasses[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-[1.1em] h-[1.1em] animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0 [&>svg]:w-[1.1em] [&>svg]:h-[1.1em]">{icon}</span>
      )}
      {children}
    </button>
  );
});
