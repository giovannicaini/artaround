import {
  getReferenceTypeLabel as getReferenceTypeLabelIt,
  getContentDurationLabel as getContentDurationLabelIt,
  getLanguageLevelLabel as getLanguageLevelLabelIt,
  getLicenseLabel as getLicenseLabelIt,
  ITEM_REFERENCE_TYPE_OPTIONS_IT,
  CONTENT_DURATION_OPTIONS_IT,
  LANGUAGE_LEVEL_OPTIONS_IT,
  LICENSE_TYPE_OPTIONS_IT,
  type ItemReferenceType,
  type ContentDuration,
  type LanguageLevel,
  type LicenseType,
} from '@artaround/shared';
import { __ } from '../services/i18n.service';

/**
 * Etichette ed opzioni per gli enum condivisi (tipo riferimento, durata, livello, licenza),
 * sempre passate da __() perché @artaround/shared le espone fisse in italiano.
 */
export function getReferenceTypeLabel(type: ItemReferenceType | string): string {
  return __(getReferenceTypeLabelIt(type));
}

export function getContentDurationLabel(duration: ContentDuration | string): string {
  return __(getContentDurationLabelIt(duration));
}

export function getLanguageLevelLabel(level: LanguageLevel | string): string {
  return __(getLanguageLevelLabelIt(level));
}

export function getLicenseLabel(license: LicenseType | string): string {
  return __(getLicenseLabelIt(license));
}

export function getReferenceTypeOptions() {
  return ITEM_REFERENCE_TYPE_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}

export function getContentDurationOptions() {
  return CONTENT_DURATION_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}

export function getLanguageLevelOptions() {
  return LANGUAGE_LEVEL_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}

export function getLicenseTypeOptions() {
  return LICENSE_TYPE_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}
