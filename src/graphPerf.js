const PERF_GLOBAL_KEY = "__COZY_GRAPH_PERF__";
const FRAME_BUDGET_MS = 1000 / 60;
const DROPPED_FRAME_MS = FRAME_BUDGET_MS * 1.5;

const STAGE_NAMES = [
  "backgroundDust",
  "projection",
  "explicitEdges",
  "anchorEdges",
  "proximityEdges",
  "depthSort",
  "nodeDraw",
  "labelDraw",
];

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function summarize(values) {
  if (!values.length) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: total / values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}

function getMemorySnapshot() {
  if (typeof performance === "undefined" || !performance.memory) return null;

  return {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
  };
}

function createStageBuckets() {
  return STAGE_NAMES.reduce((buckets, name) => {
    buckets[name] = [];
    return buckets;
  }, {});
}

function createGraphPerfCollector(metadata) {
  const frameTimes = [];
  const frameDeltas = [];
  const stageTimes = createStageBuckets();
  const proximityChecks = [];
  const proximityEdgesDrawn = [];
  const dragRenderLatencies = [];
  const clickCardLatencies = [];
  const longTasks = [];
  let lastRafNow = null;
  let pendingDragInputAt = null;
  let pendingClickAt = null;
  let currentMetadata = { ...metadata };
  let memoryStart = getMemorySnapshot();
  let observer = null;

  if (
    typeof PerformanceObserver !== "undefined"
    && PerformanceObserver.supportedEntryTypes?.includes("longtask")
  ) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
        });
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  }

  const collector = {
    enabled: true,
    updateMetadata(nextMetadata) {
      currentMetadata = { ...currentMetadata, ...nextMetadata };
    },
    reset(label = "default") {
      frameTimes.length = 0;
      frameDeltas.length = 0;
      for (const name of STAGE_NAMES) stageTimes[name].length = 0;
      proximityChecks.length = 0;
      proximityEdgesDrawn.length = 0;
      dragRenderLatencies.length = 0;
      clickCardLatencies.length = 0;
      longTasks.length = 0;
      lastRafNow = null;
      pendingDragInputAt = null;
      pendingClickAt = null;
      memoryStart = getMemorySnapshot();
      currentMetadata = { ...currentMetadata, label };
    },
    recordFrame(frame) {
      frameTimes.push(frame.duration);
      if (lastRafNow !== null) frameDeltas.push(frame.rafNow - lastRafNow);
      lastRafNow = frame.rafNow;

      for (const name of STAGE_NAMES) {
        if (typeof frame.stages[name] === "number") stageTimes[name].push(frame.stages[name]);
      }

      if (typeof frame.proximityChecks === "number") proximityChecks.push(frame.proximityChecks);
      if (typeof frame.proximityEdgesDrawn === "number") proximityEdgesDrawn.push(frame.proximityEdgesDrawn);
    },
    markDragInput() {
      if (pendingDragInputAt === null) pendingDragInputAt = performance.now();
    },
    markRotationFrame() {
      if (pendingDragInputAt === null) return;
      dragRenderLatencies.push(performance.now() - pendingDragInputAt);
      pendingDragInputAt = null;
    },
    markClickStart() {
      pendingClickAt = performance.now();
    },
    markCardVisible() {
      if (pendingClickAt === null) return;
      clickCardLatencies.push(performance.now() - pendingClickAt);
      pendingClickAt = null;
    },
    snapshot() {
      const frameTime = summarize(frameTimes);
      const frameDelta = summarize(frameDeltas);
      const stageSummary = STAGE_NAMES.reduce((summary, name) => {
        const stats = summarize(stageTimes[name]);
        summary[name] = {
          ...stats,
          p95ShareOfFrame: frameTime.p95 ? stats.p95 / frameTime.p95 : 0,
        };
        return summary;
      }, {});
      const memoryEnd = getMemorySnapshot();

      return {
        metadata: currentMetadata,
        frames: {
          count: frameTimes.length,
          fps: frameDelta.avg ? 1000 / frameDelta.avg : 0,
          frameTime,
          frameDelta,
          droppedFrameRatio: frameDeltas.length
            ? frameDeltas.filter((value) => value > DROPPED_FRAME_MS).length / frameDeltas.length
            : 0,
        },
        stages: stageSummary,
        proximity: {
          checks: summarize(proximityChecks),
          edgesDrawn: summarize(proximityEdgesDrawn),
        },
        interactions: {
          dragRenderLatency: summarize(dragRenderLatencies),
          clickCardLatency: summarize(clickCardLatencies),
        },
        longTasks: {
          count: longTasks.length,
          maxDuration: longTasks.length ? Math.max(...longTasks.map((task) => task.duration)) : 0,
          entries: longTasks.slice(-20),
        },
        memory: {
          start: memoryStart,
          end: memoryEnd,
          usedJSHeapDelta: memoryStart && memoryEnd ? memoryEnd.usedJSHeapSize - memoryStart.usedJSHeapSize : null,
        },
      };
    },
    dispose() {
      observer?.disconnect();
    },
  };

  return collector;
}

export function isGraphPerfEnabled() {
  if (import.meta.env.VITE_PERF === "1") return true;
  if (typeof window === "undefined") return false;

  return new URLSearchParams(window.location.search).get("perf") === "1";
}

export function getPerfScaleName() {
  if (!isGraphPerfEnabled() || typeof window === "undefined") return "baseline";
  return new URLSearchParams(window.location.search).get("scale") || "baseline";
}

export function ensureGraphPerfCollector(metadata) {
  if (!isGraphPerfEnabled() || typeof window === "undefined") return null;

  if (!window[PERF_GLOBAL_KEY]?.enabled) {
    window[PERF_GLOBAL_KEY] = createGraphPerfCollector(metadata);
  } else {
    window[PERF_GLOBAL_KEY].updateMetadata(metadata);
  }

  return window[PERF_GLOBAL_KEY];
}

export function getGraphPerfCollector() {
  if (typeof window === "undefined") return null;
  return window[PERF_GLOBAL_KEY] || null;
}

export function createFrameRecorder(collector, rafNow) {
  if (!collector) return null;

  const start = performance.now();
  let lastMark = start;
  const stages = {};

  return {
    stage(name) {
      const now = performance.now();
      stages[name] = now - lastMark;
      lastMark = now;
    },
    end(extra = {}) {
      collector.recordFrame({
        rafNow,
        duration: performance.now() - start,
        stages,
        ...extra,
      });
    },
  };
}
