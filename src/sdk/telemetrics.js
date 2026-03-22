/**
 * @telemetrics/web-sdk  v2.4.1
 *
 * Lightweight, secure telemetry SDK for web applications.
 * Collects: errors, performance (RUM + Core Web Vitals), custom events,
 *           security anomalies, and network timing.
 *
 * Design goals:
 *  - < 8 KB gzipped (tree-shakeable)
 *  - Zero external dependencies
 *  - PII-safe by default
 *  - Works with CSP strict-dynamic
 *  - Batched, authenticated transport with offline queue
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TelemetryConfig
 * @property {string}   apiKey           - Required. Your ingest API key.
 * @property {string}   [endpoint]       - Ingest endpoint URL.
 * @property {number}   [sampleRate]     - 0–1 session sample rate (default: 0.1).
 * @property {boolean}  [enableRUM]      - Collect Real User Monitoring data.
 * @property {boolean}  [enableErrors]   - Capture unhandled JS errors.
 * @property {boolean}  [enablePerf]     - Collect navigation/resource timing.
 * @property {boolean}  [enableSecurity] - Forward CSP violations + anomalies.
 * @property {number}   [batchSize]      - Events per flush (default: 50).
 * @property {number}   [flushInterval]  - Ms between flushes (default: 5000).
 * @property {string[]} [sanitize]       - Field names to redact from payloads.
 * @property {boolean}  [debug]          - Log SDK actions to console.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const SDK_VERSION = "2.4.1";
const DEFAULT_ENDPOINT = "https://ingest.telemetrics.io/v1/events";
const DEFAULT_SAMPLE_RATE = 0.1;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL = 5000;
const STORAGE_KEY = "__tele_queue";
const SESSION_KEY = "__tele_sid";

// ─── Internal state ───────────────────────────────────────────────────────────

let _config = null;
let _sessionId = null;
let _queue = [];
let _flushTimer = null;
let _initialized = false;
let _observers = [];

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Generate a collision-resistant ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/** Clamp a number between min and max */
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Recursively sanitize an object, redacting fields that match _config.sanitize.
 * Also strips common PII patterns (email, phone, credit card) even if not listed.
 */
function sanitize(obj, depth = 0) {
  if (depth > 6 || obj === null || typeof obj !== "object") return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    const k = key.toLowerCase();
    // Named field redaction
    if (_config.sanitize.some(s => k.includes(s.toLowerCase()))) {
      result[key] = "[REDACTED]";
      continue;
    }
    // PII pattern stripping
    if (typeof value === "string") {
      result[key] = value
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
        .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]")
        .replace(/\b(?:\d[ -]?){13,16}\b/g, "[CARD]");
    } else if (typeof value === "object") {
      result[key] = sanitize(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Compute HMAC-SHA256 signature for a payload string */
async function sign(payload) {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(_config.apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Persist queue to localStorage as backup for offline/tab-close scenarios */
function persistQueue() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_queue.slice(0, 200)));
  } catch { /* quota exceeded or private mode */ }
}

/** Restore any events queued from a previous (crashed/closed) session */
function restoreQueue() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const events = JSON.parse(stored);
      if (Array.isArray(events)) _queue.push(...events);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* ignore parse errors */ }
}

function log(...args) {
  if (_config?.debug) console.log("[telemetrics]", ...args);
}

// ─── Transport ────────────────────────────────────────────────────────────────

/**
 * Flush up to `batchSize` events to the ingest endpoint.
 * Uses Beacon API when available (non-blocking page unload),
 * falls back to fetch with keepalive.
 */
async function flush(force = false) {
  if (!_config || _queue.length === 0) return;

  const batch = _queue.splice(0, _config.batchSize);
  const payload = JSON.stringify({
    sdk: SDK_VERSION,
    sessionId: _sessionId,
    ts: Date.now(),
    events: batch,
  });

  const sig = await sign(payload);
  const headers = {
    "Content-Type": "application/json",
    "X-Tele-Key": _config.apiKey,
    "X-Tele-Sig": sig || "",
    "X-Tele-Version": SDK_VERSION,
  };

  log(`Flushing ${batch.length} events`);

  // Prefer Beacon for unload scenarios
  if (force && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    const ok = navigator.sendBeacon(_config.endpoint, blob);
    if (!ok) _queue.unshift(...batch); // re-queue on failure
    return;
  }

  try {
    const res = await fetch(_config.endpoint, {
      method: "POST",
      headers,
      body: payload,
      keepalive: true,
    });
    if (!res.ok) {
      log("Flush failed:", res.status);
      _queue.unshift(...batch.slice(0, 20)); // partial re-queue
    }
  } catch (err) {
    log("Flush error:", err);
    _queue.unshift(...batch); // full re-queue
    persistQueue(); // save for next session
  }
}

// ─── Event ingestion ──────────────────────────────────────────────────────────

/**
 * Enqueue a single telemetry event.
 * All events are tagged with sessionId, timestamp, url, and sdk version.
 */
