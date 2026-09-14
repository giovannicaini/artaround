/*
 * File: /src/App.tsx                                                                    *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 14/09/2026                                                             *
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

/**
 * Componente root per l'app Navigator
 * - inizializza l'autenticazione e la configurazione del navigator;
 * - applica il tema e il manifest PWA della configurazione attiva;
 * - gestisce welcome/onboarding, prompt di installazione e routing
 *   verso le pagine principali (Home, Museum, Visit, Player, Account).
 */
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './context/authStore';
import { useNavigatorConfigStore } from './context/navigatorConfigStore';
import { useActiveNavigatorConfig, useApplyNavigatorTheme } from './services/useNavigatorTheme';
import { applyManifestAndIcons } from './services/pwa';
import HomePage from './pages/HomePage';
import MuseumPage from './pages/MuseumPage';
import VisitDetailPage from './pages/VisitDetailPage';
import VisitPlayerPage from './pages/VisitPlayerPage';
import AccountPage from './pages/AccountPage';
import WelcomePage from './pages/WelcomePage';
import OnboardingPage from './pages/OnboardingPage';
import NotFoundPage from './pages/NotFoundPage';
import { InstallPrompt } from './components/InstallPrompt';
import { LoadingState } from './components/ui';

function welcomeSeenKey(configId: string): string {
  return `welcomeSeen:${configId}`;
}

function onboardingSeenKey(configId: string): string {
  return `onboardingSeen:${configId}`;
}

function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const initNavigatorConfig = useNavigatorConfigStore((state) => state.init);
  const configReady = useNavigatorConfigStore((state) => state.ready);
  const kioskMuseumId = useNavigatorConfigStore((state) => state.kioskMuseumId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    initNavigatorConfig();
  }, [initNavigatorConfig]);

  // Tema per tutta la sessione (preso dal config)
  const { data: activeConfig } = useActiveNavigatorConfig();
  useApplyNavigatorTheme(activeConfig);

  useEffect(() => {
    if (activeConfig) applyManifestAndIcons(activeConfig);
  }, [activeConfig]);

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const hasWelcomeContent = !!(
    activeConfig?.content?.welcomeText ||
    activeConfig?.branding.splashImage ||
    activeConfig?.content?.openingImage
  );

  const alreadySeen =
    !!activeConfig?._id &&
    (() => {
      try {
        return localStorage.getItem(welcomeSeenKey(activeConfig._id)) === '1';
      } catch {
        return false;
      }
    })();

  const showWelcome =
    configReady && !!activeConfig && hasWelcomeContent && !alreadySeen && !welcomeDismissed;

  function dismissWelcome() {
    if (activeConfig?._id) {
      try {
        localStorage.setItem(welcomeSeenKey(activeConfig._id), '1');
      } catch {
        // storage non disponibile: la welcome ricomparirà al prossimo avvio, non bloccante
      }
    }
    setWelcomeDismissed(true);
  }

  // Tour del prodotto
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const onboardingAlreadySeen =
    !!activeConfig?._id &&
    (() => {
      try {
        return localStorage.getItem(onboardingSeenKey(activeConfig._id)) === '1';
      } catch {
        return false;
      }
    })();

  const showOnboarding =
    configReady && !!activeConfig && !showWelcome && !onboardingAlreadySeen && !onboardingDismissed;

  function finishOnboarding() {
    setOnboardingDismissed(true);
  }

  if (!configReady) {
    return (
      <div className="h-full bg-surface-950">
        <LoadingState />
      </div>
    );
  }

  if (showWelcome && activeConfig) {
    return (
      <div className="h-full bg-surface-950">
        <WelcomePage config={activeConfig} onContinue={dismissWelcome} />
      </div>
    );
  }

  if (showOnboarding && activeConfig) {
    return (
      <div className="h-full bg-surface-950">
        <OnboardingPage config={activeConfig} onFinish={finishOnboarding} />
      </div>
    );
  }

  return (
    <div className="h-full bg-surface-950">
      <Routes>
        <Route
          path="/"
          element={
            kioskMuseumId ? <Navigate to={`/museum/${kioskMuseumId}`} replace /> : <HomePage />
          }
        />
        <Route path="/museum/:museumId" element={<MuseumPage />} />
        <Route path="/visit/:visitId" element={<VisitDetailPage />} />
        <Route path="/visit/:visitId/play" element={<VisitPlayerPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage config={activeConfig} />} />
      </Routes>

      <InstallPrompt config={activeConfig} />
    </div>
  );
}

export default App;
