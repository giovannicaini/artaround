import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconTileVariant = 'glass' | 'panel' | 'brand';
export type IconTileSize = 'sm' | 'md' | 'lg';

interface IconTileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: IconTileVariant;
  size?: IconTileSize;
  label: string; // aria-label, sempre richiesta: sono bottoni a sola icona
}

const variantClasses: Record<IconTileVariant, string> = {
  // Sopra immagini/foto (hero opera, copertina museo): vetro scuro sempre leggibile
  glass: 'bg-surface-950/45 text-surface-50 backdrop-blur-md hover:bg-surface-950/65',
  panel: 'bg-surface-800 text-surface-200 border border-surface-700 hover:bg-surface-700',
  brand: 'bg-brand-500 text-surface-950 hover:bg-brand-400',
};

const sizeClasses: Record<IconTileSize, string> = {
  sm: 'w-9 h-9 rounded-full [&>svg]:w-4 [&>svg]:h-4',
  md: 'w-11 h-11 rounded-full [&>svg]:w-5 [&>svg]:h-5',
  lg: 'w-14 h-14 rounded-2xl [&>svg]:w-6 [&>svg]:h-6',
};

/**
 * Bottone a sola icona (indietro, chiudi, impostazioni...). Un solo posto
 * per le tre varianti di contesto invece di className ripetute ad ogni uso.
 */
export const IconTile = forwardRef<HTMLButtonElement, IconTileProps>(function IconTile(
  { icon, variant = 'panel', size = 'md', label, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center flex-shrink-0
        transition-all duration-200 active:scale-90
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
});
