import { lazy, Suspense } from 'react';
import { HumanButterProductionJourney } from '../../features/HumanButterProductionJourney';
import { RednessCalibration } from '../../features/calibration-redness/RednessCalibration';
import { DemoLab } from '../../features/demo-lab/DemoLab';
import { DEMO_LAB_ENABLED } from '../../features/demo-lab/demoLabAccess';
import { YouCamCalibration } from '../../features/youcam-calibration/YouCamCalibration';
import { LOCAL_OPTICS_ENABLED, TRIAL_PATHS } from '../../features/local-optics/localOpticsAccess';
import { YouCamSpike } from '../../features/youcam-spike/YouCamSpike';

// Experimental and isolated: a separate chunk, and absent from builds that do not opt in.
const LocalOptics = LOCAL_OPTICS_ENABLED
  ? lazy(() => import('../../features/local-optics/LocalOptics').then((module) => ({ default: module.LocalOptics })))
  : null;
const LivingTrial = LOCAL_OPTICS_ENABLED
  ? lazy(() => import('../../features/local-optics/LivingTrial').then((module) => ({ default: module.LivingTrial })))
  : null;

export function AppRouter() {
  const pathname = globalThis.location?.pathname ?? '/';

  if (
    DEMO_LAB_ENABLED
    && (pathname === '/calibration/redness' || pathname === '/calibration/redness/')
  ) return <RednessCalibration />;
  if (DEMO_LAB_ENABLED && pathname === '/demo') return <DemoLab />;
  if (pathname === '/youcam-spike') return <YouCamSpike />;
  if (pathname === '/youcam-calibration') return <YouCamCalibration />;
  if (LocalOptics && pathname === '/experiments/local-optics') {
    return (
      <Suspense fallback={null}>
        <LocalOptics />
      </Suspense>
    );
  }
  if (LivingTrial && TRIAL_PATHS.includes(pathname)) {
    return (
      <Suspense fallback={null}>
        <LivingTrial />
      </Suspense>
    );
  }
  return <HumanButterProductionJourney />;
}
