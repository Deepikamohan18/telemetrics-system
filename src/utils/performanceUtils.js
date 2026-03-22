export const getPageLoadTime = () => {
  const timing = performance.timing;
  return timing.loadEventEnd - timing.navigationStart;
};

export const getMemoryUsage = () => {
  if (performance.memory) {
    return performance.memory.usedJSHeapSize;
  }
  return "Not Supported";
};