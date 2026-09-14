import { BCP47_BY_LANGUAGE, type AppLanguage, type GeneratedAudio } from '@artaround/shared';
import { i18nService } from '../services/i18n.service';
import { uploadService } from '../services/upload.service';

/**
 * Riproduzione dell'audio di un item, caricato o generato, con la sintesi vocale del browser come riserva.
 */
let currentAudioEl: HTMLAudioElement | null = null;

// Ferma qualunque riproduzione in corso (file audio o sintesi vocale) — un solo audio alla volta.
export function stopItemAudio(): void {
  currentAudioEl?.pause();
  currentAudioEl = null;
  window.speechSynthesis?.cancel();
}

// Riproduce l'audio caricato/generato di un item nella lingua corrente dell'interfaccia (o in quella sorgente come riserva) se…
export function playItemAudio(
  audio: Partial<Record<AppLanguage, GeneratedAudio>> | undefined,
  sourceLanguage: AppLanguage,
  text: string,
  onEnd: () => void,
): void {
  stopItemAudio();
  const lang = i18nService.getLanguage();
  const generated = audio?.[lang] ?? audio?.[sourceLanguage];

  if (generated) {
    const el = new Audio(uploadService.getImageUrl(generated.url));
    el.onended = onEnd;
    el.onerror = onEnd;
    currentAudioEl = el;
    void el.play();
    return;
  }

  if (!window.speechSynthesis || !text.trim()) {
    onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BCP47_BY_LANGUAGE[lang];
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}
