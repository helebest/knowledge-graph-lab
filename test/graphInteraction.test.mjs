import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceNodePosition,
  beginDrag,
  endDrag,
  findHitNode,
  projectNode,
  updateDragRotation,
} from "../src/graphInteraction.js";

test("mouse proximity does not push a node away from its projected target", () => {
  const node = { x: 100, y: 100 };
  const next = advanceNodePosition(node, { x: 100, y: 100 }, 1);

  assert.deepEqual(next, { x: 100, y: 100 });
});

test("drag beyond threshold updates 3D rotation, not a flat pan offset", () => {
  const drag = beginDrag({ x: 100, y: 100 }, { x: -0.14, y: 0.22 });
  const next = updateDragRotation(drag, { x: 220, y: 160 });

  assert.equal(next.drag.moved, true);
  assert.notEqual(next.rotation.x, -0.14);
  assert.notEqual(next.rotation.y, 0.22);
  assert.equal("pan" in next, false);
  assert.equal(endDrag(next.drag).suppressClick, true);
});

test("small pointer jitter remains a click and preserves rotation", () => {
  const drag = beginDrag({ x: 100, y: 100 }, { x: -0.14, y: 0.22 });
  const next = updateDragRotation(drag, { x: 103, y: 104 });

  assert.equal(next.drag.moved, false);
  assert.deepEqual(next.rotation, { x: -0.14, y: 0.22 });
  assert.equal(endDrag(next.drag).suppressClick, false);
});

test("3D rotation changes projection for off-center nodes", () => {
  const center = { x: 500, y: 300 };
  const node = { targetX: 700, targetY: 320, targetZ: 140, depth: 1 };
  const flat = projectNode(node, center, { x: 0, y: 0 });
  const rotated = projectNode(node, center, { x: 0.35, y: 0.75 });

  assert.notEqual(Math.round(rotated.x), Math.round(flat.x));
  assert.notEqual(Math.round(rotated.y), Math.round(flat.y));
  assert.notEqual(Math.round(rotated.z), Math.round(flat.z));
});

test("center hub stays clickable while the constellation rotates around it", () => {
  const center = { x: 500, y: 300 };
  const node = { targetX: 500, targetY: 300, targetZ: 0, depth: 1 };
  const projected = projectNode(node, center, { x: 0.5, y: -0.8 });

  assert.equal(Math.round(projected.x), center.x);
  assert.equal(Math.round(projected.y), center.y);
});

test("hit testing uses rotated projected positions", () => {
  const nodes = [
    { index: 0, x: 500, y: 300, radius: 16, isHub: true, visualScale: 1.1, projectedZ: 10 },
    { index: 1, x: 620, y: 260, radius: 3, isHub: false, visualScale: 0.9, projectedZ: -40 },
  ];

  assert.equal(findHitNode(nodes, { x: 500, y: 300 })?.index, 0);
  assert.equal(findHitNode(nodes, { x: 620, y: 260 })?.index, 1);
  assert.equal(findHitNode(nodes, { x: 760, y: 420 }), null);
});
