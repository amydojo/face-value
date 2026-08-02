export const REDNESS_CALIBRATION_QUANTILE_METHOD = 'R-7 linear interpolation' as const;
export const REDNESS_CALIBRATION_BOOTSTRAP_ALGORITHM =
  'participant-cluster-percentile-xorshift32-v1' as const;

export interface EstimatedValue {
  status: 'estimated';
  value: number;
}

export interface NotEstimableValue {
  status: 'not_estimable';
  reason: string;
}

export type EstimableValue = EstimatedValue | NotEstimableValue;

export interface EstimatedInterval {
  status: 'estimated';
  lower: number;
  upper: number;
  confidenceLevel: 0.95;
  method: string;
}

export interface NotEstimableInterval {
  status: 'not_estimable';
  reason: string;
}

export type EstimableInterval = EstimatedInterval | NotEstimableInterval;

const notEstimable = (reason: string): NotEstimableValue => ({
  status: 'not_estimable',
  reason,
});

export function empiricalQuantileR7(values: number[], probability: number): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0 || !Number.isFinite(probability) || probability < 0 || probability > 1) {
    return null;
  }
  if (finite.length === 1) return finite[0];
  const position = (finite.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return finite[lowerIndex];
  const fraction = position - lowerIndex;
  return finite[lowerIndex] + fraction * (finite[upperIndex] - finite[lowerIndex]);
}

export function medianR7(values: number[]): number | null {
  return empiricalQuantileR7(values, 0.5);
}

export function withinClusterResidualSd(clusters: number[][]): EstimableValue & {
  observationCount?: number;
  clusterCount?: number;
  residualDegreesOfFreedom?: number;
} {
  const eligible = clusters
    .map((cluster) => cluster.filter(Number.isFinite))
    .filter((cluster) => cluster.length > 0);
  const observationCount = eligible.reduce((total, cluster) => total + cluster.length, 0);
  const residualDegreesOfFreedom = observationCount - eligible.length;
  if (eligible.length === 0 || residualDegreesOfFreedom <= 0) {
    return {
      ...notEstimable('At least one repeated measurement beyond each participant mean is required.'),
      observationCount,
      clusterCount: eligible.length,
      residualDegreesOfFreedom,
    };
  }
  const residualSumOfSquares = eligible.reduce((total, cluster) => {
    const mean = cluster.reduce((sum, value) => sum + value, 0) / cluster.length;
    return total + cluster.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  }, 0);
  const value = Math.sqrt(residualSumOfSquares / residualDegreesOfFreedom);
  if (!Number.isFinite(value)) {
    return {
      ...notEstimable('The within-person residual variance was not finite.'),
      observationCount,
      clusterCount: eligible.length,
      residualDegreesOfFreedom,
    };
  }
  return {
    status: 'estimated',
    value,
    observationCount,
    clusterCount: eligible.length,
    residualDegreesOfFreedom,
  };
}

export function repeatabilityCoefficient(withinPersonSd: number): number | null {
  if (!Number.isFinite(withinPersonSd) || withinPersonSd < 0) return null;
  const value = 1.96 * Math.sqrt(2) * withinPersonSd;
  return Number.isFinite(value) ? value : null;
}

export interface IccA1Estimate {
  status: 'estimated';
  variant: 'ICC(A,1)';
  value: number;
  participantCount: number;
  repeatedObservationCount: number;
  totalObservationCount: number;
  method: 'two-way random-effects absolute agreement single measurement';
}

export interface IccNotEstimable {
  status: 'not_estimable';
  variant: 'ICC(A,1)';
  reason: string;
  participantCount: number;
  repeatedObservationCount: number | null;
  totalObservationCount: number;
  method: 'two-way random-effects absolute agreement single measurement';
}

export type IccEstimate = IccA1Estimate | IccNotEstimable;

