import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import AppProviders from '@/app/providers/AppProviders';

import './App.css';

// src/main.jsx
ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  // </React.StrictMode>
);

