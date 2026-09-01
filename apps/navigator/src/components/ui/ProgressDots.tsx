interface ProgressDotsProps {
  total: number;
  current: number;
  onSelect?: (index: number) => void;
  tone?: 'onImage' | 'onSurface';
}

/**
 * Barra di avanzamento a segmenti (stile "storie"), usata nel player.
 * `onImage` per sopra le foto delle opere, `onSurface` per il layout desktop.
 */
export function ProgressDots({ total, current, onSelect, tone = 'onImage' }: ProgressDotsProps) {
  const trackClass = tone === 'onImage' ? 'bg-surface-50/20' : 'bg-surface-700';
  const doneClass = tone === 'onImage' ? 'bg-surface-50/55' : 'bg-brand-800';
  const activeClass = tone === 'onImage' ? 'bg-surface-50' : 'bg-brand-400';

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
            idx === current ? activeClass : idx < current ? doneClass : trackClass
          } ${onSelect ? 'cursor-pointer' : ''}`}
        />
      ))}
    </div>
  );
}
