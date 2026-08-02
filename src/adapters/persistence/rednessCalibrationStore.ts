import {
  canonicalJson,
  migrateRednessCalibrationObservation,
  rednessCalibrationUtf8Bytes,
  REDNESS_CALIBRATION_MAX_FIELD_BYTES,
  type RednessCalibrationObservation,
  type RednessCalibrationValidationIssue,
} from '../../domain/calibration/redness';

export const REDNESS_CALIBRATION_STORAGE_KEY = 'face-value:calibration:redness:v1';
export const REDNESS_CALIBRATION_ENVELOPE_SCHEMA =
  'face-value-redness-calibration-envelope-v1' as const;
export const REDNESS_CALIBRATION_EXPORT_SCHEMA =
  'face-value-redness-calibration-export-v1' as const;
export const REDNESS_CALIBRATION_ORIGIN = 'face-value-redness-calibration' as const;
export const REDNESS_CALIBRATION_MAX_OBSERVATIONS = 240 as const;
export const REDNESS_CALIBRATION_MAX_SERIALIZED_BYTES = 512 * 1024;

export interface RednessCalibrationEnvelope {
  schemaVersion: typeof REDNESS_CALIBRATION_ENVELOPE_SCHEMA;
  origin: typeof REDNESS_CALIBRATION_ORIGIN;
  savedAt: string;
  observations: RednessCalibrationObservation[];
}

export interface RednessCalibrationExportEnvelope {
  schemaVersion: typeof REDNESS_CALIBRATION_EXPORT_SCHEMA;
  origin: typeof REDNESS_CALIBRATION_ORIGIN;
  exportedAt: string;
  observations: RednessCalibrationObservation[];
}

export interface RednessCalibrationQuarantineEntry {
  index: number | null;
  observationId: string | null;
  issues: RednessCalibrationValidationIssue[];
}

export type RednessCalibrationHydration =
  | { status: 'empty'; envelope: null; quarantine: [] }
  | { status: 'ready'; envelope: RednessCalibrationEnvelope; quarantine: [] }
  | {
      status: 'corrupt';
      envelope: null;
      quarantine: RednessCalibrationQuarantineEntry[];
    };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const expectedKeys = new Set(expected);
  return (
    Object.keys(value).length === expected.length &&
    Object.keys(value).every((key) => expectedKeys.has(key))
  );
};

const cloneEnvelope = (envelope: RednessCalibrationEnvelope): RednessCalibrationEnvelope =>
  structuredClone(envelope);

const safeObservationId = (value: unknown): string | null => {
  if (!isObject(value) || typeof value.observationId !== 'string') return null;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.observationId)
    ? value.observationId
    : null;
};

const envelopeIssue = (
  code: RednessCalibrationValidationIssue['code'],
  detail: string,
): RednessCalibrationQuarantineEntry => ({
  index: null,
  observationId: null,
  issues: [{ code, path: '$', detail }],
});

function validateObservationList(
  observations: unknown[],
):
  | { valid: true; observations: RednessCalibrationObservation[] }
  | { valid: false; quarantine: RednessCalibrationQuarantineEntry[] } {
  if (observations.length > REDNESS_CALIBRATION_MAX_OBSERVATIONS) {
    return {
      valid: false,
      quarantine: [
        envelopeIssue(
          'invalid_observation',
          `Calibration storage exceeds the ${REDNESS_CALIBRATION_MAX_OBSERVATIONS}-observation bound.`,
        ),
      ],
    };
  }

  const accepted: RednessCalibrationObservation[] = [];
  const quarantine: RednessCalibrationQuarantineEntry[] = [];
  const observationIds = new Set<string>();
  for (const [index, value] of observations.entries()) {
    const result = migrateRednessCalibrationObservation(value);
    if (!result.valid) {
      quarantine.push({ index, observationId: safeObservationId(value), issues: result.issues });
      continue;
    }
    if (observationIds.has(result.observation.observationId)) {
      quarantine.push({
        index,
        observationId: result.observation.observationId,
        issues: [
          {
            code: 'invalid_identifier',
            path: `$.observations[${index}].observationId`,
            detail: 'Observation IDs are immutable and cannot be duplicated.',
          },
        ],
      });
      continue;
    }
    observationIds.add(result.observation.observationId);
    accepted.push(result.observation);
  }
  return quarantine.length > 0
    ? { valid: false, quarantine }
    : { valid: true, observations: accepted };
}

