import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito/index.css';
import '@fontsource/young-serif/latin-400.css';
import '@fontsource/pixelify-sans/latin-400.css';
import './styles/global.css';
import App from './App';

try {
  const theme = localStorage.getItem('valley-almanac:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  /* storage unavailable */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
