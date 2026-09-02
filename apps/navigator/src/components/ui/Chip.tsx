import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
}

export function Chip({ selected = false, icon, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-full
        text-sm font-semibold border transition-all duration-150 active:scale-95
        ${
          selected
            ? 'gradient-aurora border-transparent text-white shadow-glow'
            : 'bg-surface-900 border-surface-700 text-surface-300 hover:border-surface-500 hover:text-surface-100'
        } ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
