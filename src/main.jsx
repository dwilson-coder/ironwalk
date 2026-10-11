import React from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted fonts (no network calls at runtime)
import '@fontsource/saira-condensed/500.css';
import '@fontsource/saira-condensed/700.css';
import '@fontsource/saira-condensed/800.css';
import '@fontsource/saira/400.css';
import '@fontsource/saira/500.css';
import '@fontsource/saira/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';

import './styles.css';
import App from './App.jsx';
import { migrateLegacyKeys } from './store/storage.js';

// Carry saves over from the game's previous name (ironwake.* → ironwalk.*) before anything reads them.
migrateLegacyKeys();

// StrictMode is intentionally off: it mounts effects twice in development,
// which would boot two WebGL engines on the same canvas.
createRoot(document.getElementById('root')).render(<App />);
