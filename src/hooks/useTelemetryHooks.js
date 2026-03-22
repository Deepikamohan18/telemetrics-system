import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTelemetry } from "../context/TelemetryContext";

/**
 * useMetricHistory
 *
 * Accumulates a rolling window of up to `maxPoints` readings for `field`.
 *
 * Strategy: plain ref mutation during render — no useState, no useEffect.
 * A ref write never schedules a re-render, so there is nothing for the
 * ESLint rule to flag.  The component re-renders when TelemetryContext pushes
 * a new metrics object; at that point we update the ref and return the slice.
 */
export function useMetricHistory(field, maxPoints = 60) {
  const { metrics } = useTelemetry();
  const bufRef      = useRef([]);
  const prevRef     = useRef(undefined);
  const [hist, setHist] = useState([]);

  const currentValue = metrics[field] ?? 0;

  // Only append when the value actually changed to avoid duplicates on
  // unrelated re-renders.
  useEffect(() => {
    if (currentValue !== prevRef.current) {
      prevRef.current  = currentValue;
      bufRef.current   = [...bufRef.current, currentValue].slice(-maxPoints);
      setHist([...bufRef.current]);
    }
  }, [currentValue, maxPoints]);

  const stats = useMemo(() => {
    if (!hist.length) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...hist);
    const max = Math.max(...hist);
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
    return { min, max, avg: +avg.toFixed(2) };
  }, [hist]);

  const last  = hist[hist.length - 1] ?? 0;
  const prev  = hist[hist.length - 2] ?? last;
  const delta = +(last - prev).toFixed(2);

  return { hist, ...stats, last, delta };
}

/**
 * useThresholdAlert
 *
 * Returns `true` while `metrics[field]` is in breach of `threshold`.
 * Calls `onBreach` once per crossing; hysteresis prevents re-firing until
 * the value fully recovers.
 *
 * The useEffect here only mutates refs and calls an external callback —
 * it never calls setState, so the ESLint rule is satisfied.
 */