function parseEnvelope(raw: string): RednessCalibrationHydration {
  if (rednessCalibrationUtf8Bytes(raw) > REDNESS_CALIBRATION_MAX_SERIALIZED_BYTES) {
    return {
      status: 'corrupt',
      envelope: null,
      quarantine: [
        envelopeIssue(
          'oversized_observation',
          `Stored calibration data exceeds the ${REDNESS_CALIBRATION_MAX_SERIALIZED_BYTES}-byte bound.`,
        ),
      ],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: 'corrupt',
      envelope: null,
      quarantine: [envelopeIssue('invalid_observation', 'Stored calibration JSON is corrupt.')],
    };
  }
  if (
    !isObject(parsed) ||
    !hasExactKeys(parsed, ['schemaVersion', 'origin', 'savedAt', 'observations']) ||
    parsed.schemaVersion !== REDNESS_CALIBRATION_ENVELOPE_SCHEMA ||
    parsed.origin !== REDNESS_CALIBRATION_ORIGIN ||
    typeof parsed.savedAt !== 'string' ||
    rednessCalibrationUtf8Bytes(parsed.savedAt) > REDNESS_CALIBRATION_MAX_FIELD_BYTES ||
    !Number.isFinite(Date.parse(parsed.savedAt)) ||
    !Array.isArray(parsed.observations)
  ) {
    return {
      status: 'corrupt',
      envelope: null,
      quarantine: [
        envelopeIssue(
          parsed && isObject(parsed) && parsed.schemaVersion !== REDNESS_CALIBRATION_ENVELOPE_SCHEMA
            ? 'unsupported_schema_version'
            : 'invalid_observation',
          'Stored calibration envelope is incompatible or incomplete.',
        ),
      ],
    };
  }
  const validated = validateObservationList(parsed.observations);
  if (!validated.valid) {
    return { status: 'corrupt', envelope: null, quarantine: validated.quarantine };
  }
  return {
    status: 'ready',
    envelope: {
      schemaVersion: REDNESS_CALIBRATION_ENVELOPE_SCHEMA,
      origin: REDNESS_CALIBRATION_ORIGIN,
      savedAt: parsed.savedAt,
      observations: validated.observations,
    },
    quarantine: [],
  };
}

export function loadRednessCalibrationData(
  storage: Storage = localStorage,
): RednessCalibrationHydration {
  const raw = storage.getItem(REDNESS_CALIBRATION_STORAGE_KEY);
  return raw === null ? { status: 'empty', envelope: null, quarantine: [] } : parseEnvelope(raw);
}

export function saveRednessCalibrationData(
  observations: RednessCalibrationObservation[],
  storage: Storage = localStorage,
  savedAt = new Date().toISOString(),
): RednessCalibrationEnvelope {
  const validated = validateObservationList(observations);
  if (!validated.valid) {
    throw new Error('Calibration observations failed closed validation.');
  }
  if (
    !Number.isFinite(Date.parse(savedAt)) ||
    rednessCalibrationUtf8Bytes(savedAt) > REDNESS_CALIBRATION_MAX_FIELD_BYTES
  ) {
    throw new Error('Calibration storage requires an explicit valid timestamp.');
  }
  const envelope: RednessCalibrationEnvelope = {
    schemaVersion: REDNESS_CALIBRATION_ENVELOPE_SCHEMA,
    origin: REDNESS_CALIBRATION_ORIGIN,
    savedAt,
    observations: validated.observations,
  };
  const serialized = canonicalJson(envelope);
  if (rednessCalibrationUtf8Bytes(serialized) > REDNESS_CALIBRATION_MAX_SERIALIZED_BYTES) {
    throw new Error('Calibration storage exceeds its serialized byte bound. Nothing was written.');
  }
  storage.setItem(REDNESS_CALIBRATION_STORAGE_KEY, serialized);
  return cloneEnvelope(envelope);
}

