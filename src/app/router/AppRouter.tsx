import { Route, Routes } from 'react-router-dom';
import { HumanButterProductionJourney } from '../../features/HumanButterProductionJourney';
import { EvidenceMachineDemo } from '../../features/evidence-machine/EvidenceMachineDemo';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/evidence-machine" element={<EvidenceMachineDemo />} />
      <Route path="*" element={<HumanButterProductionJourney />} />
    </Routes>
  );
}
