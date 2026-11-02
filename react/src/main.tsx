import { registerLicense } from '@syncfusion/ej2-base';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import './theme/tokens.css';

const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY;
if (licenseKey) registerLicense(licenseKey);

function Boot() {
  const { ready } = useTheme();
  useEffect(() => {
    if (ready) document.getElementById('app-boot')?.remove();
  }, [ready]);
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider>
      <Boot />
    </ThemeProvider>
  </React.StrictMode>,
);