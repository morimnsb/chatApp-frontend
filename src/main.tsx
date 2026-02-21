// chatApp-frontend\src\main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import AppProviders from "@/app/providers/AppProviders";

import "./App.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element with id 'root' not found");
}

ReactDOM.createRoot(container).render(
  <AppProviders>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppProviders>
);