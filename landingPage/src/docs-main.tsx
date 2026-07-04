import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import DocsApp from './DocsApp';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DocsApp />
  </React.StrictMode>
);
