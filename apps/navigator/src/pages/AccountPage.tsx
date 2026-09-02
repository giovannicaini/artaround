import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  LogOut,
  Mail,
  Lock,
  User as UserIcon,
  ShoppingBag,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useT } from '../services/useT';
import { localizedField } from '../services/i18n';
import {
  CompetenceLevel,
  TimePreference,
  type UserPreferences,
  type VisitPurchase,
} from '@artaround/shared';
import { Button, Card, Chip, LanguageSwitcher, LoadingState, EmptyState } from '../components/ui';

const INTEREST_OPTIONS = [
  'Storia degli artisti',
  'Architettura',
  'Colori e materiali',
  'Eventi storici',
  'Stili e correnti',
  'Curiosità e aneddoti',
];

export default function AccountPage() {
  const navigate = useNavigate();
  const t = useT();
  const language = useI18nStore((state) => state.language);
  const { user, status, error, login, register, updatePreferences, logout } = useAuthStore();

  if (status === 'loading' && !user) {
    return (
      <div className="h-full bg-surface-950">
        <LoadingState message={t('Un attimo...')} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-surface-950">
      <header className="sticky top-0 z-20 safe-top bg-surface-950/85 backdrop-blur-md border-b border-surface-800/60">
        <div className="flex items-center justify-between px-5 lg:px-8 py-3 lg:max-w-2xl lg:mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-surface-800 flex items-center justify-center text-surface-300 hover:bg-surface-700 transition-colors"
            aria-label={t('Torna indietro')}
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <span className="font-display text-sm font-semibold text-surface-50">{t('Account')}</span>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="lg:max-w-2xl lg:mx-auto px-5 py-6 lg:px-0 lg:py-10">
        {user ? (
          <LoggedInView
            user={user}
            language={language}
            onSave={updatePreferences}
            onLogout={() => {
              logout();
            }}
          />
        ) : (
          <AuthForms
            authError={error}
            onLogin={login}
            onRegister={register}
            onGuest={() => navigate('/')}
          />
        )}
      </div>
    </div>
  );
}

function AuthForms({
  authError,
  onLogin,
  onRegister,
  onGuest,
}: {
  authError: string | null;
  onLogin: (c: { username: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  onRegister: (d: {
    username: string;
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onGuest: () => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    const result =
      mode === 'login'
        ? await onLogin({ username, password })
        : await onRegister({ username, email, password });
    setSubmitting(false);
    if (!result.ok) setLocalError(result.error || null);
  }

  return (
    <div>
      <div className="w-14 h-14 rounded-2xl gradient-aurora shadow-glow flex items-center justify-center mb-5">
        <UserIcon className="w-7 h-7 text-white" />
      </div>
      <h1 className="font-display text-2xl font-bold text-surface-50 mb-1.5">
        {mode === 'login' ? t('Accedi') : t('Crea un account')}
      </h1>
      <p className="text-surface-400 text-sm mb-6">
        {mode === 'login'
          ? t('Per vedere le visite che hai già acquistato e ricevere consigli su misura.')
          : t('Bastano pochi dati — potrai personalizzare tutto dopo.')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3.5 mb-5">
        <Field icon={<UserIcon className="w-4 h-4" />} label={t('Nome utente')}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full bg-transparent text-surface-50 placeholder:text-surface-600 outline-none"
          />
        </Field>

        {mode === 'register' && (
          <Field icon={<Mail className="w-4 h-4" />} label={t('Email')}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-transparent text-surface-50 placeholder:text-surface-600 outline-none"
            />
          </Field>
        )}

        <Field icon={<Lock className="w-4 h-4" />} label={t('Password')}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full bg-transparent text-surface-50 placeholder:text-surface-600 outline-none"
          />
        </Field>

        {(localError || authError) && (
          <p className="text-danger-500 text-sm">{localError || authError}</p>
        )}

        <Button type="submit" variant="primary" block loading={submitting}>
          {mode === 'login' ? t('Accedi') : t('Crea account')}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setLocalError(null);
          }}
          className="text-brand-400 hover:text-brand-300 font-medium"
        >
          {mode === 'login' ? t('Non hai un account? Registrati') : t('Hai già un account? Accedi')}
        </button>
        <button onClick={onGuest} className="text-surface-500 hover:text-surface-300">
          {t('Continua come ospite')}
        </button>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5 block">
        {label}
      </span>
      <div className="flex items-center gap-2.5 px-3.5 h-11 rounded-xl bg-surface-900 border border-surface-800 focus-within:border-brand-500/50 transition-colors">
        <span className="text-surface-500 flex-shrink-0">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function LoggedInView({
  user,
  language,
  onSave,
  onLogout,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  language: ReturnType<typeof useI18nStore.getState>['language'];
  onSave: (p: Partial<UserPreferences>) => Promise<{ ok: boolean; error?: string }>;
  onLogout: () => void;
}) {
  const t = useT();
  const [competenceLevel, setCompetenceLevel] = useState<CompetenceLevel>(
    user.preferences?.competenceLevel || CompetenceLevel.MEDIO,
  );
  const [availableTime, setAvailableTime] = useState<TimePreference>(
    user.preferences?.availableTime || TimePreference.NORMALE,
  );
  const [interests, setInterests] = useState<string[]>(user.preferences?.interests || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const COMPETENCE_META: Record<CompetenceLevel, { emoji: string; label: string }> = {
    [CompetenceLevel.INFANTILE]: { emoji: '👶', label: t('Curioso') },
    [CompetenceLevel.SEMPLICE]: { emoji: '🌱', label: t('Appassionato') },
    [CompetenceLevel.MEDIO]: { emoji: '🌿', label: t('Studente') },
    [CompetenceLevel.AVANZATO]: { emoji: '🎓', label: t('Esperto') },
  };
  const TIME_META: Record<TimePreference, { emoji: string; label: string }> = {
    [TimePreference.VELOCE]: { emoji: '⚡', label: t('Veloce (30-45 min)') },
    [TimePreference.NORMALE]: { emoji: '🚶', label: t('Con calma (1-2 ore)') },
    [TimePreference.APPROFONDITO]: { emoji: '🧭', label: t('Tutta la giornata') },
  };

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }

  async function handleSave() {
    setSaving(true);
    const result = await onSave({
      competenceLevel,
      availableTime,
      interests,
      age: user.preferences?.age,
      language,
    });
    setSaving(false);
    if (result.ok) setSaved(true);
  }

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['my-purchases', 'account'],
    queryFn: () => api.getMyPurchases(),
  });

  return (
    <div className="space-y-8">
      {/* Profilo */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full gradient-aurora shadow-glow flex items-center justify-center flex-shrink-0">
          <span className="font-display font-bold text-white text-lg">
            {user.username.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-surface-50 text-lg truncate">
            {user.username}
          </p>
          <p className="text-surface-500 text-sm truncate">{user.email}</p>
        </div>
      </div>

      {/* Preferenze */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <h2 className="font-display text-base font-semibold text-surface-50">
            {t('Le tue preferenze')}
          </h2>
        </div>
        <p className="text-surface-500 text-sm mb-4">
          {t(
            'Guidano i livelli e le durate proposti di default — puoi comunque cambiarli sempre durante la visita.',
          )}
        </p>

        <div className="mb-5">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">
            {t("Quanto conosci già l'arte?")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(CompetenceLevel).map((level) => (
              <Chip
                key={level}
                selected={competenceLevel === level}
                onClick={() => setCompetenceLevel(level)}
              >
                {COMPETENCE_META[level].emoji} {COMPETENCE_META[level].label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">
            {t('Quanto tempo hai di solito?')}
          </p>
          <div className="flex flex-col gap-2">
            {Object.values(TimePreference).map((time) => (
              <Chip
                key={time}
                selected={availableTime === time}
                onClick={() => setAvailableTime(time)}
              >
                {TIME_META[time].emoji} {TIME_META[time].label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">
            {t('Cosa ti interessa di più?')}
          </p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <Chip
                key={interest}
                selected={interests.includes(interest)}
                onClick={() => toggleInterest(interest)}
              >
                {t(interest)}
              </Chip>
            ))}
          </div>
        </div>

        <Button variant="primary" onClick={handleSave} loading={saving}>
          {saved ? t('Salvato ✓') : t('Salva preferenze')}
        </Button>
      </section>

      {/* Acquisti */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="w-4 h-4 text-brand-400" />
          <h2 className="font-display text-base font-semibold text-surface-50">
            {t('I miei acquisti')}
          </h2>
        </div>
        <PurchasesList purchases={purchases} loading={purchasesLoading} language={language} />
      </section>

      <div className="pt-4 border-t border-surface-800 space-y-3">
        <a
          href="/marketplace"
          className="flex items-center justify-center gap-2.5 py-3 px-5 bg-surface-900 border border-surface-800 rounded-xl text-surface-400 hover:text-brand-300 hover:border-brand-500/30 transition-all text-sm font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          {t('Vai al Marketplace completo')}
        </a>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 text-danger-500 hover:bg-danger-100 rounded-xl transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          {t('Esci')}
        </button>
      </div>
    </div>
  );
}

function PurchasesList({
  purchases,
  loading,
  language,
}: {
  purchases: VisitPurchase[] | undefined;
  loading: boolean;
  language: ReturnType<typeof useI18nStore.getState>['language'];
}) {
  const t = useT();
  const navigate = useNavigate();

  const { data: visits } = useQuery({
    queryKey: ['purchased-visits', purchases?.map((p) => p.visitId)],
    queryFn: () => Promise.all(purchases!.map((p) => api.getVisit(p.visitId).catch(() => null))),
    enabled: !!purchases && purchases.length > 0,
  });

  const resolved = useMemo(
    () => (visits || []).filter((v): v is NonNullable<typeof v> => v !== null),
    [visits],
  );

  if (loading) return <LoadingState fullHeight={false} message={t('Cerco i tuoi acquisti...')} />;

  if (!purchases || purchases.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title={t('Nessun acquisto ancora')}
        message={t('Le visite a pagamento che acquisti appariranno qui.')}
      />
    );
  }

  return (
    <div className="space-y-2">
      {resolved.map((visit) => (
        <Card
          key={visit._id}
          className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-brand-500/40 transition-colors"
          onClick={() => navigate(`/visit/${visit._id}`)}
        >
          <div className="min-w-0">
            <p className="text-surface-50 font-medium truncate">
              {localizedField(language, visit.title, visit.titleTranslations)}
            </p>
            <p className="text-surface-500 text-xs">
              {visit.metadata?.estimatedDuration} {t('min')} · {visit.metadata?.artworksCount}{' '}
              {t('opere')}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
