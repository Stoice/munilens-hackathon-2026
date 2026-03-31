import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Ion } from 'cesium';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext.tsx';
import './index.css';

Ion.defaultAccessToken = process.env.CESIUM_ION_TOKEN ?? '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
