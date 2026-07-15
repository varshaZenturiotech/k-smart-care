import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/global.css";
import "./i18n.js";
import { QueryProvider } from "./app/QueryProvider.jsx";
import { LanguageRefreshProvider } from "./providers/LanguageRefreshProvider.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryProvider>
      <LanguageRefreshProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LanguageRefreshProvider>
    </QueryProvider>
  </React.StrictMode>
);