import useTelemetry from "../context/useTelemetry";
import MiniChart from "./MiniChart";

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const SEV_COLOR = { critical: "var(--red)", warning: "var(--amber)", info: "var(--blue)" };

export default function Security() {
  const { securityEvents } = useTelemetry();

  const eventsByType = securityEvents.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  const criticalCount = securityEvents.filter(e => e.severity === "critical").length;
  const uniqueIPs = new Set(securityEvents.map(e => e.ip)).size;
  const blockedCount = securityEvents.filter(e => ["xss_probe", "sqli_probe", "brute_force"].includes(e.type)).length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          Security events
          <span className="tag">THREAT MONITOR</span>
        </div>
        <div className="page-subtitle">Real-time attack surface monitoring, anomaly detection & telemetry integrity</div>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "Security events", value: securityEvents.length, color: securityEvents.length > 30 ? "var(--red)" : "var(--text-primary)" },
          { label: "Critical threats", value: criticalCount, color: criticalCount > 5 ? "var(--red)" : "var(--amber)" },
          { label: "Unique attacker IPs", value: uniqueIPs, color: "var(--amber)" },
          { label: "Blocked attacks", value: blockedCount, color: "var(--accent)" },
        ].map(s => (
          <div className="card" key={s.label}>
            <div className="card-label">{s.label}</div>
            <div className="card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Live event stream */}
        <div className="card" style={{ padding: 0 }}>
          <div className="section-head" style={{ padding: "14px 16px", margin: 0, borderBottom: "1px solid var(--border)" }}>
            Live event stream
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="status-dot green pulse" />
              <span style={{ fontSize: 10, color: "var(--accent)" }}>LIVE</span>
            </div>
          </div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {securityEvents.slice(0, 30).map(evt => (
              <div key={evt.id} style={{
                display: "flex",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                alignItems: "flex-start",
              }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: SEV_COLOR[evt.severity], marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{evt.label}</span>
                    <span className={`badge ${evt.severity === "critical" ? "red" : evt.severity === "warning" ? "amber" : "blue"}`}>{evt.severity.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", display: "flex", gap: 10 }}>
                    <span>IP: <code style={{ color: "var(--blue)" }}>{evt.ip}</code></span>
                    <span>Path: <code style={{ color: "var(--purple)" }}>{evt.path}</code></span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{timeAgo(evt.ts)}</span>
              </div>
            ))}
            {securityEvents.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No events yet...</div>
            )}
          </div>
        </div>

        <div>
          {/* Attack type breakdown */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-head">Attack type breakdown</div>
            {Object.entries(eventsByType).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{type.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{count}</span>
                </div>
                <div className="bar-track" style={{ width: "100%" }}>
                  <div className="bar-fill" style={{
                    width: `${(count / Math.max(...Object.values(eventsByType))) * 100}%`,
                    background: ["xss_probe", "sqli_probe", "brute_force"].includes(type) ? "var(--red)" : "var(--amber)"
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Telemetry security features */}
          <div className="card">
            <div className="section-head">Telemetry security controls</div>
            {[
              { label: "Data sanitization", status: "active", desc: "PII stripped before transmission" },
              { label: "HTTPS transport", status: "active", desc: "TLS 1.3 enforced" },
              { label: "API key rotation", status: "active", desc: "Auto-rotates every 30 days" },
              { label: "Payload signing", status: "active", desc: "HMAC-SHA256 per batch" },
              { label: "Rate limiting (ingest)", status: "active", desc: "10k events/min per key" },
              { label: "Anomaly detection", status: "active", desc: "Z-score threshold: 3σ" },
              { label: "CSP reporting", status: "active", desc: "Violations forwarded to pipeline" },
              { label: "Data retention policy", status: "active", desc: "90 days, GDPR-compliant purge" },
            ].map(ctrl => (
              <div key={ctrl.label} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                <div className="status-dot green" style={{ marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{ctrl.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{ctrl.desc}</div>
                </div>
                <span className="badge green">ON</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PII & data redaction rules */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="section-head">Data redaction & privacy rules</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { field: "user.email", rule: "hash:SHA256", example: "user@mail.com → a3f8c2..." },
            { field: "user.ip", rule: "mask:last-octet", example: "192.168.1.42 → 192.168.1.0" },
            { field: "req.headers.authorization", rule: "redact", example: "Bearer sk_... → [REDACTED]" },
            { field: "req.body.password", rule: "drop", example: "Field excluded entirely" },
            { field: "user.name", rule: "pseudonymize", example: "Alice Chen → usr_a3b8..." },
            { field: "error.stack", rule: "truncate:512", example: "Stack limited to 512 chars" },
          ].map(r => (
            <div key={r.field} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
              <code style={{ fontSize: 10, color: "var(--blue)", display: "block", marginBottom: 3 }}>{r.field}</code>
              <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500, marginBottom: 3 }}>{r.rule}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{r.example}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
