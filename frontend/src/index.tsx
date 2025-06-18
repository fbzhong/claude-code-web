import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Note: StrictMode causes double rendering in development
// which can lead to duplicate WebSocket connections
// Uncomment for production builds
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);