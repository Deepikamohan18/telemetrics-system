import MiniChart from "./MiniChart";

export default function MetricCard({ label, value, unit = "", delta, deltaLabel, color = "#00ff88", history = [], children }) {
  const isUp = delta > 0;
  const isGoodUp = ["rps", "apdex", "uptime"].some(k => label.toLowerCase().includes(k));
  const isPositive = isGoodUp ? isUp : !isUp;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="card-label">{label}</div>
      <div className="card-value" style={{ color }}>
        {typeof value === "number" ? value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0) : value}
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 400, color: "var(--text-secondary)", marginLeft: 3 }}>{unit}</span>
      </div>
      {delta !== undefined && (
        <div className={`card-delta ${isPositive ? "up" : "down"}`}>
          {isPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}{unit} {deltaLabel || "vs prev"}
        </div>
      )}
      {history.length > 1 && (
        <div style={{ marginTop: 4 }}>
          <MiniChart data={history} color={color} height={40} />
        </div>
      )}
      {children}
    </div>
  );
}
