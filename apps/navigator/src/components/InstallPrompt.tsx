/*
 * File: /src/components/InstallPrompt.tsx                                               *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 13/09/2026                                                             *
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

import { useEffect, useMemo, useState } from 'react';
import { Download, Share } from 'lucide-react';
import type { NavigatorConfig } from '@artaround/shared';
import { useInstallPrompt } from '../services/useInstallPrompt';
import { useT } from '../services/useT';
import { format } from '../services/i18n';
import { Toast, Sheet, IconTile, LogoTile } from './ui';

interface InstallPromptProps {
  config: NavigatorConfig | undefined;
}

function installToastSeenKey(configId: string): string {
  return `installToastSeen:${configId}`;
}

// Propone l'installazione della PWA: su Chrome/Edge/Android il prompt vero
// su iOS Safari, un modal con le istruzioni per farlo a mano

export function InstallPrompt({ config }: InstallPromptProps) {
  const t = useT();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [showInstallToast, setShowInstallToast] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const isIOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);
  const isStandalone = useMemo(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    [],
  );

  useEffect(() => {
    if (!config || isStandalone) return;
    if (!canInstall && !isIOS) return; // niente da proporre (desktop, browser senza supporto)
    let alreadyShown = false;
    try {
      alreadyShown = localStorage.getItem(installToastSeenKey(config._id)) === '1';
    } catch {
      // storage non disponibile: mostra comunque, non è bloccante
    }
    if (alreadyShown) return;
    const timer = setTimeout(() => setShowInstallToast(true), 2500);
    return () => clearTimeout(timer);
  }, [config, canInstall, isIOS, isStandalone]);

  function dismissInstallToast() {
    if (config?._id) {
      try {
        localStorage.setItem(installToastSeenKey(config._id), '1');
      } catch {
        // storage non disponibile: il toast ricomparirà al prossimo avvio, non bloccante
      }
    }
    setShowInstallToast(false);
  }

  async function handleInstallAction() {
    if (isIOS) {
      setShowIosInstallHelp(true);
      dismissInstallToast();
      return;
    }
    await promptInstall();
    dismissInstallToast();
  }

  return (
    <>
      <Toast
        open={showInstallToast}
        icon={
          <LogoTile
            logo={config?.branding.logo}
            size={40}
            fallbackIcon={<Download className="w-5 h-5 text-white" />}
          />
        }
        message={format(t('Installa {name} sulla schermata Home per aprirla più veloce.'), {
          name: config?.pwa.shortName || config?.name || 'ArtAround',
        })}
        actionLabel={isIOS ? t('Come si fa') : t('Installa')}
        onAction={handleInstallAction}
        onClose={dismissInstallToast}
      />

      <Sheet
        open={showIosInstallHelp}
        onClose={() => {
          setShowIosInstallHelp(false);
          dismissInstallToast();
        }}
        title={t('Aggiungi alla schermata Home')}
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300 leading-relaxed">
            {t(
              'Tocca il pulsante "Condividi" nella barra di Safari, poi scegli "Aggiungi alla schermata Home".',
            )}
          </p>
          <div className="flex items-center justify-center py-2">
            <IconTile icon={<Share />} variant="panel" size="lg" label={t('Condividi')} />
          </div>
        </div>
      </Sheet>
    </>
  );
}
