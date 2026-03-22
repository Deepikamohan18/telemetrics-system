import { useState } from "react";
import Dashboard from "./components/Dashboard";
import Alerts from "./components/Alerts";
import Security from "./components/security";
import Settings from "./components/Settings";
import Traces from "./components/Traces";
import Performance from "./components/Performance";
import Logs from "./components/Logs";
import Sidebar from "./components/Sidebar";
import TelemetryProvider from "./context/TelemetryProvider";
import "./styles/global.css";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const pages = {
    dashboard: <Dashboard />,
    traces: <Traces />,
    performance: <Performance />,
    logs: <Logs />,
    alerts: <Alerts />,
    security: <Security />,
    settings: <Settings />,
  };

  return (
    <TelemetryProvider>
      <div className="app-shell">
        <Sidebar page={page} setPage={setPage} open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className={`main-content ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
          {pages[page]}
        </main>
      </div>
    </TelemetryProvider>
  );
}
