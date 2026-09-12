// Immagine tappa: dissolvenza incrociata con leggero zoom
export const stepImageVariants = {
  enter: { opacity: 0, scale: 0.97 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};
// Testo tappa: dissolvenza + scivolamento nel verso di navigazione — "custom"
// (il prop di framer-motion, ovvero la direzione) vale 1 avanti, -1 indietro.
export const stepTextVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 18 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir * 18 }),
};
export const stepTransition = { duration: 0.22, ease: 'easeOut' as const };
