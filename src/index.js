import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Global error handler to catch crashes that happen before React mounts
window.onerror = function(msg, url, line, col, error) {
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;font-family:monospace">' +
    '<h1 style="color:red">Runtime Error</h1>' +
    '<pre style="background:#fef2f2;padding:20px;border-radius:8px;white-space:pre-wrap">' +
    msg + '\n\nFile: ' + url + '\nLine: ' + line + '\n\n' + (error && error.stack ? error.stack : '') +
    '</pre></div>';
};

window.onunhandledrejection = function(event) {
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;font-family:monospace">' +
    '<h1 style="color:red">Unhandled Promise Error</h1>' +
    '<pre style="background:#fef2f2;padding:20px;border-radius:8px;white-space:pre-wrap">' +
    (event.reason ? event.reason.toString() + '\n\n' + (event.reason.stack || '') : 'Unknown error') +
    '</pre></div>';
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
