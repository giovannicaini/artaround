import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AppLanguage } from '@artaround/shared';
import { useI18nStore } from '../../context/i18nStore';
import { useT } from '../../services/useT';

const ALL_OPTIONS: Array<{ value: AppLanguage; label: string; flagCode: string }> = [
  { value: 'it', label: 'Italiano', flagCode: 'it' },
  { value: 'en', label: 'English', flagCode: 'us' },
  { value: 'fr', label: 'Français', flagCode: 'fr' },
  { value: 'de', label: 'Deutsch', flagCode: 'de' },
  { value: 'es', label: 'Español', flagCode: 'es' },
];

function flagUrl(code: string): string {
  return `https://flagcdn.com/20x15/${code}.png`;
}

interface LanguageSwitcherProps {
  /** Se un museo ha attivato solo alcune lingue, limita la scelta a quelle. */
  languages?: AppLanguage[];
  variant?: 'glass' | 'panel';
}

/** Selettore lingua (bandiera + menu a comparsa) — un solo posto in tutta l'app. */
export function LanguageSwitcher({ languages, variant = 'panel' }: LanguageSwitcherProps) {
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const options = languages?.length
    ? ALL_OPTIONS.filter((option) => languages.includes(option.value))
    : ALL_OPTIONS;
  const selected = options.find((option) => option.value === language) || options[0];

  // Se la lingua salvata non è tra quelle attive di questo museo, passa alla prima disponibile.
  useEffect(() => {
    if (selected && selected.value !== language) {
      setLanguage(selected.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.value]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    // Cattura, non bubble: uno Sheet antenato può fermare la propagazione prima che arrivi qui.
    document.addEventListener('click', handleOutsideClick, true);
    return () => document.removeEventListener('click', handleOutsideClick, true);
  }, []);

  // glass: sopra una foto reale — vetro scuro fisso, non legato al tema.
  const buttonClass =
    variant === 'glass'
      ? 'bg-black/45 backdrop-blur-md hover:bg-black/65'
      : 'bg-surface-800 border border-surface-700 hover:bg-surface-700';

  // inline-block: evita che il div si allarghi e stacchi il menu (right-0) dal bottone.
  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('Cambia lingua')}
        className={`h-9 pl-2 pr-2.5 rounded-full flex items-center gap-1.5 transition-colors ${buttonClass}`}
      >
        <img
          src={flagUrl(selected.flagCode)}
          alt={selected.label}
          width={18}
          height={13}
          className="rounded-sm"
          loading="lazy"
        />
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${variant === 'glass' ? 'text-white/70' : 'text-surface-400'} ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          // glass apre a sinistra (right-0), panel a destra (left-0) — per non uscire schermo.
          className={`absolute ${variant === 'glass' ? 'right-0' : 'left-0'} top-full mt-2 min-w-[9.5rem] rounded-xl bg-surface-900 border border-surface-800 shadow-2xl z-50 overflow-hidden py-1`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === language}
              onClick={() => {
                setLanguage(option.value);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 transition-colors ${
                option.value === language
                  ? 'bg-brand-500/[.12] text-brand-300'
                  : 'text-surface-300 hover:bg-surface-800'
              }`}
            >
              <img
                src={flagUrl(option.flagCode)}
                alt=""
                width={18}
                height={13}
                className="rounded-sm"
                loading="lazy"
              />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
