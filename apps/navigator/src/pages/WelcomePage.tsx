import type { NavigatorConfig } from '@artaround/shared';
import { useI18nStore } from '../context/i18nStore';
import { localizedField } from '../services/i18n';
import { useT } from '../services/useT';
import { Button } from '../components/ui';

/** Schermata mostrata una sola volta per dispositivo, solo se la config ha welcomeText/immagini. */
export default function WelcomePage({
  config,
  onContinue,
}: {
  config: NavigatorConfig;
  onContinue: () => void;
}) {
  const t = useT();
  const language = useI18nStore((state) => state.language);

  const image = config.branding.splashImage || config.content?.openingImage;
  const welcomeText = config.content?.welcomeText
    ? localizedField(language, config.content.welcomeText, config.content.welcomeTextTranslations)
    : '';
  const title = config.content?.homeTitle
    ? localizedField(language, config.content.homeTitle, config.content.homeTitleTranslations)
    : config.name;

  return (
    <div className="h-full relative overflow-hidden bg-surface-950 flex flex-col">
      {image && (
        <>
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          {/* Scrim fisso, non legato al tema: deve scurire una foto reale in ogni configurazione. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        </>
      )}

      <div className="relative flex-1 flex flex-col items-center justify-end text-center px-6 pb-[calc(2.5rem_+_var(--safe-area-inset-bottom))] safe-top">
        {config.branding.logo && (
          <img
            src={config.branding.logo}
            alt=""
            className="w-16 h-16 rounded-2xl object-cover mb-6 shadow-glow"
          />
        )}
        {/* Con foto il testo sta sullo scrim fisso sopra: sempre bianco. Senza,
            sta sullo sfondo bg-surface-950 e segue il tema come lui. */}
        <h1
          className={`font-display text-3xl font-bold mb-3 max-w-md ${image ? 'text-white' : 'text-surface-50'}`}
        >
          {title}
        </h1>
        {welcomeText && (
          <p
            className={`text-sm leading-relaxed max-w-sm mb-8 ${image ? 'text-white/70' : 'text-surface-300'}`}
          >
            {welcomeText}
          </p>
        )}
        <Button variant="primary" onClick={onContinue}>
          {t('Continua')}
        </Button>
      </div>
    </div>
  );
}
