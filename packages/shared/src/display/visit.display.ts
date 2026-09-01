import { VisitStepType } from '../types/visit.types';

export const VISIT_STEP_TYPE_META: Readonly<
  Record<VisitStepType, { label: string; icon: string }>
> = {
  [VisitStepType.ARTWORK]: { label: 'Opera', icon: '🖼️' },
  [VisitStepType.LOGISTIC]: { label: 'Info', icon: 'ℹ️' },
  [VisitStepType.NAVIGATION]: { label: 'Direzioni', icon: '➡️' },
  [VisitStepType.WAYPOINT]: { label: 'Svolta percorso', icon: '•' },
};

export function getVisitStepTypeLabel(type: VisitStepType): string {
  const meta = VISIT_STEP_TYPE_META[type];
  return `${meta.icon} ${meta.label}`;
}