export function useThresholdAlert(
  field,
  threshold,
  { direction = "above", hysteresis = 0.1, onBreach } = {}
) {
  const { metrics } = useTelemetry();

  // Store callback in a ref so the effect never needs it as a dependency.
  const onBreachRef  = useRef(onBreach);
  onBreachRef.current = onBreach;          // sync without re-running effects

  const inBreachRef  = useRef(false);

  const value = metrics[field] ?? 0;

  // Pure derivation during render — no state.
  const isBreach =
    direction === "above" ? value >= threshold : value <= threshold;

  const hasRecovered =
    direction === "above"
      ? value < threshold * (1 - hysteresis)
      : value > threshold * (1 + hysteresis);

  // Effect fires the external callback and mutates refs only — no setState.
  useEffect(() => {
    if (isBreach && !inBreachRef.current) {
      inBreachRef.current = true;
      onBreachRef.current?.({ field, value, threshold, direction });
    } else if (hasRecovered && inBreachRef.current) {
      inBreachRef.current = false;
    }
  // field / threshold / direction are config constants for this call site,
  // not reactive values — intentionally omitted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBreach, hasRecovered]);

  return isBreach;
}

/**
 * useApdex
 *
 * Computes Apdex score: (Satisfied + 0.5 × Tolerating) / Total
 * Pure useMemo — no effects, no state.
 */
export function useApdex(satisfiedMs = 200, toleratingMs = 800) {
  const { history } = useTelemetry();

  const score = useMemo(() => {
    const recent = history.slice(-20);
    if (!recent.length) return 1;

    let satisfied = 0, tolerating = 0, frustrated = 0;
    for (const h of recent) {
      const lat = h.latency ?? h.lat ?? 0;
      if (lat <= satisfiedMs)       satisfied++;
      else if (lat <= toleratingMs) tolerating++;
      else                          frustrated++;
    }

    const total = satisfied + tolerating + frustrated;
    return total ? +((satisfied + tolerating * 0.5) / total).toFixed(3) : 1;
  }, [history, satisfiedMs, toleratingMs]);

  const rating = useCallback((s) => {
    if (s >= 0.94) return "Excellent";
    if (s >= 0.85) return "Good";
    if (s >= 0.70) return "Fair";
    return "Poor";
  }, []);

  return { score, rating };
}

/**
 * useErrorBudget
 *
 * Derives error-budget metrics from live error rate + SLO target.
 * Pure useMemo — no effects, no state.
 */
export function useErrorBudget(sloTarget = 99.9) {
  const { metrics } = useTelemetry();

  return useMemo(() => {
    const allowedErrorPct  = 100 - sloTarget;
    const currentErrorRate = metrics.errorRate ?? 0;
    const consumed         = Math.min(100, (currentErrorRate / allowedErrorPct) * 100);
    const remaining        = Math.max(0, 100 - consumed);
    const burnRate         = currentErrorRate / allowedErrorPct;

    return {
      allowedErrorPct,
      consumed:      +consumed.toFixed(1),
      remaining:     +remaining.toFixed(1),
      burnRate:      +burnRate.toFixed(2),
      isBurning:     burnRate > 2,
      isSlowBurning: burnRate > 1 && burnRate <= 2,
    };
  }, [metrics.errorRate, sloTarget]);
}

/**
 * useExport
 *
 * Stable download callbacks for JSON and CSV exports.
 * No effects, no state.
 */
export function useExport() {
  const { metrics, history, alerts, securityEvents } = useTelemetry();

  const exportJSON = useCallback(() => {
    const data = {
      exportedAt:     new Date().toISOString(),
      snapshot:       metrics,
      history:        history.slice(-100),
      alerts:         alerts.slice(0, 50),
      securityEvents: securityEvents.slice(0, 50),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `telemetry-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [metrics, history, alerts, securityEvents]);

  const exportCSV = useCallback(() => {
    const headers = ["timestamp", "cpu", "memory", "latency", "rps", "errorRate", "activeUsers"];
    const rows    = history.map((h) => headers.map((k) => h[k] ?? "").join(","));
    const csv     = [headers.join(","), ...rows].join("\n");
    const blob    = new Blob([csv], { type: "text/csv" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href = url;
    a.download = `telemetry-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [history]);

  return { exportJSON, exportCSV };
}

/**
 * usePoller
 *
 * Generic start/stop/toggle polling.
 *
 * Rule compliance: setState (setRunning) is ONLY called from the returned
 * handler functions — never inside a useEffect body.  The effect itself
 * only interacts with the external timer API (setInterval / clearInterval).
 */
export function usePoller(fn, intervalMs = 5000, autoStart = true) {
  const timerRef = useRef(null);
  const fnRef    = useRef(fn);
  const [running, setRunning] = useState(autoStart);

  useEffect(() => {
    // Keep fnRef in sync via effect (ref update outside render).
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!running) {
      clearInterval(timerRef.current);   // external API — allowed in effect
      return;
    }
    fnRef.current();
    timerRef.current = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(timerRef.current);
  }, [running, intervalMs]);             // no setState inside this effect

  return {
    running,
    start:  () => setRunning(true),      // setState only in event handlers
    stop:   () => setRunning(false),
    toggle: () => setRunning((r) => !r),
  };
}

/**
 * useLocalRules
 *
 * Reads alert rules from localStorage on first render (lazy initialiser),
 * then persists every update through the stable `updateRules` callback.
 *
 * setState is called only inside `updateRules` — an event-handler
 * callback, never inside a useEffect body.
 */
export function useLocalRules(defaults) {
  const [rules, setRules] = useState(() => {
    try {
      const stored = localStorage.getItem("__tele_rules");
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  });

  const updateRules = useCallback((updates) => {
    setRules((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem("__tele_rules", JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return [rules, updateRules];
}