/** ICC(A,1), also commonly named ICC(2,1), for a complete balanced matrix. */
export function iccAbsoluteAgreementSingle(matrix: number[][]): IccEstimate {
  const participantCount = matrix.length;
  const lengths = matrix.map((row) => row.length);
  const totalObservationCount = lengths.reduce((total, count) => total + count, 0);
  const repeatedObservationCount = lengths[0] ?? null;
  const failure = (reason: string): IccNotEstimable => ({
    status: 'not_estimable',
    variant: 'ICC(A,1)',
    reason,
    participantCount,
    repeatedObservationCount,
    totalObservationCount,
    method: 'two-way random-effects absolute agreement single measurement',
  });

  if (participantCount < 2) return failure('At least two participants are required.');
  if (
    repeatedObservationCount === null ||
    repeatedObservationCount < 2 ||
    lengths.some((length) => length !== repeatedObservationCount)
  ) {
    return failure('ICC(A,1) requires at least two balanced repeated observations per participant.');
  }
  if (matrix.some((row) => row.some((value) => !Number.isFinite(value)))) {
    return failure('ICC(A,1) cannot use missing or non-finite observations.');
  }

  const n = participantCount;
  const k = repeatedObservationCount;
  const grandMean = matrix.flat().reduce((sum, value) => sum + value, 0) / (n * k);
  const participantMeans = matrix.map(
    (row) => row.reduce((sum, value) => sum + value, 0) / k,
  );
  const occasionMeans = Array.from({ length: k }, (_, occasion) =>
    matrix.reduce((sum, row) => sum + row[occasion], 0) / n,
  );
  const participantSs = k * participantMeans.reduce(
    (sum, mean) => sum + (mean - grandMean) ** 2,
    0,
  );
  const occasionSs = n * occasionMeans.reduce(
    (sum, mean) => sum + (mean - grandMean) ** 2,
    0,
  );
  let residualSs = 0;
  for (const [participant, row] of matrix.entries()) {
    for (const [occasion, value] of row.entries()) {
      residualSs +=
        (value - participantMeans[participant] - occasionMeans[occasion] + grandMean) ** 2;
    }
  }
  const participantMs = participantSs / (n - 1);
  const occasionMs = occasionSs / (k - 1);
  const residualMs = residualSs / ((n - 1) * (k - 1));
  const denominator =
    participantMs + (k - 1) * residualMs + (k * (occasionMs - residualMs)) / n;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < Number.EPSILON) {
    return failure('ICC(A,1) denominator is zero or non-finite for this structure.');
  }
  const value = (participantMs - residualMs) / denominator;
  if (!Number.isFinite(value)) return failure('ICC(A,1) estimate was not finite.');
  return {
    status: 'estimated',
    variant: 'ICC(A,1)',
    value,
    participantCount: n,
    repeatedObservationCount: k,
    totalObservationCount,
    method: 'two-way random-effects absolute agreement single measurement',
  };
}

function xorshift32(seed: number): () => number {
  let state = seed | 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

export function participantClusterBootstrap(input: {
  clusters: number[][];
  statistic: (resampledClusters: number[][]) => number | null;
  seed: number;
  iterations: number;
}): EstimableInterval {
  const clusters = input.clusters
    .map((cluster) => cluster.filter(Number.isFinite))
    .filter((cluster) => cluster.length > 0);
  if (clusters.length < 2) {
    return {
      status: 'not_estimable',
      reason: 'At least two participant clusters are required for a cluster bootstrap interval.',
    };
  }
  if (!Number.isInteger(input.iterations) || input.iterations < 100) {
    return {
      status: 'not_estimable',
      reason: 'At least 100 deterministic bootstrap iterations are required.',
    };
  }
  const random = xorshift32(input.seed);
  const estimates: number[] = [];
  for (let iteration = 0; iteration < input.iterations; iteration += 1) {
    const sample = Array.from(
      { length: clusters.length },
      () => clusters[Math.floor(random() * clusters.length)],
    );
    const estimate = input.statistic(sample);
    if (estimate !== null && Number.isFinite(estimate)) estimates.push(estimate);
  }
  if (estimates.length < Math.ceil(input.iterations * 0.8)) {
    return {
      status: 'not_estimable',
      reason: 'Too few finite cluster bootstrap replicates were available.',
    };
  }
  const lower = empiricalQuantileR7(estimates, 0.025);
  const upper = empiricalQuantileR7(estimates, 0.975);
  if (lower === null || upper === null) {
    return { status: 'not_estimable', reason: 'Bootstrap percentile bounds were unavailable.' };
  }
  return {
    status: 'estimated',
    lower,
    upper,
    confidenceLevel: 0.95,
    method: `${REDNESS_CALIBRATION_BOOTSTRAP_ALGORITHM}; R-7 percentile bounds`,
  };
}

export function wilsonRateInterval(successes: number, total: number): EstimableInterval {
  if (
    !Number.isInteger(successes) ||
    !Number.isInteger(total) ||
    successes < 0 ||
    total <= 0 ||
    successes > total
  ) {
    return { status: 'not_estimable', reason: 'A positive valid binomial denominator is required.' };
  }
  const z = 1.959963984540054;
  const proportion = successes / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((proportion * (1 - proportion) + z ** 2 / (4 * total)) / total)) /
    denominator;
  return {
    status: 'estimated',
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    confidenceLevel: 0.95,
    method: 'Wilson score interval',
  };
}
