import { useState, useEffect } from "react";

const LEVELS = ["debug", "info", "warn", "error"];
const SERVICES = ["api-gateway", "auth-service", "user-service", "db-postgres", "cache-redis"];
const MESSAGES = {
  debug: [
    "Cache miss for key user:session:%s",
    "Query plan: seq_scan on users table",
    "Middleware chain execution: 4.2ms",
    "Token refresh attempted for user_id=%s",
    "Outbound HTTP: GET %s → 200 in 43ms",
  ],
  info: [
    "User %s authenticated successfully",
    "Request %s %s completed in %dms",
    "Cache warm: %d keys loaded",
    "Health check passed: all 3 replicas OK",
    "Rate limit bucket reset for IP %s",
    "Deployment: version %s promoted to prod",
  ],
  warn: [
    "High memory usage: %d%% (threshold: 80%%)",
    "Slow query detected: %dms (> 200ms threshold)",
    "Connection pool exhausted: waiting for slot",
    "Retry attempt %d/%d for service call",
    "JWT expiry approaching for user %s",
  ],
  error: [
    "Unhandled exception in request handler: %s",
    "Database connection failed: timeout after 5000ms",
    "Failed to parse request body: unexpected token",
    "Authentication failed: invalid token signature",
    "Downstream service %s returned 503",
  ],
};

function randStr() { return Math.random().toString(36).slice(2, 8); }
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function generateLog(id) {
  const levelIdx = Math.random() < 0.05 ? 3 : Math.random() < 0.1 ? 2 : Math.random() < 0.15 ? 1 : 0;
  const level = LEVELS[levelIdx];
  const msgs = MESSAGES[level];
  const msg = msgs[ri(0, msgs.length - 1)]
    .replace(/%s/g, randStr())
    .replace(/%d/g, ri(1, 500))
    .replace(/%%/g, "%");
  return {
    id,
    ts: Date.now() - ri(0, 3000),
    level,
    service: SERVICES[ri(0, SERVICES.length - 1)],
    message: msg,
    traceId: Math.random().toString(36).slice(2, 14),
    spanId: Math.random().toString(36).slice(2, 10),
    fields: {
      host: `pod-${randStr()}.svc.cluster.local`,
      pid: ri(1000, 9999),
      version: "2.4.1",
    },
  };
}

const LEVEL_COLOR = { debug: "var(--text-secondary)", info: "var(--blue)", warn: "var(--amber)", error: "var(--red)" };
const LEVEL_BG = { debug: "transparent", info: "var(--blue-dim)", warn: "var(--amber-dim)", error: "var(--red-dim)" };
const LEVEL_BADGE = { debug: "blue", info: "blue", warn: "amber", error: "red" };

function formatTime(ts) {
  return new Date(ts).toISOString().slice(11, 23);
}

export default function Logs() {
  const [logs, setLogs] = useState(() => Array.from({ length: 60 }, (_, i) => generateLog(i)));
  const [levelFilter, setLevelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [paused, setPaused] = useState(false);
  //const [tail, setTail] = useState(true);
  //const listRef = useState(null);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setLogs(prev => [generateLog(Date.now()), ...prev].slice(0, 200));
    }, 800);
    return () => clearInterval(interval);
  }, [paused]);

  const filtered = logs.filter(l => {
    if (levelFilter !== "all" && l.level !== levelFilter) return false;
    if (serviceFilter !== "all" && l.service !== serviceFilter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase()) && !l.traceId.includes(search)) return false;
    return true;
  });

  const counts = LEVELS.reduce((acc, l) => {
    acc[l] = logs.filter(log => log.level === l).length;
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          Structured Logs
          <span className="tag" style={paused ? { background: "var(--amber-dim)", color: "var(--amber)", borderColor: "rgba(255,170,0,0.3)" } : {}}>
            {paused ? "PAUSED" : "LIVE"}
          </span>
        </div>
        <div className="page-subtitle">Structured JSON log stream · Full-text search · Trace correlation · {logs.length} events buffered</div>
      </div>

      {/* Level counts */}
      <div className="grid-4" style={{ marginBottom: 14 }}>
        {LEVELS.map(l => (
          <div className="card" key={l} onClick={() => setLevelFilter(levelFilter === l ? "all" : l)}
            style={{ cursor: "pointer", borderColor: levelFilter === l ? LEVEL_COLOR[l] : "var(--border)" }}>
            <div className="card-label">{l}</div>
            <div className="card-value" style={{ color: LEVEL_COLOR[l] }}>{counts[l]}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search message, trace ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, background: "var(--bg-card)", border: "1px solid var(--border-bright)",
            borderRadius: "var(--radius)", padding: "6px 12px", fontSize: 12,
            color: "var(--text-primary)", fontFamily: "var(--font-mono)",
          }}
        />
        <select
          value={serviceFilter}
          onChange={e => setServiceFilter(e.target.value)}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: "var(--radius)",
            padding: "6px 10px", fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-mono)",
          }}
        >
          <option value="all">All services</option>
          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className={`btn ${paused ? "primary" : ""}`} onClick={() => setPaused(p => !p)}>
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
        <button className="btn" onClick={() => setLogs([])}>clear</button>
        <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 4 }}>
          {filtered.length} / {logs.length} shown
        </span>
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {/* Log list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ maxHeight: 560, overflowY: "auto", fontFamily: "var(--font-mono)" }}>
              {filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
                  No logs match current filter
                </div>
              )}
              {filtered.map(log => (
                <div
                  key={log.id}
                  onClick={() => setSelected(selected?.id === log.id ? null : log)}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "7px 14px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: selected?.id === log.id ? "var(--bg-elevated)" : "transparent",
                    borderLeft: `3px solid ${selected?.id === log.id ? LEVEL_COLOR[log.level] : "transparent"}`,
                    transition: "background 0.1s",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, marginTop: 1, width: 90 }}>
                    {formatTime(log.ts)}
                  </span>
                  <span className={`badge ${LEVEL_BADGE[log.level]}`} style={{ flexShrink: 0, marginTop: 1, width: 38, textAlign: "center" }}>
                    {log.level.toUpperCase().slice(0, 4)}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--purple)", flexShrink: 0, marginTop: 1, width: 110 }}>
                    {log.service}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: LEVEL_COLOR[log.level],
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {log.message}
                  </span>
                  <code style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>
                    {log.traceId.slice(0, 8)}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected log detail */}
        {selected && (
          <div style={{ width: 300, flexShrink: 0 }}>
            <div className="card">
              <div className="section-head">
                Log detail
                <button onClick={() => setSelected(null)} className="btn" style={{ padding: "2px 7px", fontSize: 10 }}>✕</button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Message</div>
                <div style={{ fontSize: 12, color: LEVEL_COLOR[selected.level], lineHeight: 1.5, fontFamily: "var(--font-mono)" }}>
                  {selected.message}
                </div>
              </div>

              {[
                ["level", <span className={`badge ${LEVEL_BADGE[selected.level]}`}>{selected.level}</span>],
                ["service", selected.service],
                ["timestamp", new Date(selected.ts).toISOString()],
                ["trace_id", selected.traceId],
                ["span_id", selected.spanId],
                ["host", selected.fields.host],
                ["pid", selected.fields.pid],
                ["version", selected.fields.version],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{k}</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-primary)", maxWidth: 160, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {typeof v === "string" || typeof v === "number" ? v : v}
                  </span>
                </div>
              ))}

              <div style={{ marginTop: 12 }}>
                <button className="btn primary" style={{ width: "100%", fontSize: 10 }}>
                  View trace →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
