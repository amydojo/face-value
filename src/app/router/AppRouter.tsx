import { Route, Routes } from 'react-router-dom';
import { HumanButterProductionJourney } from '../../features/HumanButterProductionJourney';
import { EvidenceMachineDemo } from '../../features/evidence-machine/EvidenceMachineDemo';
import { YouCamSpike } from '../../features/youcam-spike/YouCamSpike';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/evidence-machine" element={<EvidenceMachineDemo />} />
      <Route path="/youcam-spike" element={<YouCamSpike />} />
      <Route path="*" element={<HumanButterProductionJourney />} />
    </Routes>
  );
}
