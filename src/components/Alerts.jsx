import useTelemetry from "../context/useTelemetry";

const SEV_COLOR = { critical: "var(--red)", warning: "var(--amber)", info: "var(--blue)" };
const SEV_BG = { critical: "var(--red-dim)", warning: "var(--amber-dim)", info: "var(--blue-dim)" };

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function AlertRow({ alert, onAck, onDismiss }) {
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "14px 16px",
      borderBottom: "1px solid var(--border)",
      background: alert.ack ? "transparent" : SEV_BG[alert.severity],
      opacity: alert.ack ? 0.5 : 1,
      transition: "all 0.2s",
      alignItems: "flex-start",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: SEV_COLOR[alert.severity], marginTop: 5, flexShrink: 0, boxShadow: alert.ack ? "none" : `0 0 6px ${SEV_COLOR[alert.severity]}` }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{alert.title}</span>
          <span className={`badge ${alert.severity === "critical" ? "red" : alert.severity === "warning" ? "amber" : "blue"}`}>
            {alert.severity.toUpperCase()}
          </span>
          {alert.ack && <span className="badge green">ACK</span>}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{alert.message}</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{timeAgo(alert.ts)}</span>
        {!alert.ack && <button className="btn" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => onAck(alert.id)}>ACK</button>}
        <button className="btn danger" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => onDismiss(alert.id)}>×</button>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { alerts, ackAlert, dismissAlert, rules, setRules } = useTelemetry();
  const unacked = alerts.filter(a => !a.ack);
  const critical = alerts.filter(a => a.severity === "critical" && !a.ack);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          Alerts
          {unacked.length > 0 && <span className="tag" style={{ background: "var(--red-dim)", color: "var(--red)", borderColor: "rgba(255,68,102,0.3)" }}>{unacked.length} ACTIVE</span>}
        </div>
        <div className="page-subtitle">Smart alerting with configurable thresholds and SLO breach detection</div>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "Active alerts", value: unacked.length, color: unacked.length ? "var(--red)" : "var(--accent)" },
          { label: "Critical", value: critical.length, color: critical.length ? "var(--red)" : "var(--accent)" },
          { label: "Warnings", value: alerts.filter(a => a.severity === "warning" && !a.ack).length, color: "var(--amber)" },
          { label: "Total (session)", value: alerts.length, color: "var(--text-secondary)" },
        ].map(s => (
          <div className="card" key={s.label}>
            <div className="card-label">{s.label}</div>
            <div className="card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Alert feed */}
        <div className="card" style={{ padding: 0 }}>
          <div className="section-head" style={{ padding: "14px 16px", margin: 0, borderBottom: "1px solid var(--border)" }}>
            Alert feed
            <button className="btn" onClick={() => alerts.forEach(a => ackAlert(a.id))} style={{ fontSize: 10, padding: "3px 8px" }}>Ack all</button>
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {alerts.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                ✓ No active alerts
              </div>
            )}
            {alerts.map(a => <AlertRow key={a.id} alert={a} onAck={ackAlert} onDismiss={dismissAlert} />)}
          </div>
        </div>

        {/* Alert rules config */}
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-head">Alert thresholds</div>
            {[
              { key: "cpuThreshold", label: "CPU threshold", unit: "%", min: 50, max: 100 },
              { key: "latencyThreshold", label: "Latency threshold", unit: "ms", min: 50, max: 1000 },
              { key: "errorRateThreshold", label: "Error rate threshold", unit: "%", min: 0.1, max: 20 },
              { key: "memoryThreshold", label: "Memory threshold", unit: "%", min: 50, max: 100 },
            ].map(rule => (
              <div key={rule.key} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>{rule.label}</label>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--amber)" }}>{rules[rule.key]}{rule.unit}</span>
                </div>
                <input
                  type="range"
                  min={rule.min}
                  max={rule.max}
                  step={rule.unit === "ms" ? 10 : 0.5}
                  value={rules[rule.key]}
                  onChange={e => setRules(r => ({ ...r, [rule.key]: +e.target.value }))}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-head">Alert policy</div>
            {[
              { label: "Consecutive failures before alert", value: "3 checks" },
              { label: "Alert cooldown", value: "5 minutes" },
              { label: "Escalation after", value: "15 minutes" },
              { label: "Notification channels", value: "Webhook, Email" },
              { label: "SLO error budget burn rate", value: "2× (fast), 5× (slow)" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
