import { useEffect, useRef } from 'react';

interface HighlightedTextProps {
  text: string;
  highlightUpTo: number; // charIndex da onBoundary — 0 significa niente ancora evidenziato
  className?: string;
}

// Il marker che guida lo scroll sta più avanti del confine evidenziato (circa
// una riga di caratteri): così una riga nuova è già in vista quando inizia,
// non solo quando la lettura ci è già entrata. Non tocca il confine visivo
// (il testo scurito resta esattamente fino a highlightUpTo).
const SCROLL_LOOKAHEAD = 40;

/** Testo con evidenziazione "karaoke" sincronizzata alla lettura vocale — la parte già letta si scurisce e il confine scorre in vista da solo. */
export function HighlightedText({ text, highlightUpTo, className = '' }: HighlightedTextProps) {
  const boundaryRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // 'auto', non 'smooth': il confine avanza più volte al secondo, l'animazione accumulerebbe ritardo.
    if (highlightUpTo > 0 && highlightUpTo <= text.length) {
      boundaryRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [highlightUpTo, text.length]);

  if (highlightUpTo <= 0 || highlightUpTo >= text.length) {
    return <p className={className}>{text}</p>;
  }

  const read = text.slice(0, highlightUpTo);
  const scrollMarkerIndex = Math.min(text.length, highlightUpTo + SCROLL_LOOKAHEAD);
  const upcoming = text.slice(highlightUpTo, scrollMarkerIndex);
  const unread = text.slice(scrollMarkerIndex);

  return (
    <p className={className}>
      <span className="text-surface-500">{read}</span>
      {upcoming}
      <span ref={boundaryRef} />
      {unread}
    </p>
  );
}
