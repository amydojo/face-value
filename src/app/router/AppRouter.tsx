import { Route, Routes } from 'react-router-dom';
import { FaceValueApplication } from '../../features/FaceValueApplication';

export function AppRouter() {
  return (
    <Routes>
      <Route path="*" element={<FaceValueApplication />} />
    </Routes>
  );
}
