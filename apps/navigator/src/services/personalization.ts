import {
  LanguageLevel,
  ContentDuration,
  CompetenceLevel,
  TimePreference,
  type UserPreferences,
} from '@artaround/shared';

const COMPETENCE_TO_LEVEL: Record<CompetenceLevel, LanguageLevel> = {
  [CompetenceLevel.INFANTILE]: LanguageLevel.CHILDREN,
  [CompetenceLevel.SEMPLICE]: LanguageLevel.ELEMENTARY,
  [CompetenceLevel.MEDIO]: LanguageLevel.MEDIUM,
  [CompetenceLevel.AVANZATO]: LanguageLevel.SPECIALIST,
};

const TIME_TO_DURATION: Record<TimePreference, ContentDuration> = {
  [TimePreference.VELOCE]: ContentDuration.SHORT,
  [TimePreference.NORMALE]: ContentDuration.MEDIUM,
  [TimePreference.APPROFONDITO]: ContentDuration.LONG,
};

/** Preferenze salvate → livello/durata di partenza, sempre modificabili dai selettori del player. */
export function defaultLanguageLevel(preferences?: UserPreferences | null): LanguageLevel {
  if (preferences?.competenceLevel) return COMPETENCE_TO_LEVEL[preferences.competenceLevel];
  return LanguageLevel.MEDIUM;
}

export function defaultContentDuration(preferences?: UserPreferences | null): ContentDuration {
  if (preferences?.availableTime) return TIME_TO_DURATION[preferences.availableTime];
  return ContentDuration.MEDIUM;
}

/** Punteggio di affinità 0-1 tra interessi salvati e quelli di una visita — alimenta "Per te". */
export function interestAffinity(
  userInterests: string[] | undefined,
  targetInterests: string[] | undefined,
): number {
  if (!userInterests?.length || !targetInterests?.length) return 0;
  const target = new Set(targetInterests.map((i) => i.toLowerCase()));
  const matches = userInterests.filter((i) => target.has(i.toLowerCase())).length;
  return matches / target.size;
}
