TeleMetrics — Web Application Telemetry System
A lightweight, secure telemetry dashboard for monitoring the health of web applications in real time.

Features

Live Dashboard — CPU, memory, latency, RPS, error rate, active users with sparklines
Core Web Vitals — LCP, FCP, FID, CLS, TTFB with pass/fail thresholds
SLO Monitoring — uptime, latency, error budget, Apdex score
Distributed Traces — waterfall span breakdown, service dependency map
Performance Analytics — navigation timing, resource waterfall, render breakdown, long tasks
Structured Logs — live log stream with search, level/service filtering, trace correlation
Alerts — configurable thresholds, acknowledgement, auto-escalation
Security Monitor — XSS/SQLi/brute-force detection, PII redaction rules
SDK Config — sampling rate, integrations (Grafana, PagerDuty, Slack), data retention


Tech Stack

React 18
Vite
CSS Variables (dark theme)
Canvas API (sparklines, charts)
No external UI libraries


Getting Started
bash# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
App runs at http://localhost:5173

Project Structure
src/
├── context/
│   ├── TelemetryContext.jsx     # Context object
│   ├── TelemetryProvider.jsx    # Live metric simulation + state
│   └── useTelemetry.js          # Consumer hook
├── components/
│   ├── Sidebar.jsx / .css
│   ├── MiniChart.jsx            # Canvas sparkline
│   ├── GaugeRing.jsx            # SVG circular gauge
│   └── MetricCard.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── Traces.jsx
│   ├── Performance.jsx
│   ├── Logs.jsx
│   ├── Alerts.jsx
│   ├── Security.jsx
│   └── Settings.jsx
├── hooks/
│   └── useTelemetryHooks.js     # useMetricHistory, useApdex, useErrorBudget, etc.
├── sdk/
│   └── telemetrics.js           # Client-side telemetry SDK
└── styles/
    └── global.css