export function appendRednessCalibrationObservation(
  observation: RednessCalibrationObservation,
  storage: Storage = localStorage,
  savedAt = new Date().toISOString(),
): RednessCalibrationEnvelope {
  const hydration = loadRednessCalibrationData(storage);
  if (hydration.status === 'corrupt') {
    throw new Error('Corrupt calibration storage must be cleared or inspected before appending.');
  }
  const existing = hydration.envelope?.observations ?? [];
  if (existing.some((item) => item.observationId === observation.observationId)) {
    throw new Error('Calibration observations are immutable; duplicate IDs cannot replace data.');
  }
  return saveRednessCalibrationData([...existing, observation], storage, savedAt);
}

export function clearRednessCalibrationData(storage: Storage = localStorage): void {
  storage.removeItem(REDNESS_CALIBRATION_STORAGE_KEY);
}

export function exportRednessCalibrationData(
  observations: RednessCalibrationObservation[],
  exportedAt: string,
): string {
  const validated = validateObservationList(observations);
  if (
    !validated.valid ||
    !Number.isFinite(Date.parse(exportedAt)) ||
    rednessCalibrationUtf8Bytes(exportedAt) > REDNESS_CALIBRATION_MAX_FIELD_BYTES
  ) {
    throw new Error('Only valid face-free calibration observations can be exported.');
  }
  const envelope: RednessCalibrationExportEnvelope = {
    schemaVersion: REDNESS_CALIBRATION_EXPORT_SCHEMA,
    origin: REDNESS_CALIBRATION_ORIGIN,
    exportedAt,
    observations: validated.observations,
  };
  const serialized = canonicalJson(envelope);
  if (rednessCalibrationUtf8Bytes(serialized) > REDNESS_CALIBRATION_MAX_SERIALIZED_BYTES) {
    throw new Error('Calibration export exceeds its serialized byte bound.');
  }
  return serialized;
}

export function parseRednessCalibrationExport(raw: string): RednessCalibrationObservation[] {
  if (rednessCalibrationUtf8Bytes(raw) > REDNESS_CALIBRATION_MAX_SERIALIZED_BYTES) {
    throw new Error('Calibration import exceeds its serialized byte bound.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Calibration import is not valid JSON.');
  }
  if (
    !isObject(parsed) ||
    !hasExactKeys(parsed, ['schemaVersion', 'origin', 'exportedAt', 'observations']) ||
    parsed.schemaVersion !== REDNESS_CALIBRATION_EXPORT_SCHEMA ||
    parsed.origin !== REDNESS_CALIBRATION_ORIGIN ||
    typeof parsed.exportedAt !== 'string' ||
    rednessCalibrationUtf8Bytes(parsed.exportedAt) > REDNESS_CALIBRATION_MAX_FIELD_BYTES ||
    !Number.isFinite(Date.parse(parsed.exportedAt)) ||
    !Array.isArray(parsed.observations)
  ) {
    throw new Error('Calibration import envelope is incompatible.');
  }
  const imported = validateObservationList(parsed.observations);
  if (!imported.valid) {
    throw new Error('Calibration import contains invalid or private material.');
  }
  const provenanceBounded = imported.observations.map((observation) => ({
    ...observation,
    collectionSource: 'imported_unverified' as const,
  }));
  const validated = validateObservationList(provenanceBounded);
  if (!validated.valid) {
    throw new Error('Calibration import contains invalid or private material.');
  }
  return structuredClone(validated.observations);
}
