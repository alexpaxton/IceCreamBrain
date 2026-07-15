import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GlobalStyle } from './styles/global';
import { SelectionProvider } from './lib/SelectionContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalStyle />
    <SelectionProvider>
      <App />
    </SelectionProvider>
  </StrictMode>,
);
