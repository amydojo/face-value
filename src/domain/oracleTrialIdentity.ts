import type { EvidenceRecordData } from './model';
import { FOLLOW_UP_INTERVAL_DAYS } from './phaseB5';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type OracleTrialIdentity = {
  number: string;
  folio: string;
  firmware: string;
};

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const milliseconds = new Date(value).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function intervalDays(
  baselineAt: string | null | undefined,
  followUpAt: string | null | undefined,
): number | null {
  const baseline = parseTime(baselineAt);
  const followUp = parseTime(followUpAt);
  if (baseline === null || followUp === null || followUp <= baseline) {
    return null;
  }

  const days = Math.round((followUp - baseline) / MILLISECONDS_PER_DAY);
  return days > 0 && days < 1_000 ? days : null;
}

function accessionNumber(accession: string | null | undefined): number | null {
  const digits = accession?.match(/\d+/g)?.join('');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1_000 ? parsed : null;
}

/**
 * Oracle presentation identity is the authoritative trial interval, not a
 * machine-local counter. The registered specimen accession is a legacy
 * fallback only when restored data predates interval metadata.
 */
export function oracleTrialIdentity(input: {
  baselineAt?: string | null;
  followUpAt?: string | null;
  accession?: string | null;
}): OracleTrialIdentity {
  const value =
    intervalDays(input.baselineAt, input.followUpAt) ??
    accessionNumber(input.accession) ??
    FOLLOW_UP_INTERVAL_DAYS;
  const number = String(value).padStart(3, '0');

  return {
    number,
    folio: `FV–${number}`,
    firmware: `TRIAL ${number}`,
  };
}

export function oracleTrialIdentityForRecord(record: EvidenceRecordData): OracleTrialIdentity {
  const [baselineAt, followUpAt] = record.observationWindow.split(' to ');
  return oracleTrialIdentity({
    baselineAt,
    followUpAt,
    accession: record.accession,
  });
}
