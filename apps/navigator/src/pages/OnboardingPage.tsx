/*
 * File: /src/pages/OnboardingPage.tsx                                                   *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 12/09/2026                                                             *
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

import { useState, type ReactNode } from 'react';
import { Compass, Headphones, Mic, Map as MapIcon } from 'lucide-react';
import type { NavigatorConfig } from '@artaround/shared';
import { useT } from '../services/useT';
import { format } from '../services/i18n';
import { Button, ProgressDots, LogoTile } from '../components/ui';

interface OnboardingSlide {
  icon: ReactNode;
  title: string;
  description: string;
}

/// Tour del prodotto (cosa si può fare con l'app), subito dopo lo splash di benvenuto del curatore (se presente).
export default function OnboardingPage({
  config,
  onFinish,
}: {
  config: NavigatorConfig;
  onFinish: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);

  const isMuseumLocked = config.applicability === 'museum';

  const slides: OnboardingSlide[] = [
    {
      icon: (
        <LogoTile
          logo={config.branding.logo}
          size={64}
          fallbackIcon={<Compass className="w-8 h-8 text-white" />}
        />
      ),
      title: isMuseumLocked
        ? format(t('Benvenuto in {name}'), { name: config.name })
        : t('Benvenuto in ArtAround'),
      description: isMuseumLocked
        ? t(
            "Questa app ti accompagna nella visita di questo museo, con un'audioguida su misura per te.",
          )
        : t('Da qui puoi scoprire tutti i musei disponibili e scegliere quello da visitare.'),
    },
    {
      icon: <Headphones className="w-8 h-8 text-white" />,
      title: t('Scegli il ritmo giusto per te'),
      description: t(
        'Livello di approfondimento, durata e lingua: li scegli tu, e puoi cambiarli in ogni momento dalle Impostazioni durante la visita.',
      ),
    },
    {
      icon: <Mic className="w-8 h-8 text-white" />,
      title: t('Parla con la tua guida'),
      description: t(
        'Basta la voce: "prossimo", "dimmi di più", "chi è l\'autore", "dov\'è il bagno" — la guida risponde mentre cammini.',
      ),
    },
    {
      icon: <MapIcon className="w-8 h-8 text-white" />,
      title: t('Mappa e servizi'),
      description: t(
        'Una mappa interattiva mostra dove sei, dove sono bagni, bar e uscite, e ti porta dritto alla prossima opera.',
      ),
    },
  ];

  const isLast = step === slides.length - 1;
  const slide = slides[step];

  function persistIfRequested() {
    try {
      localStorage.setItem(`onboardingSeen:${config._id}`, '1');
    } catch {
      // storage non disponibile: il tour ricomparirà al prossimo avvio, non bloccante
    }
  }

  function handleSkip() {
    persistIfRequested();
    onFinish();
  }

  function handleNext() {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    persistIfRequested();
    onFinish();
  }

  return (
    <div className="h-full bg-surface-950 flex flex-col safe-top safe-bottom">
      <div className="flex justify-end px-5 pt-4">
        <button
          onClick={handleSkip}
          className="text-sm text-surface-500 hover:text-surface-300 font-medium px-2 py-1"
        >
          {t('Salta')}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 rounded-3xl gradient-aurora shadow-glow flex items-center justify-center mb-8">
          {slide.icon}
        </div>
        <h1 className="font-display text-2xl font-bold text-surface-50 mb-3 max-w-sm">
          {slide.title}
        </h1>
        <p className="text-surface-400 text-sm leading-relaxed max-w-sm">{slide.description}</p>
      </div>

      <div className="px-8 pb-8">
        <div className="flex justify-center mb-6">
          <ProgressDots total={slides.length} current={step} onSelect={setStep} />
        </div>

        <Button variant="primary" block onClick={handleNext}>
          {isLast ? t('Inizia') : t('Avanti')}
        </Button>
      </div>
    </div>
  );
}
