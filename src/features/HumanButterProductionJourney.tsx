import { useFaceValue } from '../app/faceValueContext';
import { FaceValueApplication } from './FaceValueApplication';
import { HumanButterEvidenceMachineScreen } from './evidence-machine/HumanButterEvidenceMachineScreen';

export function HumanButterProductionJourney() {
  const { state } = useFaceValue();

  if (state.stage === 'placement' || state.stage === 'record') {
    return <HumanButterEvidenceMachineScreen />;
  }

  return <FaceValueApplication />;
}
