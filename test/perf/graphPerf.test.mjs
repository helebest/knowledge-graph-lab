import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright-core";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));
const resultDir = fileURLToPath(new URL("../../perf-results/", import.meta.url));
const thresholds = {
  baseline: { frameP95: 16.7, frameP99: 33, longTaskMax: 100 },
  stress: { frameP95: 33, frameP99: 50 },
  drag: { frameP95: 24 },
  click: { cardVisibleMs: 100 },
};

const idleScenarios = [
  {
    name: "desktop-baseline-idle",
    scale: "baseline",
    viewport: { width: 1728, height: 808 },
    deviceScaleFactor: 1,
    durationMs: 10_000,
    budget: "baseline",
  },
  {
    name: "high-dpi-baseline-idle",
    scale: "baseline",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    durationMs: 5_000,
  },
  {
    name: "mobile-baseline-idle",
    scale: "baseline",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    durationMs: 5_000,
  },
  {
    name: "desktop-medium-idle",
    scale: "medium",
    viewport: { width: 1728, height: 808 },
    deviceScaleFactor: 1,
    durationMs: 5_000,
  },
  {
    name: "desktop-stress-idle",
    scale: "stress",
    viewport: { width: 1728, height: 808 },
    deviceScaleFactor: 1,
    durationMs: 5_000,
    budget: "stress",
  },
  {
    name: "desktop-overload-idle",
    scale: "overload",
    viewport: { width: 1728, height: 808 },
    deviceScaleFactor: 1,
    durationMs: 5_000,
  },
];

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeName(name) {
  return name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForUrl(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function startPreview() {
  const port = await getFreePort();
  const viteBin = fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url));
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const url = `http://127.0.0.1:${port}/`;
  await waitForUrl(url);
  return { child, url, output: () => output };
}

async function launchChrome() {
  return chromium.launch({
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || "chrome",
    headless: true,
    args: ["--disable-crash-reporter", "--disable-crashpad"],
  });
}

async function createPerfPage(browser, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: scenario.deviceScaleFactor,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  return { context, page, pageErrors };
}

