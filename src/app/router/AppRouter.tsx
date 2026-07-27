import { HumanButterProductionJourney } from '../../features/HumanButterProductionJourney';
import { EvidenceMachineDemo } from '../../features/evidence-machine/EvidenceMachineDemo';
import { YouCamCalibration } from '../../features/youcam-calibration/YouCamCalibration';
import { YouCamSpike } from '../../features/youcam-spike/YouCamSpike';

export function AppRouter() {
  const pathname = globalThis.location?.pathname ?? '/';

  if (pathname === '/evidence-machine') return <EvidenceMachineDemo />;
  if (pathname === '/youcam-spike') return <YouCamSpike />;
  if (pathname === '/youcam-calibration') return <YouCamCalibration />;
  return <HumanButterProductionJourney />;
}
