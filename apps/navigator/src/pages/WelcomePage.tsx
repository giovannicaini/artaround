/*
 * File: /src/pages/WelcomePage.tsx                                                      *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import type { NavigatorConfig } from '@artaround/shared';
import { useI18nStore } from '../context/i18nStore';
import { localizedField } from '../services/i18n';
import { useT } from '../services/useT';
import { Button } from '../components/ui';

// Schermata mostrata una sola volta per dispositivo, solo se la config ha welcomeText/immagini.
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
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        </>
      )}

      <div className="relative flex-1 flex flex-col items-center justify-end text-center px-6 pb-[calc(1.25rem_+_var(--safe-area-inset-bottom))] safe-top">
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
