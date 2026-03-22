import useTelemetry from "../context/useTelemetry";
import "./sidebar.css";

const NAV = [
  { id: "dashboard", label: "Overview", icon: "◈" },
  { id: "traces", label: "Traces", icon: "◌" },
  { id: "performance", label: "Performance", icon: "△" },
  { id: "logs", label: "Logs", icon: "≡" },
  { id: "alerts", label: "Alerts", icon: "⚡" },
  { id: "security", label: "Security", icon: "⬡" },
  { id: "settings", label: "Settings", icon: "◎" },
];

export default function Sidebar({ page, setPage, open, setOpen }) {
  const { alerts, metrics } = useTelemetry();
  const unacked = alerts.filter(a => !a.ack).length;
  const health = metrics.cpu < 80 && metrics.errorRate < 3 && metrics.latency < 300;

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <div className="sidebar-top">
        <div className="brand" onClick={() => setOpen(o => !o)}>
          <div className="brand-icon">T</div>
          {open && <div className="brand-name"><span>TELE</span><span className="brand-accent">METRICS</span></div>}
        </div>
        <div className="health-row">
          <div className={`health-dot ${health ? "green" : "red"} pulse`} />
          {open && <span className="health-label">{health ? "All systems nominal" : "Degraded"}</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
            title={!open ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {open && <span className="nav-label">{item.label}</span>}
            {item.id === "alerts" && unacked > 0 && (
              <span className="nav-badge">{unacked > 9 ? "9+" : unacked}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {open && (
          <div className="sidebar-stat">
            <span className="stat-key">uptime</span>
            <span className="stat-val green">{metrics.uptime}%</span>
          </div>
        )}
        {open && (
          <div className="sidebar-stat">
            <span className="stat-key">rps</span>
            <span className="stat-val">{metrics.rps}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