async function openPerfPage(page, baseUrl, scenario) {
  const url = `${baseUrl}?perf=1&scale=${scenario.scale}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas.graph-canvas", { timeout: 5_000 });
  await page.waitForFunction(() => window.__COZY_GRAPH_PERF__?.snapshot && window.__COZY_GRAPH_TEST_STATE__?.nodes?.length > 0);
  await page.evaluate((label) => window.__COZY_GRAPH_PERF__.reset(label), scenario.name);
  await page.waitForTimeout(350);
}

async function getGraphState(page) {
  return page.evaluate(() => structuredClone(window.__COZY_GRAPH_TEST_STATE__));
}

async function getPerfSnapshot(page) {
  return page.evaluate(() => window.__COZY_GRAPH_PERF__.snapshot());
}

function getNode(state, id) {
  const node = state.nodes.find((item) => item.id === id);
  assert.ok(node, `Missing node ${id}`);
  return node;
}

async function runScenario(browser, baseUrl, scenario, collect) {
  const { context, page, pageErrors } = await createPerfPage(browser, scenario);
  const safeName = sanitizeName(scenario.name);
  let failed = false;

  await context.tracing.start({ screenshots: true, snapshots: true });
  try {
    await openPerfPage(page, baseUrl, scenario);
    const result = await collect(page);

    assert.deepEqual(pageErrors, []);
    await context.tracing.stop();
    await context.close();

    return {
      name: scenario.name,
      scale: scenario.scale,
      viewport: scenario.viewport,
      deviceScaleFactor: scenario.deviceScaleFactor,
      durationMs: scenario.durationMs ?? null,
      budget: scenario.budget ?? null,
      ...result,
    };
  } catch (error) {
    failed = true;
    await mkdir(resultDir, { recursive: true });
    await page.screenshot({ path: `${resultDir}/${safeName}-failure.png`, fullPage: false }).catch(() => {});
    await context.tracing.stop({ path: `${resultDir}/${safeName}-trace.zip` }).catch(() => {});
    throw error;
  } finally {
    if (!failed) await context.close().catch(() => {});
  }
}

async function collectIdle(page, durationMs) {
  await page.waitForTimeout(durationMs);
  return { snapshot: await getPerfSnapshot(page) };
}

async function collectDrag(page) {
  const beforeState = await getGraphState(page);
  const center = getNode(beforeState, "nexus");
  const beforeRotation = beforeState.targetRotation;

  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  for (let step = 1; step <= 120; step += 1) {
    await page.mouse.move(center.x + (260 * step) / 120, center.y + (110 * step) / 120);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const afterState = await getGraphState(page);
  assert.ok(Math.abs(afterState.targetRotation.x - beforeRotation.x) > 0.25);
  assert.ok(Math.abs(afterState.targetRotation.y - beforeRotation.y) > 0.7);

  return { snapshot: await getPerfSnapshot(page) };
}

async function collectFormationSwitch(page) {
  const sequence = ["Engineering", "Product", "Design"];

  for (const formation of sequence) {
    await page.getByRole("button", { name: formation }).click();
    await page.waitForTimeout(1_000);
  }

  return { snapshot: await getPerfSnapshot(page), formations: sequence };
}

async function collectClickCard(page) {
  const state = await getGraphState(page);
  const center = getNode(state, "nexus");
  const clickStart = await page.evaluate(() => performance.now());

  await page.mouse.click(center.x, center.y);
  await page.waitForSelector('aside[data-node-card="true"]', { timeout: 5_000 });

  const cardVisibleMs = await page.evaluate((start) => performance.now() - start, clickStart);
  const cardText = await page.locator('aside[data-node-card="true"]').innerText();
  assert.match(cardText, /NEXUS/i);

  return { cardVisibleMs, snapshot: await getPerfSnapshot(page) };
}

function assertFrameBudget(result, budgetName) {
  const budget = thresholds[budgetName];
  const frameTime = result.snapshot.frames.frameTime;

  assert.ok(
    frameTime.p95 <= budget.frameP95,
    `${result.name} frame p95 ${frameTime.p95.toFixed(2)}ms exceeded ${budget.frameP95}ms`,
  );
  assert.ok(
    frameTime.p99 <= budget.frameP99,
    `${result.name} frame p99 ${frameTime.p99.toFixed(2)}ms exceeded ${budget.frameP99}ms`,
  );

  if (budget.longTaskMax !== undefined) {
    assert.ok(
      result.snapshot.longTasks.maxDuration <= budget.longTaskMax,
      `${result.name} long task ${result.snapshot.longTasks.maxDuration.toFixed(2)}ms exceeded ${budget.longTaskMax}ms`,
    );
  }
}

function assertPerfBudgets(results) {
  for (const result of results) {
    if (result.budget === "baseline") assertFrameBudget(result, "baseline");
    if (result.budget === "stress") assertFrameBudget(result, "stress");
  }

  const drag = results.find((result) => result.name === "desktop-baseline-drag");
  assert.ok(drag, "Missing drag performance result");
  assert.ok(
    drag.snapshot.frames.frameTime.p95 <= thresholds.drag.frameP95,
    `drag frame p95 ${drag.snapshot.frames.frameTime.p95.toFixed(2)}ms exceeded ${thresholds.drag.frameP95}ms`,
  );
  assert.ok(drag.snapshot.interactions.dragRenderLatency.count > 0, "No drag render latency samples were collected");

  const click = results.find((result) => result.name === "desktop-baseline-click-card");
  assert.ok(click, "Missing click-card performance result");
  const internalClickLatency = click.snapshot.interactions.clickCardLatency.p95 || click.cardVisibleMs;
  assert.ok(
    internalClickLatency <= thresholds.click.cardVisibleMs,
    `click card latency ${internalClickLatency.toFixed(2)}ms exceeded ${thresholds.click.cardVisibleMs}ms`,
  );
}

test("graph rendering performance stays within configured budgets", async () => {
  await mkdir(resultDir, { recursive: true });
  const preview = await startPreview();
  const browser = await launchChrome();
  const results = [];

  try {
    for (const scenario of idleScenarios) {
      results.push(await runScenario(browser, preview.url, scenario, (page) => collectIdle(page, scenario.durationMs)));
    }

    results.push(await runScenario(browser, preview.url, {
      name: "desktop-baseline-drag",
      scale: "baseline",
      viewport: { width: 1728, height: 808 },
      deviceScaleFactor: 1,
    }, collectDrag));

    results.push(await runScenario(browser, preview.url, {
      name: "desktop-baseline-formation-switch",
      scale: "baseline",
      viewport: { width: 1728, height: 808 },
      deviceScaleFactor: 1,
    }, collectFormationSwitch));

    results.push(await runScenario(browser, preview.url, {
      name: "desktop-baseline-click-card",
      scale: "baseline",
      viewport: { width: 1728, height: 808 },
      deviceScaleFactor: 1,
    }, collectClickCard));

    assertPerfBudgets(results);

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: preview.url,
      thresholds,
      results,
    };
    const reportPath = `${resultDir}/graph-perf-${timestampSlug()}.json`;
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Graph performance report: ${reportPath}`);
  } finally {
    await browser.close().catch(() => {});
    preview.child.kill("SIGTERM");
    await new Promise((resolve) => {
      preview.child.once("exit", resolve);
      setTimeout(resolve, 1_000);
    });
  }
});
