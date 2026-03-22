import { useState, useEffect, useRef } from "react";
//import { useTelemetry } from "../context/TelemetryContext";
import MiniChart from "../components/MiniChart";

function rb(a, b) { return +(Math.random() * (b - a) + a).toFixed(1); }
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function ResourceRow({ name, type, size, duration, cached }) {
  //const typeColor = { js: "var(--blue)", css: "var(--purple)", img: "var(--amber)", font: "var(--accent)", xhr: "var(--red)", fetch: "var(--red)" };
  //const col = typeColor[type] || "var(--text-secondary)";
  return (
    <tr>
      <td><code style={{ fontSize: 10, color: "var(--blue)" }}>{name}</code></td>
      <td><span className={`badge ${type === "js" ? "blue" : type === "css" ? "purple" : type === "img" ? "amber" : "green"}`}>{type}</span></td>
      <td style={{ color: "var(--text-secondary)", fontSize: 11 }}>{(size / 1024).toFixed(1)} KB</td>
      <td style={{ color: duration > 500 ? "var(--red)" : duration > 200 ? "var(--amber)" : "var(--accent)", fontWeight: 500 }}>{duration}ms</td>
      <td>
        {cached
          ? <span className="badge green">CACHED</span>
          : <span className="badge red">NETWORK</span>}
      </td>
    </tr>
  );
}

function TimingBar({ label, start, end, total, color }) {
  const leftPct = (start / total) * 100;
  const widthPct = ((end - start) / total) * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 500, color }}>{(end - start).toFixed(0)}ms</span>
      </div>
      <div style={{ position: "relative", height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: `${leftPct}%`, width: `${widthPct}%`, height: "100%", background: color, borderRadius: 3, minWidth: 2 }} />
      </div>
    </div>
  );
}

const PAGES = ["/", "/products", "/checkout", "/user/profile", "/search", "/orders"];

function generatePageLoad() {
  const dns = rb(5, 40);
  const tcp = rb(10, 80);
  const ssl = rb(20, 120);
  const ttfb = dns + tcp + ssl + rb(30, 200);
  const download = rb(20, 150);
  const domParse = rb(50, 300);
  const domComplete = ttfb + download + domParse + rb(20, 100);
  const loadEvent = domComplete + rb(10, 60);
  return { dns, tcp, ssl, ttfb, download, domParse, domComplete, loadEvent, total: loadEvent + rb(10, 50) };
}

