import { useNavigate } from 'react-router-dom';
import type { NavigatorConfig } from '@artaround/shared';
import { useT } from '../services/useT';
import { EmptyState, Button } from '../components/ui';

interface NotFoundPageProps {
  config?: NavigatorConfig;
}

/** Rotta non riconosciuta — link vecchio, URL digitato a mano, QR scaduto. */
export default function NotFoundPage({ config }: NotFoundPageProps) {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="h-full flex flex-col items-center justify-center bg-surface-950 px-6">
      {/* Logo della configurazione attiva, se presente. */}
      {config?.branding.logo && (
        <img
          src={config.branding.logo}
          alt=""
          className="w-16 h-16 rounded-2xl object-cover mb-6 shadow-glow"
        />
      )}
      <EmptyState
        title={t('Pagina non trovata')}
        message={t('Il link che hai seguito non esiste più o è cambiato indirizzo.')}
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            {t('Torna alla Home')}
          </Button>
        }
      />
    </div>
  );
}
