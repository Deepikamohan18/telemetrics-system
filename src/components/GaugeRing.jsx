export default function GaugeRing({ value = 0, max = 100, color = "#00ff88", size = 80, label = "", unit = "%" }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const dash = pct * circ;
  const gap = circ - dash;
  const cx = size / 2;
  const cy = size / 2;
  const rot = -90;

  const col = value > 85 ? "#ff4466" : value > 70 ? "#ffaa00" : color;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: `rotate(${rot}deg)` }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e2e" strokeWidth={6} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={col}
          strokeWidth={6}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s" }}
        />
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e8e8f0"
          fontSize={size * 0.18}
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
          style={{ transform: `rotate(${-rot}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        >
          {value.toFixed(0)}{unit}
        </text>
      </svg>
      {label && <span style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>}
    </div>
  );
}