export default function Performance() {
  //const { metrics, history } = useTelemetry();
  const [pageLoadHistory] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      lcp: rb(1200, 3800),
      fcp: rb(600, 2500),
      ttfb: rb(50, 350),
      cls: rb(0, 20),
      tbt: rb(0, 400),
      inp: rb(50, 300),
    }))
  );
  const [resources] = useState(() => [
    { name: "main.bundle.js", type: "js", size: ri(180000, 450000), duration: ri(80, 400), cached: false },
    { name: "vendor.chunk.js", type: "js", size: ri(100000, 300000), duration: ri(40, 200), cached: true },
    { name: "styles.css", type: "css", size: ri(20000, 80000), duration: ri(20, 100), cached: true },
    { name: "hero-image.webp", type: "img", size: ri(50000, 200000), duration: ri(50, 300), cached: false },
    { name: "font.woff2", type: "font", size: ri(10000, 40000), duration: ri(30, 150), cached: true },
    { name: "/api/users", type: "fetch", size: ri(2000, 20000), duration: ri(30, 250), cached: false },
    { name: "/api/products", type: "fetch", size: ri(5000, 40000), duration: ri(40, 300), cached: false },
    { name: "analytics.js", type: "js", size: ri(30000, 80000), duration: ri(50, 200), cached: true },
  ]);
  const [timing] = useState(generatePageLoad);
  const [selectedPage, setSelectedPage] = useState("/");
  const canvasRef = useRef(null);

  // Draw hourly perf chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.offsetWidth; const h = canvas.offsetHeight;
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const pad = { t: 10, r: 10, b: 24, l: 36 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;

    // Grid
    ctx.strokeStyle = "#1e1e2e"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ch / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
      ctx.fillStyle = "#3a3a52"; ctx.font = "10px 'JetBrains Mono'";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(4000 - i * 1000) + "", pad.l - 4, y + 3);
    }

    const lines = [
      { key: "lcp", color: "#4488ff", label: "LCP" },
      { key: "fcp", color: "#00ff88", label: "FCP" },
      { key: "ttfb", color: "#ffaa00", label: "TTFB" },
    ];

    lines.forEach(({ key, color, label }) => {
      const pts = pageLoadHistory.map((d, i) => ({
        x: pad.l + (i / (pageLoadHistory.length - 1)) * cw,
        y: pad.t + ch - (d[key] / 4000) * ch,
      }));

      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke();

      // Last point
      const last = pts[pts.length - 1];
      ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();

      // Label
      ctx.fillStyle = color; ctx.font = "10px 'JetBrains Mono'";
      ctx.textAlign = "left";
      ctx.fillText(label, last.x + 5, last.y + 3);
    });

    // X axis hours
    ctx.fillStyle = "#3a3a52"; ctx.font = "10px 'JetBrains Mono'"; ctx.textAlign = "center";
    [0, 6, 12, 18, 23].forEach(h => {
      const x = pad.l + (h / 23) * cw;
      ctx.fillText(`${h}:00`, x, pad.t + ch + 16);
    });
  }, [pageLoadHistory]);

  const avgLCP = (pageLoadHistory.reduce((a, d) => a + d.lcp, 0) / pageLoadHistory.length).toFixed(0);
  const avgTTFB = (pageLoadHistory.reduce((a, d) => a + d.ttfb, 0) / pageLoadHistory.length).toFixed(0);
  const totalResourceSize = (resources.reduce((a, r) => a + r.size, 0) / 1024 / 1024).toFixed(2);
  const cachedPct = ((resources.filter(r => r.cached).length / resources.length) * 100).toFixed(0);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          Performance Analytics
          <span className="tag">RUM + SYNTHETIC</span>
        </div>
        <div className="page-subtitle">Core Web Vitals over time · Navigation timing · Resource waterfall · Render breakdown</div>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "Avg LCP (24h)", value: avgLCP + "ms", color: +avgLCP < 2500 ? "var(--accent)" : +avgLCP < 4000 ? "var(--amber)" : "var(--red)" },
          { label: "Avg TTFB (24h)", value: avgTTFB + "ms", color: +avgTTFB < 200 ? "var(--accent)" : +avgTTFB < 500 ? "var(--amber)" : "var(--red)" },
          { label: "Total page size", value: totalResourceSize + " MB", color: "var(--blue)" },
          { label: "Cache hit rate", value: cachedPct + "%", color: +cachedPct > 60 ? "var(--accent)" : "var(--amber)" },
        ].map(s => (
          <div className="card" key={s.label}>
            <div className="card-label">{s.label}</div>
            <div className="card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 24h CWV trend */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-head">
          Core Web Vitals — 24h trend
          <div style={{ display: "flex", gap: 12 }}>
            {[["LCP","#4488ff"], ["FCP","#00ff88"], ["TTFB","#ffaa00"]].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                <div style={{ width: 20, height: 2, background: c, borderRadius: 1 }} />
                <span style={{ color: "var(--text-secondary)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", width: "100%", height: 160 }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
      </div>

      <div className="grid-2">
        {/* Navigation timing breakdown */}
        <div className="card">
          <div className="section-head">
            Navigation timing
            <div style={{ display: "flex", gap: 4 }}>
              {PAGES.map(p => (
                <button key={p} onClick={() => setSelectedPage(p)} className="btn" style={{
                  padding: "2px 7px", fontSize: 9,
                  background: selectedPage === p ? "var(--accent-dim)" : "transparent",
                  color: selectedPage === p ? "var(--accent)" : "var(--text-secondary)",
                  borderColor: selectedPage === p ? "rgba(0,255,136,0.3)" : "var(--border-bright)",
                }}>{p}</button>
              ))}
            </div>
          </div>
          <TimingBar label="DNS lookup" start={0} end={timing.dns} total={timing.total} color="var(--purple)" />
          <TimingBar label="TCP connection" start={timing.dns} end={timing.dns + timing.tcp} total={timing.total} color="var(--blue)" />
          <TimingBar label="TLS/SSL handshake" start={timing.dns + timing.tcp} end={timing.dns + timing.tcp + timing.ssl} total={timing.total} color="var(--amber)" />
          <TimingBar label="TTFB (server processing)" start={timing.dns + timing.tcp + timing.ssl} end={timing.ttfb} total={timing.total} color="var(--red)" />
          <TimingBar label="Content download" start={timing.ttfb} end={timing.ttfb + timing.download} total={timing.total} color="var(--accent)" />
          <TimingBar label="DOM parsing" start={timing.ttfb + timing.download} end={timing.domParse + timing.ttfb + timing.download} total={timing.total} color="var(--purple)" />
          <TimingBar label="DOM complete" start={timing.domParse + timing.ttfb + timing.download} end={timing.domComplete} total={timing.total} color="var(--blue)" />
          <TimingBar label="Load event" start={timing.domComplete} end={timing.loadEvent} total={timing.total} color="var(--accent)" />
          <div style={{ marginTop: 12, padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "var(--text-secondary)" }}>Total load time</span>
            <span style={{ fontWeight: 500, color: timing.total > 3000 ? "var(--red)" : timing.total > 1500 ? "var(--amber)" : "var(--accent)" }}>
              {timing.total.toFixed(0)}ms
            </span>
          </div>
        </div>

        {/* Render breakdown */}
        <div className="card">
          <div className="section-head">Render performance breakdown</div>
          {[
            { label: "Script evaluation (JS parse + compile)", value: rb(80, 400), max: 500, color: "var(--blue)", unit: "ms" },
            { label: "Style recalculation", value: rb(5, 50), max: 100, color: "var(--purple)", unit: "ms" },
            { label: "Layout / reflow", value: rb(3, 60), max: 100, color: "var(--amber)", unit: "ms" },
            { label: "Paint (first + subsequent)", value: rb(2, 40), max: 80, color: "var(--accent)", unit: "ms" },
            { label: "Composite layers", value: rb(1, 20), max: 40, color: "var(--blue)", unit: "ms" },
            { label: "Total blocking time (TBT)", value: rb(0, 350), max: 600, color: "var(--red)", unit: "ms" },
            { label: "Interaction to Next Paint (INP)", value: rb(50, 300), max: 500, color: "var(--amber)", unit: "ms" },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{item.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: item.value > item.max * 0.7 ? "var(--amber)" : item.color }}>
                  {item.value}{item.unit}
                </span>
              </div>
              <div className="bar-track" style={{ width: "100%", height: 4 }}>
                <div className="bar-fill" style={{ width: `${(item.value / item.max) * 100}%`, background: item.color }} />
              </div>
            </div>
          ))}

          <div className="section-head" style={{ marginTop: 16 }}>JS heap usage</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 10 }}>
                <span style={{ color: "var(--text-secondary)" }}>Used heap</span>
                <span style={{ color: "var(--text-primary)" }}>{rb(20, 80)} MB</span>
              </div>
              <div className="bar-track" style={{ width: "100%", marginBottom: 8 }}>
                <div className="bar-fill" style={{ width: "52%", background: "var(--accent)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: "var(--text-secondary)" }}>Heap limit</span>
                <span style={{ color: "var(--text-primary)" }}>{rb(200, 400)} MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource table */}
      <div className="card">
        <div className="section-head">
          Resource loading
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {resources.length} resources · {totalResourceSize} MB total · {cachedPct}% cached
          </div>
        </div>
        <table className="tele-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Type</th>
              <th>Size</th>
              <th>Duration</th>
              <th>Cache</th>
            </tr>
          </thead>
          <tbody>
            {resources.map(r => <ResourceRow key={r.name} {...r} />)}
          </tbody>
        </table>
      </div>

      {/* Long tasks */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="section-head">
          Long tasks (blocking &gt;50ms)
          <span className="badge amber">{ri(2, 8)} detected</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {Array.from({ length: 4 }, (_, i) => ({
            script: ["vendor.bundle.js", "analytics.js", "main.bundle.js", "third-party-widget.js"][i],
            duration: ri(55, 280),
            startTime: rb(100, 2000),
            type: ["Timer", "Script", "Style/Layout", "Event Dispatch"][i],
          })).map((task, i) => (
            <div key={i} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "var(--amber)", fontWeight: 500, marginBottom: 3 }}>{task.type}</div>
              <code style={{ fontSize: 10, color: "var(--blue)", display: "block", marginBottom: 4 }}>{task.script}</code>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: "var(--text-secondary)" }}>duration</span>
                <span style={{ color: task.duration > 150 ? "var(--red)" : "var(--amber)", fontWeight: 500 }}>{task.duration}ms</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: "var(--text-secondary)" }}>start</span>
                <span style={{ color: "var(--text-secondary)" }}>{task.startTime}ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