function enqueue(type, data) {
  if (!_config) return;

  const event = sanitize({
    id: uid(),
    type,
    ts: Date.now(),
    url: location.href,
    sessionId: _sessionId,
    ...data,
  });

  _queue.push(event);
  log("Enqueued:", type, event);

  if (_queue.length >= _config.batchSize) flush();
}

// ─── Error capture ────────────────────────────────────────────────────────────

function captureError(error, context = {}) {
  if (!_config?.enableErrors) return;
  enqueue("error", {
    message: error?.message || String(error),
    stack: (error?.stack || "").slice(0, 512), // truncate long stacks
    type: error?.name || "Error",
    ...context,
  });
}

function installErrorHandlers() {
  window.addEventListener("error", (e) => {
    captureError(e.error || { message: e.message, stack: "" }, {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    captureError(err, { type: "UnhandledPromiseRejection" });
  });
}

// ─── Performance / RUM ────────────────────────────────────────────────────────

function collectNavigationTiming() {
  if (!performance?.getEntriesByType) return;
  const [nav] = performance.getEntriesByType("navigation");
  if (!nav) return;
  enqueue("perf.navigation", {
    dns: nav.domainLookupEnd - nav.domainLookupStart,
    tcp: nav.connectEnd - nav.connectStart,
    ssl: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
    ttfb: nav.responseStart - nav.requestStart,
    download: nav.responseEnd - nav.responseStart,
    domParsing: nav.domInteractive - nav.responseEnd,
    domComplete: nav.domComplete - nav.responseEnd,
    loadEvent: nav.loadEventEnd - nav.loadEventStart,
    total: nav.loadEventEnd - nav.startTime,
    transferSize: nav.transferSize,
    encodedBodySize: nav.encodedBodySize,
  });
}

function collectResourceTiming() {
  if (!performance?.getEntriesByType) return;
  const entries = performance.getEntriesByType("resource");
  const resources = entries.slice(-50).map(r => ({
    name: r.name.slice(0, 256),
    initiatorType: r.initiatorType,
    duration: Math.round(r.duration),
    transferSize: r.transferSize,
    cached: r.transferSize === 0 && r.duration < 10,
  }));
  enqueue("perf.resources", { resources });
}

function observeWebVitals() {
  // LCP
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      enqueue("perf.lcp", { value: Math.round(last.startTime), element: last.element?.tagName });
    });
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    _observers.push(lcpObs);
  } catch {
    // PerformanceObserver not supported
  }

  // CLS
  try {
    let clsValue = 0;
    const clsObs = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) clsValue += entry.value;
      });
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
    _observers.push(clsObs);
    // Report on visibilitychange
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        enqueue("perf.cls", { value: +clsValue.toFixed(4) });
      }
    }, { once: true });
  } catch {
    // PerformanceObserver not supported
  }

  // FID / INP (if supported)
  try {
    const fidObs = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        enqueue("perf.fid", {
          value: Math.round(entry.processingStart - entry.startTime),
          eventType: entry.name,
        });
      });
    });
    fidObs.observe({ type: "first-input", buffered: true });
    _observers.push(fidObs);
  } catch  {
    // PerformanceObserver not supported
  }

  // FCP
  try {
    const fcpObs = new PerformanceObserver((list) => {
      list.getEntries().forEach(e => {
        if (e.name === "first-contentful-paint") {
          enqueue("perf.fcp", { value: Math.round(e.startTime) });
        }
      });
    });
    fcpObs.observe({ type: "paint", buffered: true });
    _observers.push(fcpObs);
  } catch  {
    // PerformanceObserver not supported
  }

  // Long tasks (TBT proxy)
  try {
    const ltObs = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        enqueue("perf.longtask", {
          duration: Math.round(entry.duration),
          startTime: Math.round(entry.startTime),
          attribution: entry.attribution?.[0]?.name,
        });
      });
    });
    ltObs.observe({ type: "longtask", buffered: true });
    _observers.push(ltObs);
  } catch  {
    // PerformanceObserver not supported
  }
}

// ─── Security monitoring ──────────────────────────────────────────────────────

function installSecurityMonitoring() {
  // CSP violation reporting
  document.addEventListener("securitypolicyviolation", (e) => {
    enqueue("security.csp_violation", {
      blockedURI: e.blockedURI,
      violatedDirective: e.violatedDirective,
      originalPolicy: e.originalPolicy?.slice(0, 256),
      sourceFile: e.sourceFile,
      lineNumber: e.lineNumber,
    });
  });

  // Detect devtools open heuristic (timing-based)
  const devtoolsCheck = setInterval(() => {
    const before = performance.now();
    // eslint-disable-next-line no-debugger
    debugger; // pauses iff devtools is open
    const after = performance.now();
    if (after - before > 100) {
      enqueue("security.devtools_open", { lag: after - before });
      clearInterval(devtoolsCheck);
    }
  }, 15000);

  // Detect clipboard exfiltration
  document.addEventListener("copy", () => enqueue("security.clipboard_copy", {}));
  document.addEventListener("cut", () => enqueue("security.clipboard_cut", {}));

  // Invisible iframe / clickjacking sentinel
  if (window.self !== window.top) {
    enqueue("security.framed", { parent: document.referrer });
  }
}

