import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FaceValueProvider } from './app/FaceValueProvider';
import { StageFocusManager } from './app/StageFocusManager';
import { AppRouter } from './app/router/AppRouter';
import './styles/foundations.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FaceValueProvider>
        <StageFocusManager />
        <AppRouter />
      </FaceValueProvider>
    </BrowserRouter>
  </StrictMode>,
);
