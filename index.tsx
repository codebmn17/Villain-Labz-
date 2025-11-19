import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Service Worker registration has been disabled to prevent "origin does not match" errors 
// in preview/sandbox environments. Persistence is handled via IndexedDB.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);