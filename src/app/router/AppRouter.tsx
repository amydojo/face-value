import { Route, Routes } from 'react-router-dom';
import { FaceValueApplication } from '../../features/FaceValueApplication';
import { EvidenceMachineDemo } from '../../features/evidence-machine/EvidenceMachineDemo';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/evidence-machine" element={<EvidenceMachineDemo />} />
      <Route path="*" element={<FaceValueApplication />} />
    </Routes>
  );
}
