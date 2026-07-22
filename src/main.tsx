import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FaceValueProvider } from './app/FaceValueProvider';
import { AppRouter } from './app/router/AppRouter';
import './styles/foundations.css';
import './styles/motion.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FaceValueProvider>
        <AppRouter />
      </FaceValueProvider>
    </BrowserRouter>
  </StrictMode>,
);
