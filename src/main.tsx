import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FaceValueProvider } from './app/FaceValueProvider';
import { StageFocusManager } from './app/StageFocusManager';
import { AppRouter } from './app/router/AppRouter';
import { isStandaloneExperimentPath } from './features/local-optics/localOpticsAccess';
import './styles/foundations.css';
import './styles/hidden-contract.css';
import './styles/oracle-specimen-choreography.css';
import './styles/submission-continuity.css';
import './styles/submission-continuity-compat.css';
import './styles/submission-physical-qa.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStandaloneExperimentPath(globalThis.location?.pathname ?? '/') ? (
      // Experiment-only (never true in production builds): the Living Trial and the optics lab
      // must open even when browser storage is blocked, so they skip the production provider.
      <AppRouter />
    ) : (
      <FaceValueProvider>
        <StageFocusManager />
        <AppRouter />
      </FaceValueProvider>
    )}
  </StrictMode>,
);
