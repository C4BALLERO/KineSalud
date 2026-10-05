import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { installIconMotion } from './lib/iconMotion';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root');

installIconMotion();

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
