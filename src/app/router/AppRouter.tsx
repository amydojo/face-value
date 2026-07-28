import { HumanButterProductionJourney } from '../../features/HumanButterProductionJourney';
import { YouCamCalibration } from '../../features/youcam-calibration/YouCamCalibration';
import { YouCamSpike } from '../../features/youcam-spike/YouCamSpike';

export function AppRouter() {
  const pathname = globalThis.location?.pathname ?? '/';

  if (pathname === '/youcam-spike') return <YouCamSpike />;
  if (pathname === '/youcam-calibration') return <YouCamCalibration />;
  return <HumanButterProductionJourney />;
}
