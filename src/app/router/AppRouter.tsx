import { Route, Routes } from 'react-router-dom';
import { HumanButterProductionJourney } from '../../features/HumanButterProductionJourney';
import { EvidenceMachineDemo } from '../../features/evidence-machine/EvidenceMachineDemo';
import { YouCamCalibration } from '../../features/youcam-calibration/YouCamCalibration';
import { YouCamSpike } from '../../features/youcam-spike/YouCamSpike';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/evidence-machine" element={<EvidenceMachineDemo />} />
      <Route path="/youcam-spike" element={<YouCamSpike />} />
      <Route path="/youcam-calibration" element={<YouCamCalibration />} />
      <Route path="*" element={<HumanButterProductionJourney />} />
    </Routes>
  );
}
