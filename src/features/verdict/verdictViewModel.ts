import type {
  AnalysisResult,
  EvidenceConfidence,
  EvidenceRecordData,
  ProductPlacement,
} from '../../domain/model';
import { oracleTrialIdentityForRecord } from '../../domain/oracleTrialIdentity';
import { oracleNextStep } from '../oracle-reveal/oraclePresentation';

export interface VerdictViewModel {
  trialId: string;
  productName: string;
  productBrand?: string;
  verdictCode: string;
  headline: string;
  explanation: string;
  confidence: string;
  nextStepLabel: string;
  evaluatedAt?: string;
}

const presentationCode = (value: string) => value.replaceAll('_', ' ').toUpperCase();

export function verdictViewModelFromRecord(record: EvidenceRecordData): VerdictViewModel {
  return {
    trialId: oracleTrialIdentityForRecord(record).folio,
    productName: record.product,
    productBrand: record.productBrand,
    verdictCode: presentationCode(record.comparison),
    headline: record.finding,
    explanation: record.nonFinding,
    confidence: presentationCode(record.confidence),
    nextStepLabel: oracleNextStep(record.finalPlacement),
    evaluatedAt: record.createdAt,
  };
}

export function verdictViewModelFromAnalysis(input: {
  trialId: string;
  productName: string;
  productBrand?: string;
  analysis: AnalysisResult;
  confidence: EvidenceConfidence;
  placement: ProductPlacement;
  evaluatedAt?: string | null;
}): VerdictViewModel {
  return {
    trialId: input.trialId,
    productName: input.productName,
    productBrand: input.productBrand,
    verdictCode: presentationCode(input.analysis.comparison),
    headline: input.analysis.finding,
    explanation: input.analysis.nonFinding,
    confidence: presentationCode(input.confidence),
    nextStepLabel: oracleNextStep(input.placement),
    evaluatedAt: input.evaluatedAt ?? undefined,
  };
}

export function verdictProduct(viewModel: VerdictViewModel): string {
  return viewModel.productBrand
    ? `${viewModel.productBrand} · ${viewModel.productName}`
    : viewModel.productName;
}
