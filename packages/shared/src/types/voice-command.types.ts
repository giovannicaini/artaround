/**
 * Comandi vocali del Navigator
 *
 * Set fisso di azioni riconoscibili durante una visita, sia dal match
 * locale (pattern testuali) sia dal fallback AI — quest'ultimo può solo
 * scegliere tra questi ID, mai restituire testo libero.
 */

export const VOICE_COMMAND_IDS = [
  'next',
  'prev',
  'play',
  'stop',
  'whatIsThis',
  'more',
  'less',
  'tooHard',
  'tooSimple',
  'author',
  'style',
  'repeat',
  'exit',
  'toilette',
  'bar',
  'shop',
  'obstacles',
  'help',
] as const;

export type VoiceCommandId = (typeof VOICE_COMMAND_IDS)[number];

export const isVoiceCommandId = (value: unknown): value is VoiceCommandId =>
  typeof value === 'string' && (VOICE_COMMAND_IDS as readonly string[]).includes(value);
