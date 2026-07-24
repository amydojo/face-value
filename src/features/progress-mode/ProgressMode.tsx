import type { AnalysisResult, EvidenceConfidence, Specimen } from '../../domain/model';
import { EvidenceVerdict } from '../evidence-cassette/EvidenceVerdict';

export function ProgressMode({
  specimen,
  job,
  result,
  confidence,
  lowerConfidence,
  onContinue,
  onBack,
}: {
  specimen: Specimen;
  job: string | null;
  result: AnalysisResult;
  confidence: EvidenceConfidence;
  lowerConfidence: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <EvidenceVerdict
      specimen={specimen}
      job={job}
      result={result}
      confidence={confidence}
      lowerConfidence={lowerConfidence}
      onContinue={onContinue}
      onBack={onBack}
    />
  );
}
