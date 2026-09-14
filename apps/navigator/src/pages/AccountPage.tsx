/*
 * File: /src/pages/AccountPage.tsx                                                      *
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
  Download,
} from 'lucide-react';
import { api } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useInstallPrompt } from '../services/useInstallPrompt';
import { useT } from '../services/useT';
import { localizedField } from '../services/i18n';
import {
  CompetenceLevel,
  TimePreference,
  type UserPreferences,
  type VisitPurchaseWithVisit,
} from '@artaround/shared';
import {
  Button,
  Card,
  LoadingState,
  EmptyState,
  StickyHeader,
  UserAvatar,
  TextField,
  LabeledSelect,
  SectionHeader,
  Link,
} from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

//Pagina Account: se si è loggati ci sono le preferenze, altrimenti login/registrazione
export default function AccountPage() {
  const navigate = useNavigate();
  const t = useT();
  const language = useI18nStore((state) => state.language);
  const { user, status, error, login, register, updatePreferences, logout } = useAuthStore();
  const { canInstall, promptInstall } = useInstallPrompt();

  if (status === 'loading' && !user) {
    return (
      <div className="h-full bg-surface-950">
        <LoadingState message={t('Caricamento in corso...')} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-surface-950">
      <StickyHeader maxWidthClassName="lg:max-w-2xl">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-surface-800 flex items-center justify-center text-surface-300 hover:bg-surface-700 transition-colors"
          aria-label={t('Torna indietro')}
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <span className="font-display text-sm font-semibold text-surface-50">{t('Account')}</span>
        <LanguageSwitcher menuAlign="right" />
      </StickyHeader>

      <div className="lg:max-w-2xl lg:mx-auto px-5 py-6 lg:px-0 lg:py-10">
        {canInstall && (
          <div className="mb-6">
            <Button variant="secondary" block icon={<Download />} onClick={promptInstall}>
              {t("Installa l'app")}
            </Button>
          </div>
        )}
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
        <TextField
          icon={<UserIcon className="w-4 h-4" />}
          label={t('Nome utente')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
        />

        {mode === 'register' && (
          <TextField
            icon={<Mail className="w-4 h-4" />}
            label={t('Email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        )}

        <TextField
          icon={<Lock className="w-4 h-4" />}
          label={t('Password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  //ripristina pulsante "salvato" dopo salvataggio
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

  async function handleSave() {
    setSaving(true);
    const result = await onSave({
      competenceLevel,
      availableTime,
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
        <UserAvatar username={user.username} size="lg" />
        <div className="min-w-0">
          <p className="font-display font-semibold text-surface-50 text-lg truncate">
            {user.username}
          </p>
          <p className="text-surface-500 text-sm truncate">{user.email}</p>
        </div>
      </div>

      {/* Preferenze */}
      <section>
        <SectionHeader
          icon={<Sparkles className="w-4 h-4 text-brand-400" />}
          title={t('Le tue preferenze')}
        />
        <p className="text-surface-500 text-sm mb-4">
          {t(
            'Guidano i livelli e le durate proposti di default — puoi comunque cambiarli sempre durante la visita.',
          )}
        </p>

        <LabeledSelect
          label={t("Quanto conosci già l'arte?")}
          value={competenceLevel}
          onChange={(value) => setCompetenceLevel(value as CompetenceLevel)}
          options={Object.values(CompetenceLevel).map((level) => ({
            value: level,
            label: `${COMPETENCE_META[level].emoji} ${COMPETENCE_META[level].label}`,
          }))}
        />

        <LabeledSelect
          label={t('Quanto tempo hai di solito?')}
          value={availableTime}
          onChange={(value) => setAvailableTime(value as TimePreference)}
          options={Object.values(TimePreference).map((time) => ({
            value: time,
            label: `${TIME_META[time].emoji} ${TIME_META[time].label}`,
          }))}
        />

        <Button variant="primary" onClick={handleSave} loading={saving}>
          {saved ? t('Salvato ✓') : t('Salva preferenze')}
        </Button>
      </section>

      {/* Acquisti */}
      <section>
        <SectionHeader
          icon={<ShoppingBag className="w-4 h-4 text-brand-400" />}
          title={t('I miei acquisti')}
        />
        <PurchasesList purchases={purchases} loading={purchasesLoading} language={language} />
      </section>

      <div className="pt-4 border-t border-surface-800 space-y-3">
        <Link
          icon={<ExternalLink className="w-4 h-4" />}
          label={t('Vai al Marketplace completo')}
          href="/marketplace/"
        />
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
  purchases: VisitPurchaseWithVisit[] | undefined;
  loading: boolean;
  language: ReturnType<typeof useI18nStore.getState>['language'];
}) {
  const t = useT();
  const navigate = useNavigate();

  // visitId è già un documento visita completo (assente se la visita acquistata è stata eliminata nel frattempo)
  const resolved = useMemo(
    () => (purchases || []).map((p) => p.visitId).filter(Boolean),
    [purchases],
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
