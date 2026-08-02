export interface ProductionRegistryLoadResult {
  status: 'ignored' | 'rejected';
  reason: 'exploratory_not_approved' | 'unsupported_registry';
  configuration: null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Issue 65 has no graduation path. Production deliberately cannot construct a
 * threshold configuration from this exploratory registry schema.
 */
export function loadRednessCalibrationRegistryForProduction(
  value: unknown,
): ProductionRegistryLoadResult {
  if (
    isObject(value) &&
    value.threshold_source === 'technical_calibration' &&
    value.status === 'exploratory' &&
    value.approved_by === null
  ) {
    return {
      status: 'ignored',
      reason: 'exploratory_not_approved',
      configuration: null,
    };
  }
  return { status: 'rejected', reason: 'unsupported_registry', configuration: null };
}
