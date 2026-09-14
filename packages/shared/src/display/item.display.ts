import {
  ContentDuration,
  ItemReferenceType,
  LanguageLevel,
  LicenseType,
} from '../types/item.types';
import type { SelectOption } from './common';

export const ITEM_REFERENCE_TYPE_LABELS_IT: Readonly<Record<ItemReferenceType, string>> = {
  [ItemReferenceType.ARTWORK]: "Opera d'arte",
  [ItemReferenceType.AUTHOR]: 'Autore/Artista',
  [ItemReferenceType.MOVEMENT]: 'Movimento artistico',
  [ItemReferenceType.PERIOD]: 'Periodo storico',
  [ItemReferenceType.MUSEUM]: 'Museo',
};

export const ITEM_REFERENCE_TYPE_SHORT_LABELS_IT: Readonly<Record<ItemReferenceType, string>> = {
  [ItemReferenceType.ARTWORK]: 'Opera',
  [ItemReferenceType.AUTHOR]: 'Autore',
  [ItemReferenceType.MOVEMENT]: 'Movimento',
  [ItemReferenceType.PERIOD]: 'Periodo',
  [ItemReferenceType.MUSEUM]: 'Museo',
};

export const ITEM_REFERENCE_TYPE_OPTIONS_IT: ReadonlyArray<SelectOption<ItemReferenceType>> = (
  Object.values(ItemReferenceType) as ItemReferenceType[]
).map((value) => ({
  value,
  label: ITEM_REFERENCE_TYPE_LABELS_IT[value],
}));

export const CONTENT_DURATION_LABELS_IT: Readonly<Record<ContentDuration, string>> = {
  [ContentDuration.FLASH]: 'Flash',
  [ContentDuration.SHORT]: 'Breve',
  [ContentDuration.MEDIUM]: 'Medio',
  [ContentDuration.LONG]: 'Lungo',
};

export const CONTENT_DURATION_OPTIONS_IT: ReadonlyArray<SelectOption<ContentDuration>> = [
  { value: ContentDuration.FLASH, label: '3 secondi - Flash' },
  { value: ContentDuration.SHORT, label: '15 secondi - Breve' },
  { value: ContentDuration.MEDIUM, label: '1 minuto - Medio' },
  { value: ContentDuration.LONG, label: '4 minuti - Lungo' },
];

export const CONTENT_DURATION_MATRIX_OPTIONS_IT: ReadonlyArray<SelectOption<ContentDuration>> = [
  { value: ContentDuration.SHORT, label: '15s - Brevissima' },
  { value: ContentDuration.MEDIUM, label: '1min - Breve' },
  { value: ContentDuration.LONG, label: '4min - Media' },
];

export const LANGUAGE_LEVEL_LABELS_IT: Readonly<Record<LanguageLevel, string>> = {
  [LanguageLevel.CHILDREN]: 'Bambini',
  [LanguageLevel.ELEMENTARY]: 'Elementare',
  [LanguageLevel.MEDIUM]: 'Medio',
  [LanguageLevel.SPECIALIST]: 'Esperto',
};

export const LANGUAGE_LEVEL_OPTIONS_IT: ReadonlyArray<SelectOption<LanguageLevel>> = [
  { value: LanguageLevel.CHILDREN, label: 'Bambini (5-10 anni)' },
  { value: LanguageLevel.ELEMENTARY, label: 'Elementare (10-14 anni)' },
  { value: LanguageLevel.MEDIUM, label: 'Medio (adulti)' },
  { value: LanguageLevel.SPECIALIST, label: 'Specialistico (esperti)' },
];

export const LANGUAGE_LEVEL_OPTIONS_EMOJI_IT: ReadonlyArray<SelectOption<LanguageLevel>> = [
  { value: LanguageLevel.CHILDREN, label: '👶 Bambini (5-10 anni)' },
  { value: LanguageLevel.ELEMENTARY, label: '📗 Elementare (10-14 anni)' },
  { value: LanguageLevel.MEDIUM, label: '📘 Medio (adulti)' },
  { value: LanguageLevel.SPECIALIST, label: '🎓 Specialistico (esperti)' },
];

export const LANGUAGE_LEVEL_SHORT_OPTIONS_IT: ReadonlyArray<SelectOption<LanguageLevel>> = [
  { value: LanguageLevel.CHILDREN, label: 'Bambini' },
  { value: LanguageLevel.ELEMENTARY, label: 'Elementare' },
  { value: LanguageLevel.MEDIUM, label: 'Medio' },
  { value: LanguageLevel.SPECIALIST, label: 'Specialistico' },
];

export const LICENSE_TYPE_LABELS_IT: Readonly<Record<LicenseType, string>> = {
  [LicenseType.CC0]: 'CC0 - Pubblico Dominio',
  [LicenseType.CC_BY]: 'CC BY - Attribuzione',
  [LicenseType.CC_BY_SA]: 'CC BY-SA - Attribuzione Condividi',
  [LicenseType.CC_BY_NC]: 'CC BY-NC - Non Commerciale',
  [LicenseType.CC_BY_NC_SA]: 'CC BY-NC-SA - Non Commerciale Condividi',
  [LicenseType.PROPRIETARY]: 'Proprietaria',
};

export const LICENSE_TYPE_OPTIONS_IT: ReadonlyArray<SelectOption<LicenseType>> = (
  Object.values(LicenseType) as LicenseType[]
).map((value) => ({
  value,
  label: LICENSE_TYPE_LABELS_IT[value],
}));

export function getReferenceTypeLabel(type: ItemReferenceType | string): string {
  return ITEM_REFERENCE_TYPE_SHORT_LABELS_IT[type as ItemReferenceType] ?? type;
}

export function getContentDurationLabel(duration: ContentDuration | string): string {
  return CONTENT_DURATION_LABELS_IT[duration as ContentDuration] ?? duration;
}

export function getLanguageLevelLabel(level: LanguageLevel | string): string {
  return LANGUAGE_LEVEL_LABELS_IT[level as LanguageLevel] ?? level;
}

export function getLicenseLabel(license: LicenseType | string): string {
  return LICENSE_TYPE_LABELS_IT[license as LicenseType] ?? license;
}
