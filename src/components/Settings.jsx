import { useState } from "react";
import useTelemetry from "../context/useTelemetry";

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 38, height: 20, borderRadius: 10,
          background: value ? "var(--accent)" : "var(--border-bright)",
          cursor: "pointer", position: "relative", transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: value ? 21 : 3, transition: "left 0.2s",
        }} />
      </div>
    </div>
  );
}

const SDK_SNIPPET = `// Install
npm install @telemetrics/web-sdk

// Initialize (e.g. src/index.js)
import { init } from '@telemetrics/web-sdk';

init({
  apiKey: 'tele_live_sk_YOUR_KEY',
  endpoint: 'https://telemetry.yourdomain.com/ingest',
  sampleRate: 0.1,         // 10% of sessions
  enableRUM: true,          // Real User Monitoring
  enableErrors: true,       // JS error capture
  enablePerf: true,         // Performance metrics
  enableSecurity: true,     // CSP + anomaly
  batchSize: 50,
  flushInterval: 5000,      // ms
  sanitize: ['password', 'token', 'authorization'],
});`;

export default function Settings() {
  const { sdkConfig, setSdkConfig } = useTelemetry();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("sdk");

  const copy = () => {
    navigator.clipboard.writeText(SDK_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Settings <span className="tag">SDK v2.4.1</span></div>
        <div className="page-subtitle">Configure telemetry collection, sampling, integrations and SDK setup</div>
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {["sdk", "sampling", "integrations", "retention"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px",
            fontSize: 11, fontFamily: "var(--font-mono)",
            fontWeight: tab === t ? 500 : 400,
            background: "transparent",
            border: "none",
            borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === t ? "var(--accent)" : "var(--text-secondary)",
            cursor: "pointer",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {tab === "sdk" && (
        <div className="grid-2">
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="section-head">SDK installation</div>
              <div style={{ position: "relative" }}>
                <pre style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "14px 16px",
                  fontSize: 11, lineHeight: 1.7, color: "var(--text-secondary)",
                  overflowX: "auto", whiteSpace: "pre", fontFamily: "var(--font-mono)",
                }}>
                  {SDK_SNIPPET}
                </pre>
                <button onClick={copy} className="btn primary" style={{ position: "absolute", top: 10, right: 10, padding: "3px 10px", fontSize: 10 }}>
                  {copied ? "✓ copied" : "copy"}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="section-head">SDK toggles</div>
              <Toggle value={sdkConfig.enableRUM} onChange={v => setSdkConfig(c => ({ ...c, enableRUM: v }))} label="Real User Monitoring (RUM)" />
              <Toggle value={sdkConfig.enableErrors} onChange={v => setSdkConfig(c => ({ ...c, enableErrors: v }))} label="JS error capture" />
              <Toggle value={sdkConfig.enablePerf} onChange={v => setSdkConfig(c => ({ ...c, enablePerf: v }))} label="Performance metrics" />
              <Toggle value={sdkConfig.enableSecurity} onChange={v => setSdkConfig(c => ({ ...c, enableSecurity: v }))} label="Security event forwarding" />
            </div>

            <div className="card">
              <div className="section-head">Transport settings</div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Ingest endpoint</label>
                <input
                  type="text"
                  value={sdkConfig.endpoint}
                  onChange={e => setSdkConfig(c => ({ ...c, endpoint: e.target.value }))}
                  style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>API key</label>
                <input
                  type="text"
                  value={sdkConfig.apiKey}
                  readOnly
                  style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn primary">Regenerate key</button>
                <button className="btn">Test connection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "sampling" && (
        <div className="grid-2">
          <div className="card">
            <div className="section-head">Sampling strategy</div>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.7 }}>
              Head-based sampling is applied at session start. Tail-based sampling retains 100% of error traces regardless of sample rate.
            </p>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Base sample rate</label>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>{(sdkConfig.sampleRate * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={1} max={100} value={sdkConfig.sampleRate * 100} step={1}
                onChange={e => setSdkConfig(c => ({ ...c, sampleRate: +e.target.value / 100 }))}
                style={{ width: "100%", accentColor: "var(--accent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                <span>1% (min overhead)</span><span>100% (full fidelity)</span>
              </div>
            </div>
            {[
              { label: "Error traces (tail sampling)", value: "100%" },
              { label: "Slow requests (>500ms)", value: "100%" },
              { label: "Security events", value: "100%" },
              { label: "Normal transactions", value: `${(sdkConfig.sampleRate * 100).toFixed(0)}%` },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                <span style={{ color: "var(--accent)", fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-head">Batch & flush config</div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Batch size (events)</label>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--blue)" }}>{sdkConfig.batchSize}</span>
              </div>
              <input type="range" min={10} max={200} step={10} value={sdkConfig.batchSize}
                onChange={e => setSdkConfig(c => ({ ...c, batchSize: +e.target.value }))}
                style={{ width: "100%", accentColor: "var(--blue)" }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Flush interval (ms)</label>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--blue)" }}>{sdkConfig.flushInterval}ms</span>
              </div>
              <input type="range" min={1000} max={30000} step={1000} value={sdkConfig.flushInterval}
                onChange={e => setSdkConfig(c => ({ ...c, flushInterval: +e.target.value }))}
                style={{ width: "100%", accentColor: "var(--blue)" }} />
            </div>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>Estimated overhead</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                ~{(sdkConfig.sampleRate * 100 * 0.3).toFixed(1)} KB/min per session · {sdkConfig.batchSize} events per flush · {sdkConfig.flushInterval / 1000}s interval
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "integrations" && (
        <div className="grid-2">
          {[
            { name: "Grafana", desc: "Push metrics via Prometheus remote-write endpoint", status: "connected", color: "var(--amber)" },
            { name: "PagerDuty", desc: "Critical alerts routed as incidents with priority mapping", status: "connected", color: "var(--red)" },
            { name: "Slack", desc: "Alert notifications to #ops-alerts channel", status: "connected", color: "var(--purple)" },
            { name: "Datadog", desc: "Forward custom metrics via StatsD", status: "disconnected", color: "var(--blue)" },
            { name: "Sentry", desc: "Error events enriched with telemetry trace IDs", status: "connected", color: "var(--red)" },
            { name: "OpenTelemetry", desc: "OTLP export to your collector endpoint", status: "disconnected", color: "var(--accent)" },
          ].map(intg => (
            <div key={intg.name} className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--radius)", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: intg.color, flexShrink: 0, fontFamily: "var(--font-display)" }}>
                {intg.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{intg.name}</span>
                  <span className={`badge ${intg.status === "connected" ? "green" : "amber"}`}>{intg.status.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>{intg.desc}</div>
                <button className={`btn ${intg.status === "connected" ? "" : "primary"}`} style={{ fontSize: 10, padding: "3px 10px" }}>
                  {intg.status === "connected" ? "Configure" : "Connect"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "retention" && (
        <div className="grid-2">
          <div className="card">
            <div className="section-head">Data retention policy</div>
            {[
              { tier: "Hot (queryable)", period: "7 days", storage: "SSD, replicated", cost: "high" },
              { tier: "Warm (compressed)", period: "30 days", storage: "Object store", cost: "medium" },
              { tier: "Cold (archive)", period: "90 days", storage: "Glacier / tape", cost: "low" },
              { tier: "Security events", period: "1 year", storage: "Append-only log", cost: "medium" },
              { tier: "Compliance audit", period: "7 years", storage: "Legal hold", cost: "low" },
            ].map(row => (
              <div key={row.tier} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{row.tier}</span>
                  <span style={{ fontSize: 11, color: "var(--accent)" }}>{row.period}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{row.storage} · {row.cost} cost tier</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="section-head">GDPR & compliance</div>
            {[
              { label: "Right to erasure", desc: "User data purged within 48h of request via /api/telemetry/erase" },
              { label: "Data minimization", desc: "Only essential metrics collected; full PII never stored" },
              { label: "Consent enforcement", desc: "Telemetry disabled if user has not consented (GDPR)" },
              { label: "Data residency", desc: "EU-hosted ingest endpoint available; configure via region param" },
              { label: "Audit logging", desc: "All ingest, access and purge operations logged immutably" },
            ].map(row => (
              <div key={row.label} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 3 }}>{row.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>{row.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
