interface SkeletonProps {
  className?: string;
}

/** Blocco segnaposto durante il caricamento. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-surface-800 rounded-2xl ${className}`} />;
}
