import { useEffect, useRef } from "react";

// Map CSS variable names to real hex values.
// Canvas 2D API cannot resolve CSS variables — it needs actual colour strings.
const CSS_VAR_MAP = {
  "var(--accent)":  "#00ff88",
  "var(--red)":     "#ff4466",
  "var(--amber)":   "#ffaa00",
  "var(--blue)":    "#4488ff",
  "var(--purple)":  "#aa66ff",
  "var(--green)":   "#00ff88",
  // colours passed with inline opacity suffix e.g. "var(--accent)30" — strip suffix first
};

function resolveColor(raw) {
  if (!raw) return "#00ff88";
  // Strip any trailing hex-opacity characters (e.g. "var(--blue)30" → "var(--blue)")
  const stripped = raw.replace(/var\(([^)]+)\)[0-9a-fA-F]{0,2}$/, "var($1)");
  if (CSS_VAR_MAP[stripped]) return CSS_VAR_MAP[stripped];
  // If it's already a real colour (hex / rgb / hsl / named) return as-is
  if (!raw.startsWith("var(")) return raw;
  // Fallback
  return "#00ff88";
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function MiniChart({ data = [], color = "var(--accent)", height = 50, filled = true }) {
  const canvasRef = useRef(null);
  const resolvedColor = resolveColor(color);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.offsetWidth || 200;
    const h = canvas.offsetHeight || height;
    canvas.width  = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const min   = Math.min(...data);
    const max   = Math.max(...data);
    const range = max - min || 1;
    const pad   = 4;

    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * (w - pad * 2) + pad,
      y: h - pad - ((v - min) / range) * (h - pad * 2),
    }));

    // Filled area under line
    if (filled) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, h);
      pts.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, hexToRgba(resolvedColor, 0.25));
      grad.addColorStop(1, hexToRgba(resolvedColor, 0));
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = resolvedColor;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = "round";
    ctx.lineCap     = "round";
    ctx.stroke();

    // Latest dot
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = resolvedColor;
    ctx.fill();
  }, [data, resolvedColor, height, filled]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: `${height}px`, display: "block" }}
    />
  );
}