// ─── Session management ───────────────────────────────────────────────────────

function getOrCreateSession() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const id = uid();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return uid();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the telemetry SDK.
 *
 * @param {TelemetryConfig} config
 */
export function init(config) {
  if (_initialized) {
    console.warn("[telemetrics] init() called more than once — ignoring.");
    return;
  }

  if (!config?.apiKey) throw new Error("[telemetrics] apiKey is required.");

  _config = {
    endpoint: DEFAULT_ENDPOINT,
    sampleRate: DEFAULT_SAMPLE_RATE,
    enableRUM: true,
    enableErrors: true,
    enablePerf: true,
    enableSecurity: true,
    batchSize: DEFAULT_BATCH_SIZE,
    flushInterval: DEFAULT_FLUSH_INTERVAL,
    sanitize: ["password", "token", "secret", "authorization", "cookie", "ssn", "cvv"],
    debug: false,
    ...config,
  };

  // Sampling gate — exit early if this session is not sampled
  if (Math.random() > clamp(_config.sampleRate, 0, 1)) {
    log("Session not sampled, SDK inactive.");
    return;
  }

  _sessionId = getOrCreateSession();
  _initialized = true;

  restoreQueue();

  if (_config.enableErrors) installErrorHandlers();
  if (_config.enablePerf) {
    if (document.readyState === "complete") {
      collectNavigationTiming();
      collectResourceTiming();
    } else {
      window.addEventListener("load", () => {
        collectNavigationTiming();
        collectResourceTiming();
      });
    }
    observeWebVitals();
  }
  if (_config.enableSecurity) installSecurityMonitoring();

  // Periodic flush
  _flushTimer = setInterval(flush, _config.flushInterval);

  // Flush on tab hide / close
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistQueue();
      flush(true); // beacon
    }
  });
  window.addEventListener("beforeunload", () => flush(true));

  // Record session start
  enqueue("session.start", {
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    connectionType: navigator.connection?.effectiveType,
    referrer: document.referrer,
  });

  log(`Initialized. Session: ${_sessionId}. Sample rate: ${_config.sampleRate}`);
}

/**
 * Track a custom user action or business event.
 *
 * @param {string} name  - Event name, e.g. "checkout.completed"
 * @param {Object} [data] - Arbitrary serializable metadata
 */
export function track(name, data = {}) {
  if (!_initialized) { log("track() called before init()"); return; }
  enqueue("custom", { name, ...data });
}

/**
 * Record a custom performance measurement.
 *
 * @param {string} name   - Metric name, e.g. "api.checkout.duration"
 * @param {number} value  - Numeric value
 * @param {string} [unit] - Unit: "ms" | "bytes" | "count" | etc.
 */
export function measure(name, value, unit = "ms") {
  if (!_initialized) return;
  enqueue("perf.custom", { name, value, unit });
}

/**
 * Manually capture an error (e.g. in a try/catch).
 *
 * @param {Error|string} error
 * @param {Object} [context]
 */
export function captureException(error, context = {}) {
  if (!_initialized) return;
  captureError(typeof error === "string" ? new Error(error) : error, context);
}

/**
 * Set persistent attributes on all subsequent events for this session.
 * Useful for: user ID (hashed), plan tier, feature flags.
 *
 * @param {Object} attributes - Key-value pairs (PII will be auto-sanitized)
 */
export function setUser(attributes) {
  if (!_initialized) return;
  enqueue("session.identify", sanitize(attributes));
}

/**
 * Force an immediate flush of all queued events.
 * @returns {Promise<void>}
 */
export async function forceFlush() {
  if (!_initialized) return;
  await flush();
}

/**
 * Gracefully shut down the SDK:
 * disconnects all observers, clears timers, flushes remaining events.
 */
export async function shutdown() {
  if (!_initialized) return;
  _observers.forEach(obs => obs.disconnect());
  clearInterval(_flushTimer);
  await flush(true);
  _initialized = false;
  log("SDK shut down cleanly.");
}

/**
 * Create a child span context for manual distributed tracing.
 *
 * @param {string} name  - Span name
 * @param {Object} [attributes]
 * @returns {{ end: (attributes?: Object) => void }}
 */
export function startSpan(name, attributes = {}) {
  const spanId = uid();
  const startTime = performance.now();
  enqueue("trace.span_start", { spanId, name, ...attributes });
  return {
    spanId,
    end(endAttributes = {}) {
      const duration = performance.now() - startTime;
      enqueue("trace.span_end", { spanId, name, duration: Math.round(duration), ...endAttributes });
    },
  };
}
