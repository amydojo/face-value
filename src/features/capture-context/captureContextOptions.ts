import type { CaptureContext } from '../../domain/model';

export const CAPTURE_CONTEXT_OPTIONS: Array<{
  key: Exclude<keyof CaptureContext, 'note'>;
  label: string;
}> = [
  { key: 'makeup', label: 'Makeup' },
  { key: 'recentHeatOrExercise', label: 'Recent heat or exercise' },
  {
    key: 'recentCleansingOrSkincare',
    label: 'Recent cleansing or skincare',
  },
  {
    key: 'routineOrTreatmentChange',
    label: 'Routine or treatment change',
  },
];
