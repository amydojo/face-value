import type { AnalysisResult, CaptureContext, ProductPlacement, RegisteredProduct } from './model';
import { REDNESS_MVP_OBSERVATION_WINDOW } from './evidence/redness';

export const FOLLOW_UP_INTERVAL_DAYS = REDNESS_MVP_OBSERVATION_WINDOW.minimum;
export type ProductRegistrationInput = {
  brand: string;
  productName: string;
  strength?: string | null;
  volume?: string | null;
};

export type ProductRegistrationErrors = Partial<Record<keyof ProductRegistrationInput, string>>;

const normalizedText = (value: string | null | undefined, maximumLength: number): string | null => {
  const normalized = value?.trim().replace(/\s+/g, ' ').slice(0, maximumLength) ?? '';
  return normalized || null;
};

const normalizeNumericUnit = (
  value: string | null | undefined,
  unit: '%' | 'ml',
): string | null => {
  const normalized = normalizedText(value, 48);
  if (!normalized) return null;
  const unitPattern = unit === '%' ? /%\s*$/ : /\s*ml\s*$/i;
  const numericCandidate = normalized.replace(unitPattern, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(numericCandidate)) return normalized;
  const numericValue = Number(numericCandidate);
  if (!Number.isFinite(numericValue)) return normalized;
  return unit === '%' ? `${numericValue}%` : `${numericValue} ml`;
};

export function normalizeStrength(value: string | null | undefined): string | null {
  return normalizeNumericUnit(value, '%');
}

export function normalizeVolume(value: string | null | undefined): string | null {
  return normalizeNumericUnit(value, 'ml');
}

export function validateProductRegistration(
  input: ProductRegistrationInput,
): ProductRegistrationErrors {
  const errors: ProductRegistrationErrors = {};
  if (!normalizedText(input.brand, 80)) errors.brand = 'Enter the product brand.';
  if (!normalizedText(input.productName, 120)) {
    errors.productName = 'Enter the product name.';
  }
  return errors;
}

export function createRegisteredProduct(
  input: ProductRegistrationInput,
  now: string,
): RegisteredProduct {
  const errors = validateProductRegistration(input);
  if (Object.keys(errors).length > 0) {
    throw new Error('A registered product requires a brand and product name.');
  }

  const timestampId = now.replace(/\D/g, '').slice(0, 17) || 'registered';
  return {
    id: `registered-product-${timestampId}`,
    accession: 'SPECIMEN 01',
    brand: normalizedText(input.brand, 80)!,
    productName: normalizedText(input.productName, 120)!,
    strength: normalizeStrength(input.strength),
    volume: normalizeVolume(input.volume),
    assignedJob: 'Reduce visible redness',
    protocolId: 'youcam-redness-v1',
    expectedObservationWindowDays: {
      ...REDNESS_MVP_OBSERVATION_WINDOW,
    },
    createdAt: now,
  };
}

export function isValidRegisteredProduct(
  product: RegisteredProduct | null | undefined,
): product is RegisteredProduct {
  return Boolean(
    product &&
    product.id.trim() &&
    product.accession.trim() &&
    product.brand.trim() &&
    product.productName.trim() &&
    product.assignedJob === 'Reduce visible redness' &&
    product.protocolId === 'youcam-redness-v1' &&
    product.createdAt.trim(),
  );
}

export function isYouCamProtocolEligible(product: RegisteredProduct | null | undefined): boolean {
  return product?.protocolId === 'youcam-redness-v1';
}

export const emptyCaptureContext = (): CaptureContext => ({
  makeup: false,
  recentHeatOrExercise: false,
  recentCleansingOrSkincare: false,
  routineOrTreatmentChange: false,
  note: null,
});

export function normalizeCaptureContext(context: CaptureContext): CaptureContext {
  return {
    makeup: context.makeup === true,
    recentHeatOrExercise: context.recentHeatOrExercise === true,
    recentCleansingOrSkincare: context.recentCleansingOrSkincare === true,
    routineOrTreatmentChange: context.routineOrTreatmentChange === true,
    note: normalizedText(context.note, 240),
  };
}

export function hasMeaningfulCaptureContext(context: CaptureContext | null | undefined): boolean {
  return Boolean(
    context &&
    (context.makeup ||
      context.recentHeatOrExercise ||
      context.recentCleansingOrSkincare ||
      context.routineOrTreatmentChange ||
      context.note),
  );
}

const parsedTime = (value: string): number | null => {
  const milliseconds = new Date(value).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : null;
};

export function addCalendarDays(iso: string, days: number): string {
  const milliseconds = parsedTime(iso);
  if (milliseconds === null) throw new Error('A valid baseline timestamp is required.');
  const date = new Date(milliseconds);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function followUpIsEligible(input: {
  followUpEligibleAt: string | null;
  demoTimelineAdvanced: boolean;
  now: string;
}): boolean {
  if (input.demoTimelineAdvanced) return true;
  if (!input.followUpEligibleAt) return false;
  const eligibleAt = parsedTime(input.followUpEligibleAt);
  const now = parsedTime(input.now);
  return eligibleAt !== null && now !== null && now >= eligibleAt;
}

export function trialDaySummary(
  baselineLockedAt: string,
  followUpEligibleAt: string,
  now: string,
): { day: number; intervalDays: number; daysRemaining: number; eligible: boolean } {
  const baseline = parsedTime(baselineLockedAt);
  const eligibleAt = parsedTime(followUpEligibleAt);
  const current = parsedTime(now);
  if (baseline === null || eligibleAt === null || current === null) {
    throw new Error('Trial timing requires valid timestamps.');
  }

  const dayMs = 86_400_000;
  const elapsedDays = Math.max(0, Math.floor((current - baseline) / dayMs));
  const day = Math.min(FOLLOW_UP_INTERVAL_DAYS, elapsedDays + 1);
  const daysRemaining = Math.max(0, Math.ceil((eligibleAt - current) / dayMs));
  return {
    day,
    intervalDays: FOLLOW_UP_INTERVAL_DAYS,
    daysRemaining,
    eligible: current >= eligibleAt,
  };
}

export function defaultPlacementForResult(analysis: AnalysisResult): ProductPlacement {
  if (analysis.provider === 'youcam') return 'paused';
  return analysis.recommendedAction === 'keep' ? 'established' : 'paused';
}
