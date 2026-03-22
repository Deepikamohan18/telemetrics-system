export const telemetryData = [];

export const logMetric = (metric) => {
  telemetryData.push({
    ...metric,
    timestamp: new Date().toISOString(),
  });

  console.log("Telemetry Logged:", metric);
};

export const getMetrics = () => telemetryData;