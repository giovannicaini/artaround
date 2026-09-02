import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

interface BaseProps {
  children: ReactNode;
  className?: string;
}

export function Card({
  children,
  className = '',
  ...rest
}: BaseProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-surface-900 border border-surface-800 rounded-3xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

// variante cliccabile, bordo viola e sollevamento al tocco/hover
export function PressableCard({
  children,
  className = '',
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`bg-surface-900 border border-surface-800 rounded-3xl text-left w-full
        transition-all duration-300 hover:border-brand-500/50 hover:-translate-y-1 hover:shadow-glow
        active:scale-[0.98] active:translate-y-0 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
