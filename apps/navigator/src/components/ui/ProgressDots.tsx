interface ProgressDotsProps {
  total: number;
  current: number;
  onSelect?: (index: number) => void;
  tone?: 'onImage' | 'onSurface';
}

/**
 * Barra di avanzamento a segmenti (stile "storie"), usata nel player. La
 * tappa corrente prende il gradiente aurora invece di un colore piatto —
 * è il segnale visivo più ripetuto dell'app, vale la pena farlo vivace.
 */
export function ProgressDots({ total, current, onSelect, tone = 'onImage' }: ProgressDotsProps) {
  const trackClass = tone === 'onImage' ? 'bg-white/20' : 'bg-surface-700';
  const doneClass = tone === 'onImage' ? 'bg-white/55' : 'bg-brand-800';

  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }).map((_, idx) => (
        <button
          key={idx}
          type="button"
          aria-label={`Vai all'opera ${idx + 1} di ${total}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(idx);
          }}
          className={`h-1 flex-1 rounded-full transition-colors ${
            idx === current ? 'gradient-aurora' : idx < current ? doneClass : trackClass
          } ${onSelect ? 'cursor-pointer' : ''}`}
        />
      ))}
    </div>
  );
}
