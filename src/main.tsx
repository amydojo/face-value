import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FaceValueProvider } from './app/FaceValueProvider';
import { StageFocusManager } from './app/StageFocusManager';
import { AppRouter } from './app/router/AppRouter';
import './styles/foundations.css';
import './styles/hidden-contract.css';
import './styles/oracle-specimen-choreography.css';
import './styles/submission-continuity.css';
import './styles/submission-continuity-compat.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FaceValueProvider>
      <StageFocusManager />
      <AppRouter />
    </FaceValueProvider>
  </StrictMode>,
);
