import useTelemetry from "../context/useTelemetry";
import MetricCard from "../components/MetricCard";
import GaugeRing from "../components/GaugeRing";
import MiniChart from "../components/MiniChart";

function CoreWebVitalBar({ label, value, good, needs, unit = "ms" }) {
  const isGood = value <= good;
  const isNeeds = value <= needs;
 // const status = isGood ? "good" : isNeeds ? "needs" : "poor";
  const color = isGood ? "var(--accent)" : isNeeds ? "var(--amber)" : "var(--red)";
  const pct = Math.min(100, (value / (needs * 1.5)) * 100);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color }}>{unit === "score" ? value.toFixed(3) : `${value.toFixed(0)}${unit}`}</span>
          <span className={`badge ${isGood ? "green" : isNeeds ? "amber" : "red"}`}>
            {isGood ? "GOOD" : isNeeds ? "NEEDS IMPR" : "POOR"}
          </span>
        </div>
      </div>
      <div className="bar-track" style={{ width: "100%", height: 5 }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "var(--text-muted)" }}>
        <span>0</span>
        <span>Good ≤{good}{unit === "score" ? "" : unit}</span>
        <span>Needs ≤{needs}{unit === "score" ? "" : unit}</span>
      </div>
    </div>
  );
}

function EndpointRow({ path, rps, latency, errors }) {
  const errColor = errors > 5 ? "var(--red)" : errors > 1 ? "var(--amber)" : "var(--accent)";
  return (
    <tr>
      <td><code style={{ fontSize: 11, color: "var(--blue)" }}>{path}</code></td>
      <td>{rps}/s</td>
      <td style={{ color: latency > 300 ? "var(--red)" : latency > 150 ? "var(--amber)" : "var(--text-primary)" }}>{latency}ms</td>
      <td style={{ color: errColor }}>{errors.toFixed(1)}%</td>
      <td>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${Math.min(100, rps / 5)}%`, background: "var(--blue)" }} />
        </div>
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const { metrics, history } = useTelemetry();

  //const cpuHist = history.map(h => h.cpu);
  //const memHist = history.map(h => h.memory);
  const latHist = history.map(h => h.latency);
  const rpsHist = history.map(h => h.rps);
  const errHist = history.map(h => h.errorRate);

  const prev = history[history.length - 5] || metrics;
  //const cpuColor = metrics.cpu > 85 ? "var(--red)" : metrics.cpu > 70 ? "var(--amber)" : "var(--accent)";
  const latColor = metrics.latency > 300 ? "var(--red)" : metrics.latency > 150 ? "var(--amber)" : "var(--accent)";
  const errColor = metrics.errorRate > 5 ? "var(--red)" : metrics.errorRate > 1 ? "var(--amber)" : "var(--accent)";

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          System Overview
          <span className="tag">LIVE</span>
        </div>
        <div className="page-subtitle">Real-time telemetry · Refreshing every 3s · {new Date().toLocaleTimeString()}</div>
      </div>

      {/* Top gauges */}
      <div className="card" style={{ marginBottom: 20, padding: "20px 24px" }}>
        <div className="section-head">Infrastructure health</div>
        <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
          <GaugeRing value={metrics.cpu} color="var(--accent)" label="CPU" size={90} />
          <GaugeRing value={metrics.memory} color="var(--blue)" label="Memory" size={90} />
          <GaugeRing value={metrics.diskIO} color="var(--purple)" label="Disk I/O" size={90} />
          <GaugeRing value={metrics.errorRate} max={20} color="var(--red)" unit="%" label="Error Rate" size={90} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ marginBottom: 10, fontSize: 11, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
              <span>Network In</span><span style={{ color: "var(--text-primary)" }}>{metrics.networkIn.toFixed(1)} MB/s</span>
            </div>
            <div className="bar-track" style={{ width: "100%", marginBottom: 12 }}>
              <div className="bar-fill" style={{ width: `${(metrics.networkIn / 120) * 100}%`, background: "var(--accent)" }} />
            </div>
            <div style={{ marginBottom: 10, fontSize: 11, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
              <span>Network Out</span><span style={{ color: "var(--text-primary)" }}>{metrics.networkOut.toFixed(1)} MB/s</span>
            </div>
            <div className="bar-track" style={{ width: "100%", marginBottom: 12 }}>
              <div className="bar-fill" style={{ width: `${(metrics.networkOut / 80) * 100}%`, background: "var(--blue)" }} />
            </div>
            <div style={{ marginBottom: 10, fontSize: 11, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
              <span>GC Pause</span><span style={{ color: metrics.gcPause > 50 ? "var(--amber)" : "var(--text-primary)" }}>{metrics.gcPause.toFixed(1)}ms</span>
            </div>
            <div className="bar-track" style={{ width: "100%" }}>
              <div className="bar-fill" style={{ width: `${(metrics.gcPause / 80) * 100}%`, background: "var(--purple)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* KPI metric cards */}
      <div className="grid-4">
        <MetricCard
          label="Avg Response Latency"
          value={metrics.latency}
          unit="ms"
          color={latColor}
          delta={metrics.latency - prev.latency}
          history={latHist}
        />
        <MetricCard
          label="Requests / sec"
          value={metrics.rps}
          unit=""
          color="var(--blue)"
          delta={metrics.rps - prev.rps}
          history={rpsHist}
        />
        <MetricCard
          label="Error Rate"
          value={metrics.errorRate}
          unit="%"
          color={errColor}
          delta={metrics.errorRate - prev.errorRate}
          history={errHist}
        />
        <MetricCard
          label="Active Users"
          value={metrics.activeUsers}
          unit=""
          color="var(--purple)"
          delta={metrics.activeUsers - prev.activeUsers}
          history={history.map(h => h.activeUsers)}
        />
      </div>

      <div className="grid-2">
        {/* Core Web Vitals */}
        <div className="card">
          <div className="section-head">
            Core Web Vitals
            <span className="badge blue">RUM</span>
          </div>
          <CoreWebVitalBar label="LCP — Largest Contentful Paint" value={metrics.lcp} good={2500} needs={4000} unit="ms" />
          <CoreWebVitalBar label="FID — First Input Delay" value={metrics.fid} good={100} needs={300} unit="ms" />
          <CoreWebVitalBar label="CLS — Cumulative Layout Shift" value={metrics.cls * 100} good={10} needs={25} unit="" />
          <CoreWebVitalBar label="FCP — First Contentful Paint" value={metrics.fcp} good={1800} needs={3000} unit="ms" />
          <CoreWebVitalBar label="TTFB — Time to First Byte" value={metrics.ttfb} good={200} needs={500} unit="ms" />
        </div>

        {/* SLO panel */}
        <div className="card">
          <div className="section-head">
            SLO / SLA status
            <span style={{ fontSize: 11, color: "var(--accent)" }}>99.97% uptime</span>
          </div>
          {[
            { label: "Availability SLO", target: 99.9, current: metrics.uptime, unit: "%" },
            { label: "P95 Latency SLO", target: 300, current: metrics.latency, unit: "ms", inverse: true },
            { label: "Error Budget", target: 5, current: metrics.errorRate, unit: "%", inverse: true },
            { label: "Apdex Score", target: 0.85, current: metrics.apdex, unit: "", max: 1 },
          ].map(slo => {
            const isGood = slo.inverse ? slo.current <= slo.target : slo.current >= slo.target;
            return (
              <div key={slo.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{slo.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: isGood ? "var(--accent)" : "var(--red)" }}>
                      {slo.current.toFixed(slo.unit === "%" && slo.current > 10 ? 1 : 2)}{slo.unit}
                    </span>
                    <span className={`badge ${isGood ? "green" : "red"}`}>{isGood ? "MET" : "BREACH"}</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                  Target: {slo.inverse ? "≤" : "≥"}{slo.target}{slo.unit}
                </div>
                <div className="bar-track" style={{ width: "100%" }}>
                  <div className="bar-fill" style={{
                    width: `${slo.max ? (slo.current / slo.max) * 100 : Math.min(100, (slo.current / slo.target) * 100)}%`,
                    background: isGood ? "var(--accent)" : "var(--red)"
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Endpoint breakdown */}
      <div className="card">
        <div className="section-head">Top endpoints</div>
        <table className="tele-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>RPS</th>
              <th>P95 Latency</th>
              <th>Error %</th>
              <th>Load</th>
            </tr>
          </thead>
          <tbody>
            <EndpointRow path="GET /api/users" rps={Math.round(metrics.rps * 0.3)} latency={Math.round(metrics.latency * 0.8)} errors={metrics.errorRate * 0.5} />
            <EndpointRow path="POST /api/auth/login" rps={Math.round(metrics.rps * 0.15)} latency={Math.round(metrics.latency * 1.2)} errors={metrics.errorRate * 1.1} />
            <EndpointRow path="GET /api/products" rps={Math.round(metrics.rps * 0.25)} latency={Math.round(metrics.latency * 0.7)} errors={metrics.errorRate * 0.3} />
            <EndpointRow path="POST /api/checkout" rps={Math.round(metrics.rps * 0.1)} latency={Math.round(metrics.latency * 1.8)} errors={metrics.errorRate * 0.8} />
            <EndpointRow path="GET /api/search" rps={Math.round(metrics.rps * 0.2)} latency={Math.round(metrics.latency * 0.95)} errors={metrics.errorRate * 0.6} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
