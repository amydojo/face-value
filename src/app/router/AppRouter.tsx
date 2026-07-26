import { Route, Routes } from 'react-router-dom';
import { CanonicalFaceValueApplication } from '../../features/canonical/CanonicalFaceValueApplication';

export function AppRouter() {
  return (
    <Routes>
      <Route path="*" element={<CanonicalFaceValueApplication />} />
    </Routes>
  );
}
