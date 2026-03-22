import { useState, useEffect } from "react";
//import useTelemetry from "../context/useTelemetry";

//function rb(a, b) { return +(Math.random() * (b - a) + a).toFixed(2); }
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

const SERVICES = ["api-gateway", "auth-service", "user-service", "db-postgres", "cache-redis", "payment-svc", "notification-svc"];
const STATUS = ["ok", "ok", "ok", "ok", "error", "ok", "ok"]; // weighted toward ok
const METHODS = ["GET", "POST", "GET", "PUT", "GET", "DELETE", "POST"];
const PATHS = ["/api/users", "/api/auth/login", "/api/products", "/api/checkout", "/api/search", "/api/orders", "/api/token/refresh"];

function generateSpan(traceId, parentId, service, startOffset, duration, depth = 0) {
  const statusIdx = ri(0, 6);
  return {
    spanId: Math.random().toString(36).slice(2, 10),
    traceId,
    parentId,
    service,
    operation: ["db.query", "http.request", "cache.get", "grpc.call", "middleware", "auth.verify"][ri(0, 5)],
    status: STATUS[statusIdx],
    startOffset,
    duration,
    depth,
    tags: {
      "http.status": statusIdx === 4 ? ri(400, 503) : ri(200, 204),
      "db.statement": service.includes("db") ? "SELECT * FROM users WHERE id = ?" : null,
      "cache.hit": service.includes("cache") ? Math.random() > 0.3 : null,
    }
  };
}

function generateTrace(id) {
  const traceId = Math.random().toString(36).slice(2, 14);
  const rootDuration = ri(80, 800);
  const pathIdx = ri(0, PATHS.length - 1);
  const hasError = Math.random() < 0.15;
  const spans = [
    generateSpan(traceId, null, "api-gateway", 0, rootDuration, 0),
  ];
  // Auth span
  const authDur = ri(10, 60);
  spans.push(generateSpan(traceId, spans[0].spanId, "auth-service", ri(2, 15), authDur, 1));
  // Service span
  const svcDur = ri(20, rootDuration - 40);
  const svc = SERVICES[ri(1, SERVICES.length - 1)];
  spans.push(generateSpan(traceId, spans[0].spanId, svc, authDur + ri(5, 20), svcDur, 1));
  // DB span
  if (Math.random() > 0.3) {
    spans.push(generateSpan(traceId, spans[2].spanId, "db-postgres", ri(5, 15), ri(5, svcDur - 10), 2));
  }
  // Cache span
  if (Math.random() > 0.5) {
    spans.push(generateSpan(traceId, spans[2].spanId, "cache-redis", ri(2, 8), ri(2, 12), 2));
  }

  if (hasError) spans[ri(1, spans.length - 1)].status = "error";

  return {
    traceId,
    id,
    path: PATHS[pathIdx],
    method: METHODS[pathIdx],
    status: hasError ? ri(400, 503) : ri(200, 204),
    duration: rootDuration,
    startedAt: Date.now() - ri(0, 120000),
    spans,
    service: "api-gateway",
    hasError,
  };
}

const DEPTH_COLORS = ["var(--b)", "var(--p)", "var(--g)", "var(--a)", "var(--r)"];
const SVC_COLORS = {
  "api-gateway": "#4488ff",
  "auth-service": "#aa66ff",
  "user-service": "#00ff88",
  "db-postgres": "#ffaa00",
  "cache-redis": "#ff6644",
  "payment-svc": "#00ccff",
  "notification-svc": "#ff44aa",
};

