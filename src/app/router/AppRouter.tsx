import { Route, Routes } from 'react-router-dom';
import { FaceValueApplication } from '../../features/FaceValueApplication';
import { VerdictRoute } from '../../features/verdict/VerdictRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/verdict" element={<VerdictRoute />} />
      <Route path="*" element={<FaceValueApplication />} />
    </Routes>
  );
}
