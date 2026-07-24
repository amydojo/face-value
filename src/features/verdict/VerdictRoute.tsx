import { useNavigate } from 'react-router-dom';
import { CabinetShell } from '../../components/hardware';
import type { AnalysisResult, Specimen } from '../../domain/model';
import { EvidenceVerdict } from '../evidence-cassette/EvidenceVerdict';

const specimen: Specimen = {
  id: 'barrier-water-serum',
  accession: 'A1–01',
  brand: 'FACE VALUE',
  product: 'BARRIER WATER SERUM',
  volume: '30 ML',
  shelf: 'observation',
  jobOptions: ['Hydration'],
};

const result: AnalysisResult = {
  captureQuality: 'accepted',
  comparison: 'comparable',
  visibleSignal: 'Barrier hydration signal retained across repeat scans.',
  confidence: 'likely',
  finding: 'Hydration appears meaningfully improved under comparable conditions.',
  nonFinding: 'No reliable change in texture or radiance was isolated.',
  relevantContext: 'Repeat scans retained the same product, job, and comparable capture conditions.',
  recommendedAction: 'keep',
  claimBoundary: 'This is longitudinal visual evidence, not a diagnosis or a clinical efficacy claim.',
  simulated: true,
};

export function VerdictRoute() {
  const navigate = useNavigate();

  return (
    <CabinetShell tone="dark" label="Face Value verdict">
      <EvidenceVerdict
        specimen={specimen}
        job="HYDRATION"
        result={result}
        confidence="likely"
        lowerConfidence={false}
        onContinue={() => navigate('/')}
        onBack={() => navigate('/')}
      />
    </CabinetShell>
  );
}
