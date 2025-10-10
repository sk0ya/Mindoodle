import { createRoot } from 'react-dom/client';

import './shared/monaco/setupWorkers';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
createRoot(rootElement).render(<App />);
