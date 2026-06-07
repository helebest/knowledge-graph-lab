import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { chromium } from "playwright-core";

let baseUrl;
let viteProcess;
let browser;
let page;

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
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function startVite() {
  const port = await getFreePort();
  const viteBin = fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url));
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
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

async function openGraphPage() {
  const pageErrors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas.graph-canvas", { timeout: 5_000 });
  await page.waitForFunction(() => window.__COZY_GRAPH_TEST_STATE__?.nodes?.length > 0);
  await page.waitForTimeout(350);

  assert.deepEqual(pageErrors, []);
}

async function getGraphState() {
  return page.evaluate(() => structuredClone(window.__COZY_GRAPH_TEST_STATE__));
}

function getNode(state, id) {
  const node = state.nodes.find((item) => item.id === id);
  assert.ok(node, `Missing node ${id}`);
  return node;
}

before(async () => {
  const vite = await startVite();
  viteProcess = vite.child;
  baseUrl = vite.url;
  browser = await launchChrome();
  page = await browser.newPage({
    viewport: { width: 1728, height: 808 },
    deviceScaleFactor: 1,
  });
});

beforeEach(async () => {
  await openGraphPage();
});

after(async () => {
  await page?.close().catch(() => {});
  await browser?.close().catch(() => {});

  if (viteProcess) {
    viteProcess.kill("SIGTERM");
    await new Promise((resolve) => {
      viteProcess.once("exit", resolve);
      setTimeout(resolve, 1_000);
    });
  }
});

test("clicking a graph node opens its detail card", async () => {
  const state = await getGraphState();
  const center = getNode(state, "nexus");

  await page.mouse.click(center.x, center.y);
  await page.waitForSelector('aside[data-node-card="true"]', { timeout: 5_000 });

  const cardText = await page.locator('aside[data-node-card="true"]').innerText();
  assert.match(cardText, /NEXUS/i);
  assert.match(cardText, /linked nodes in constellation/i);
});

test("dragging the graph rotates it in 3D instead of panning the plane", async () => {
  const beforeState = await getGraphState();
  const centerBefore = getNode(beforeState, "nexus");
  const offCenterBefore = getNode(beforeState, "semantic-index");

  await page.mouse.move(centerBefore.x, centerBefore.y);
  await page.mouse.down();
  await page.mouse.move(centerBefore.x + 260, centerBefore.y + 110, { steps: 12 });
  await page.mouse.up();

  await page.waitForFunction(
    (previous) => {
      const state = window.__COZY_GRAPH_TEST_STATE__;
      if (!state) return false;
      return Math.abs(state.targetRotation.x - previous.x) > 0.25
        && Math.abs(state.targetRotation.y - previous.y) > 0.7;
    },
    beforeState.targetRotation,
  );
  await page.waitForTimeout(650);

  const afterState = await getGraphState();
  const centerAfter = getNode(afterState, "nexus");
  const offCenterAfter = getNode(afterState, "semantic-index");
  const centerTravel = Math.hypot(centerAfter.x - centerBefore.x, centerAfter.y - centerBefore.y);
  const offCenterTravel = Math.hypot(offCenterAfter.x - offCenterBefore.x, offCenterAfter.y - offCenterBefore.y);
  const maxDepthChange = Math.max(
    ...beforeState.nodes.map((beforeNode) => {
      const afterNode = afterState.nodes.find((item) => item.index === beforeNode.index);
      return Math.abs((afterNode?.z ?? 0) - beforeNode.z);
    }),
  );

  assert.ok(Math.abs(afterState.rotation.x - beforeState.rotation.x) > 0.18);
  assert.ok(Math.abs(afterState.rotation.y - beforeState.rotation.y) > 0.45);
  assert.ok(maxDepthChange > 40, `Expected depth to change under 3D rotation, got ${maxDepthChange}`);
  assert.ok(offCenterTravel > 20, `Expected off-center node to move under rotation, got ${offCenterTravel}`);
  assert.ok(centerTravel < 12, `Expected center node to stay anchored, got ${centerTravel}`);
  assert.equal(await page.locator('aside[data-node-card="true"]').count(), 0);
});

async function settledState() {
  // Park the cursor at viewport center so parallax is zero and consistent across
  // captures, then let the 0.045 position ease settle before reading positions.
  await page.mouse.move(864, 404);
  await page.waitForTimeout(2_000);
  return getGraphState();
}

function positionsByIndex(state) {
  return new Map(state.nodes.map((node) => [node.index, node]));
}

test("switching formation retargets nodes in place and back without rebuilding", async () => {
  const designState = await settledState();
  const designByIndex = positionsByIndex(designState);

  await page.getByRole("button", { name: "Engineering" }).click();
  const engineeringState = await settledState();

  let moved = 0;
  let maxTravel = 0;
  for (const node of engineeringState.nodes) {
    const before = designByIndex.get(node.index);
    if (!before) continue;
    const travel = Math.hypot(node.x - before.x, node.y - before.y);
    if (travel > 20) moved += 1;
    maxTravel = Math.max(maxTravel, travel);
  }

  assert.ok(moved >= 10, `Expected many nodes to move on formation switch, got ${moved}`);
  assert.ok(maxTravel > 60, `Expected a large layout shift between formations, got ${maxTravel}`);
  // Clicking a formation control must not open a node detail card.
  assert.equal(await page.locator('aside[data-node-card="true"]').count(), 0);

  await page.getByRole("button", { name: "Design" }).click();
  const backState = await settledState();

  let maxReturn = 0;
  for (const node of backState.nodes) {
    const before = designByIndex.get(node.index);
    if (!before) continue;
    maxReturn = Math.max(maxReturn, Math.hypot(node.x - before.x, node.y - before.y));
  }

  assert.ok(maxReturn < 15, `Expected nodes to return to the Design layout, got ${maxReturn}`);
});
