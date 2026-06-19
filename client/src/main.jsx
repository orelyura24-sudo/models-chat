import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { registerChartElements } from "./adaptiveCharts.js";
import "./App.css";

// Register our custom Chart.* Adaptive Card elements once, before any card renders.
registerChartElements();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
