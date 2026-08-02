import { HumanButterProductionJourney } from '../../features/HumanButterProductionJourney';
import { RednessCalibration } from '../../features/calibration-redness/RednessCalibration';
import { DemoLab } from '../../features/demo-lab/DemoLab';
import { DEMO_LAB_ENABLED } from '../../features/demo-lab/demoLabAccess';
import { YouCamCalibration } from '../../features/youcam-calibration/YouCamCalibration';
import { YouCamSpike } from '../../features/youcam-spike/YouCamSpike';

export function AppRouter() {
  const pathname = globalThis.location?.pathname ?? '/';

  if (
    DEMO_LAB_ENABLED
    && (pathname === '/calibration/redness' || pathname === '/calibration/redness/')
  ) return <RednessCalibration />;
  if (DEMO_LAB_ENABLED && pathname === '/demo') return <DemoLab />;
  if (pathname === '/youcam-spike') return <YouCamSpike />;
  if (pathname === '/youcam-calibration') return <YouCamCalibration />;
  return <HumanButterProductionJourney />;
}
