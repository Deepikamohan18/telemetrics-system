import { useState, useEffect, useRef } from "react";
import TelemetryContext from "./TelemetryContext";

function randBetween(min, max) {
  return +(Math.random() * (max - min) + min).toFixed(2);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSnapshot(prev) {
  const cpuBase = prev ? prev.cpu + randBetween(-3, 3) : randBetween(25, 65);
  const memBase = prev ? prev.memory + randBetween(-1, 1) : randBetween(40, 72);
  const latency = prev
    ? Math.max(10, prev.latency + randBetween(-8, 12))
    : randBetween(35, 120);
  const rps = prev
    ? Math.max(0, prev.rps + randInt(-40, 60))
    : randInt(200, 900);
  const errorRate = prev
    ? Math.max(0, Math.min(15, prev.errorRate + randBetween(-0.3, 0.5)))
    : randBetween(0.1, 3.5);
  const apdex = +(1 - errorRate / 100 - latency / 5000).toFixed(3);

  return {
    cpu: Math.min(98, Math.max(5, cpuBase)),
    memory: Math.min(96, Math.max(20, memBase)),
    latency: Math.min(800, latency),
    rps,
    errorRate: Math.min(15, Math.max(0, errorRate)),
    apdex: Math.max(0, Math.min(1, apdex)),
    ttfb: randBetween(30, 250),
    fcp: randBetween(800, 2800),
    lcp: randBetween(1200, 4500),
    cls: +(Math.random() * 0.25).toFixed(3),
    fid: randBetween(10, 120),
    uptime: prev ? prev.uptime : 99.97,
    activeUsers: prev
      ? Math.max(0, prev.activeUsers + randInt(-20, 30))
      : randInt(150, 500),
    gcPause: randBetween(0, 80),
    diskIO: randBetween(10, 90),
    networkIn: randBetween(1, 120),
    networkOut: randBetween(0.5, 80),
    timestamp: Date.now(),
  };
}

function generateAlerts(metrics) {
  const alerts = [];
  if (metrics.cpu > 85)
    alerts.push({
      id: Date.now() + 1, severity: "critical",
      title: "CPU spike detected",
      message: `CPU at ${metrics.cpu.toFixed(1)}% — threshold is 85%`,
      ts: Date.now(), ack: false,
    });
  if (metrics.latency > 300)
    alerts.push({
      id: Date.now() + 2, severity: "warning",
      title: "High response latency",
      message: `P95 latency ${metrics.latency.toFixed(0)}ms exceeds SLA threshold of 300ms`,
      ts: Date.now(), ack: false,
    });
  if (metrics.errorRate > 5)
    alerts.push({
      id: Date.now() + 3, severity: "critical",
      title: "Error rate elevated",
      message: `Error rate at ${metrics.errorRate.toFixed(2)}% — SLO breach imminent`,
      ts: Date.now(), ack: false,
    });
  if (metrics.memory > 88)
    alerts.push({
      id: Date.now() + 4, severity: "warning",
      title: "Memory pressure",
      message: `Heap usage at ${metrics.memory.toFixed(1)}% — consider scaling`,
      ts: Date.now(), ack: false,
    });
  if (metrics.lcp > 4000)
    alerts.push({
      id: Date.now() + 5, severity: "warning",
      title: "Poor Core Web Vital (LCP)",
      message: `LCP ${metrics.lcp.toFixed(0)}ms — exceeds Good threshold of 2500ms`,
      ts: Date.now(), ack: false,
    });
  return alerts;
}

const SECURITY_EVENTS = [
  { type: "auth_fail",   label: "Failed auth attempt",   severity: "warning"  },
  { type: "rate_limit",  label: "Rate limit triggered",  severity: "info"     },
  { type: "xss_probe",   label: "XSS probe blocked",     severity: "critical" },
  { type: "sqli_probe",  label: "SQL injection attempt", severity: "critical" },
  { type: "unusual_ua",  label: "Unusual user agent",    severity: "info"     },
  { type: "geo_anomaly", label: "Geo-anomaly login",     severity: "warning"  },
  { type: "csrf_token",  label: "CSRF token mismatch",   severity: "warning"  },
  { type: "brute_force", label: "Brute force pattern",   severity: "critical" },
];

export default function TelemetryProvider({ children }) {
  const [metrics, setMetrics] = useState(() => generateSnapshot(null));
  const [history, setHistory] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      ...generateSnapshot(null),
      timestamp: Date.now() - (30 - i) * 5000,
    }))
  );
  const [alerts,         setAlerts]         = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [rules,          setRules]          = useState({
    cpuThreshold:       85,
    latencyThreshold:   300,
    errorRateThreshold: 5,
    memoryThreshold:    88,
  });
  const [sdkConfig, setSdkConfig] = useState({
    sampleRate:     0.1,
    enableRUM:      true,
    enableErrors:   true,
    enablePerf:     true,
    enableSecurity: true,
    batchSize:      50,
    flushInterval:  5000,
    endpoint:       "https://telemetry.yourdomain.com/ingest",
    apiKey:         "tele_live_sk_xxxxxxxxxxxxxxxx",
  });

  const prevRef = useRef(metrics);

  useEffect(() => {
    const id = setInterval(() => {
      const snap = generateSnapshot(prevRef.current);
      prevRef.current = snap;
      setMetrics(snap);
      setHistory((h) => [...h.slice(-59), snap]);
      const newAlerts = generateAlerts(snap);
      if (newAlerts.length) {
        setAlerts((a) => [...newAlerts, ...a].slice(0, 50));
      }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() < 0.4) {
        const evt = SECURITY_EVENTS[randInt(0, SECURITY_EVENTS.length - 1)];
        setSecurityEvents((e) =>
          [
            {
              ...evt,
              id:   Date.now(),
              ip:   `${randInt(1,255)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,255)}`,
              path: ["/api/login","/api/data","/admin","/api/users","/api/token"][randInt(0,4)],
              ts:   Date.now(),
            },
            ...e,
          ].slice(0, 80)
        );
      }
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const ackAlert     = (id) => setAlerts((a) => a.map((al) => (al.id === id ? { ...al, ack: true } : al)));
  const dismissAlert = (id) => setAlerts((a) => a.filter((al) => al.id !== id));

  return (
    <TelemetryContext.Provider
      value={{
        metrics, history, alerts, securityEvents,
        rules, setRules, sdkConfig, setSdkConfig,
        ackAlert, dismissAlert,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}
