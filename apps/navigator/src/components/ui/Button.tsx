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
  primary: 'gradient-aurora text-white shadow-glow hover:brightness-110',
  secondary:
    'bg-surface-800 text-surface-50 border border-surface-700 hover:bg-surface-700 hover:border-surface-600',
  ghost: 'bg-transparent text-surface-200 hover:bg-surface-800',
  danger: 'bg-danger-500 text-white hover:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-full',
  md: 'h-11 px-[1.125rem] text-sm gap-2 rounded-full',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-full',
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
      className={`inline-flex items-center justify-center font-semibold font-sans
        transition-all duration-200 active:scale-[0.96]
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
