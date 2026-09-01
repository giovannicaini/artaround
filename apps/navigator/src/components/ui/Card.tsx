import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

interface BaseProps {
  children: ReactNode;
  className?: string;
}

/** Superficie di base: card statiche (info, testo). */
export function Card({
  children,
  className = '',
  ...rest
}: BaseProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-surface-900 border border-surface-800 rounded-2xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Variante cliccabile: liste di musei/visite. Stesso look di Card + affordance di tocco. */
export function PressableCard({
  children,
  className = '',
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`bg-surface-900 border border-surface-800 rounded-2xl text-left w-full
        transition-all duration-300 hover:border-surface-600 hover:-translate-y-0.5
        active:scale-[0.99] active:translate-y-0 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