function WaterfallRow({ span, totalDuration, isSelected, onClick }) {
  const leftPct = (span.startOffset / totalDuration) * 100;
  const widthPct = Math.max(0.5, (span.duration / totalDuration) * 100);
  const color = SVC_COLORS[span.service] || "var(--b)";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "5px 0",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: isSelected ? "var(--bg-elevated)" : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Service + operation */}
      <div style={{ width: 220, flexShrink: 0, paddingLeft: `${span.depth * 16 + 8}px`, paddingRight: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500 }}>{span.service}</span>
          {span.status === "error" && <span className="badge red" style={{ fontSize: 9 }}>ERR</span>}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", paddingLeft: 11 }}>{span.operation}</div>
      </div>
      {/* Waterfall bar */}
      <div style={{ flex: 1, position: "relative", height: 20, margin: "0 12px" }}>
        <div style={{
          position: "absolute",
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          height: "100%",
          background: span.status === "error" ? "var(--red)" : color,
          borderRadius: 2,
          opacity: 0.85,
          minWidth: 3,
        }} />
      </div>
      {/* Duration */}
      <div style={{ width: 60, textAlign: "right", fontSize: 11, color: span.duration > 300 ? "var(--amber)" : "var(--text-secondary)", flexShrink: 0 }}>
        {span.duration}ms
      </div>
    </div>
  );
}

