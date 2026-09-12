import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Download, Share } from 'lucide-react';
import { useAuthStore } from './context/authStore';
import { useNavigatorConfigStore } from './context/navigatorConfigStore';
import { useActiveNavigatorConfig, useApplyNavigatorTheme } from './services/useNavigatorTheme';
import { useInstallPrompt } from './services/useInstallPrompt';
import { applyManifestAndIcons } from './services/pwa';
import { useT } from './services/useT';
import { format } from './services/i18n';
import HomePage from './pages/HomePage';
import MuseumPage from './pages/MuseumPage';
import VisitDetailPage from './pages/VisitDetailPage';
import VisitPlayerPage from './pages/VisitPlayerPage';
import AccountPage from './pages/AccountPage';
import WelcomePage from './pages/WelcomePage';
import OnboardingPage from './pages/OnboardingPage';
import NotFoundPage from './pages/NotFoundPage';
import { LoadingState, Toast, Sheet, IconTile, LogoTile } from './components/ui';

function welcomeSeenKey(configId: string): string {
  return `welcomeSeen:${configId}`;
}

function onboardingSeenKey(configId: string): string {
  return `onboardingSeen:${configId}`;
}

function installToastSeenKey(configId: string): string {
  return `installToastSeen:${configId}`;
}

function App() {
  const t = useT();
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

  // Unica fonte del tema per tutta la sessione (vedi useNavigatorTheme.ts):
  // applicato qui, una volta sola, non dalle singole pagine.
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

  // Tour del prodotto, dopo l'eventuale splash del curatore — spiega cosa si
  // può fare con l'app, non il branding di questa configurazione.
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

  // Toast "Installa l'app": su Chrome/Edge/Android propone l'installazione
  // vera (beforeinstallprompt, vedi useInstallPrompt); su iOS Safari — che
  // non espone quell'evento — spiega come fare a mano con "Condividi".
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
    if (!configReady || !activeConfig || isStandalone || showWelcome || showOnboarding) return;
    if (!canInstall && !isIOS) return; // niente da proporre (desktop, browser senza supporto)
    let alreadyShown = false;
    try {
      alreadyShown = localStorage.getItem(installToastSeenKey(activeConfig._id)) === '1';
    } catch {
      // storage non disponibile: mostra comunque, non è bloccante
    }
    if (alreadyShown) return;
    const timer = setTimeout(() => setShowInstallToast(true), 2500);
    return () => clearTimeout(timer);
  }, [configReady, activeConfig, canInstall, isIOS, isStandalone, showWelcome, showOnboarding]);

  function dismissInstallToast() {
    if (activeConfig?._id) {
      try {
        localStorage.setItem(installToastSeenKey(activeConfig._id), '1');
      } catch {
        // storage non disponibile: il toast ricomparirà al prossimo avvio, non bloccante
      }
    }
    setShowInstallToast(false);
  }

  async function handleInstallAction() {
    if (isIOS) {
      setShowIosInstallHelp(true);
      dismissInstallToast(); // il toast ha z-index più alto dello Sheet: senza, resterebbe sopra
      return;
    }
    await promptInstall();
    dismissInstallToast();
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

      <Toast
        open={showInstallToast}
        icon={
          <LogoTile
            logo={activeConfig?.branding.logo}
            size={40}
            fallbackIcon={<Download className="w-5 h-5 text-white" />}
          />
        }
        message={format(t('Installa {name} sulla schermata Home per aprirla più veloce.'), {
          name: activeConfig?.pwa.shortName || activeConfig?.name || 'ArtAround',
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
    </div>
  );
}

export default App;