export default function Traces() {
  const [traces, setTraces] = useState(() => Array.from({ length: 20 }, (_, i) => generateTrace(i)));
  const [selected, setSelected] = useState(null);
  const [selectedSpan, setSelectedSpan] = useState(null);
  const [filter, setFilter] = useState("all");
  const [now, setNow] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTraces(prev => [generateTrace(Date.now()), ...prev].slice(0, 50));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filtered = traces.filter(t => {
    if (filter === "errors") return t.hasError;
    if (filter === "slow") return t.duration > 400;
    return true;
  });

  const selectedTrace = selected !== null ? traces.find(t => t.id === selected) : null;

  const p50 = [...traces].sort((a, b) => a.duration - b.duration)[Math.floor(traces.length * 0.5)]?.duration || 0;
  const p95 = [...traces].sort((a, b) => a.duration - b.duration)[Math.floor(traces.length * 0.95)]?.duration || 0;
  const p99 = [...traces].sort((a, b) => a.duration - b.duration)[Math.floor(traces.length * 0.99)]?.duration || 0;
  const errorPct = ((traces.filter(t => t.hasError).length / traces.length) * 100).toFixed(1);

  function timeAgo(ts) {
    const s = Math.floor((now - ts) / 1000);
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          Distributed Traces
          <span className="tag">LIVE</span>
        </div>
        <div className="page-subtitle">End-to-end request tracing across services · Waterfall span breakdown · Error attribution</div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "P50 latency", value: p50 + "ms", color: "var(--accent)" },
          { label: "P95 latency", value: p95 + "ms", color: p95 > 300 ? "var(--amber)" : "var(--accent)" },
          { label: "P99 latency", value: p99 + "ms", color: p99 > 500 ? "var(--red)" : "var(--amber)" },
          { label: "Error rate", value: errorPct + "%", color: +errorPct > 5 ? "var(--red)" : "var(--accent)" },
        ].map(s => (
          <div className="card" key={s.label}>
            <div className="card-label">{s.label}</div>
            <div className="card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {/* Trace list */}
        <div style={{ flex: selectedTrace ? "0 0 380px" : 1 }}>
          <div className="card" style={{ padding: 0 }}>
            <div className="section-head" style={{ padding: "12px 16px", margin: 0, borderBottom: "1px solid var(--border)" }}>
              <span>Recent traces</span>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "errors", "slow"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className="btn" style={{
                    padding: "3px 10px", fontSize: 10,
                    background: filter === f ? "var(--accent-dim)" : "transparent",
                    color: filter === f ? "var(--accent)" : "var(--text-secondary)",
                    borderColor: filter === f ? "rgba(0,255,136,0.3)" : "var(--border-bright)",
                  }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              <table className="tele-table">
                <thead>
                  <tr>
                    <th>Trace ID</th>
                    <th>Method + Path</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Spans</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(trace => (
                    <tr
                      key={trace.id}
                      onClick={() => { setSelected(trace.id); setSelectedSpan(null); }}
                      style={{ cursor: "pointer", background: selected === trace.id ? "var(--bg-elevated)" : "transparent" }}
                    >
                      <td><code style={{ fontSize: 10, color: "var(--text-secondary)" }}>{trace.traceId.slice(0, 8)}…</code></td>
                      <td>
                        <span className={`badge ${trace.method === "GET" ? "blue" : trace.method === "POST" ? "green" : trace.method === "DELETE" ? "red" : "amber"}`} style={{ marginRight: 5 }}>{trace.method}</span>
                        <code style={{ fontSize: 10, color: "var(--blue)" }}>{trace.path}</code>
                      </td>
                      <td>
                        <span style={{ color: trace.status >= 400 ? "var(--red)" : "var(--accent)", fontWeight: 500, fontSize: 12 }}>{trace.status}</span>
                      </td>
                      <td style={{ color: trace.duration > 400 ? "var(--amber)" : trace.duration > 200 ? "var(--text-primary)" : "var(--accent)", fontWeight: 500 }}>
                        {trace.duration}ms
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{trace.spans.length}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 10 }}>{timeAgo(trace.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Trace detail / waterfall */}
        {selectedTrace && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ padding: 0 }}>
              <div className="section-head" style={{ padding: "12px 16px", margin: 0, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <span style={{ marginRight: 8 }}>Trace detail</span>
                  <code style={{ fontSize: 10, color: "var(--text-secondary)" }}>{selectedTrace.traceId}</code>
                </div>
                <button onClick={() => setSelected(null)} className="btn" style={{ padding: "3px 8px", fontSize: 10 }}>✕ close</button>
              </div>

              {/* Trace metadata */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                {[
                  { k: "total duration", v: selectedTrace.duration + "ms" },
                  { k: "spans", v: selectedTrace.spans.length },
                  { k: "status", v: selectedTrace.status },
                  { k: "services", v: [...new Set(selectedTrace.spans.map(s => s.service))].length },
                ].map(m => (
                  <div key={m.k}>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{m.k}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{m.v}</div>
                  </div>
                ))}
              </div>

              {/* Waterfall */}
              <div style={{ padding: "8px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                  <div style={{ width: 220, fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", paddingLeft: 8 }}>Service / Operation</div>
                  <div style={{ flex: 1, fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 12px" }}>Timeline (0 → {selectedTrace.duration}ms)</div>
                  <div style={{ width: 60, fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "right" }}>Duration</div>
                </div>
                {selectedTrace.spans.map(span => (
                  <WaterfallRow
                    key={span.spanId}
                    span={span}
                    totalDuration={selectedTrace.duration}
                    isSelected={selectedSpan === span.spanId}
                    onClick={() => setSelectedSpan(span.spanId === selectedSpan ? null : span.spanId)}
                  />
                ))}
              </div>

              {/* Selected span detail */}
              {selectedSpan && (() => {
                const span = selectedTrace.spans.find(s => s.spanId === selectedSpan);
                if (!span) return null;
                return (
                  <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                    <div className="section-head" style={{ fontSize: 10 }}>Span details</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                      {[
                        ["span_id", span.spanId],
                        ["service", span.service],
                        ["operation", span.operation],
                        ["status", span.status],
                        ["start_offset", span.startOffset + "ms"],
                        ["duration", span.duration + "ms"],
                        span.tags["http.status"] ? ["http.status", span.tags["http.status"]] : null,
                        span.tags["db.statement"] ? ["db.statement", span.tags["db.statement"]] : null,
                        span.tags["cache.hit"] !== null ? ["cache.hit", String(span.tags["cache.hit"])] : null,
                      ].filter(Boolean).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>{k}</span>
                          <code style={{ color: "var(--blue)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Service map */}
            <div className="card" style={{ marginTop: 14 }}>
              <div className="section-head">Service dependency map</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[...new Set(selectedTrace.spans.map(s => s.service))].map(svc => (
                  <div key={svc} style={{
                    background: "var(--bg-elevated)", border: `1px solid ${SVC_COLORS[svc] || "var(--border)"}`,
                    borderRadius: "var(--radius)", padding: "6px 12px", fontSize: 11,
                    color: SVC_COLORS[svc] || "var(--text-primary)",
                  }}>
                    {svc}
                    <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 6 }}>
                      {selectedTrace.spans.filter(s => s.service === svc).reduce((a, s) => a + s.duration, 0)}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
