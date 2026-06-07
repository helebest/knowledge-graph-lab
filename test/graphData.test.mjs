import assert from "node:assert/strict";
import test from "node:test";
import {
  getConnectionCount,
  getGraphScaleProfile,
  getNodeContent,
  graphScaleProfiles,
  graphEdges,
  graphNodes,
  nodeTypeLabels,
  visualNodeCount,
} from "../src/graphData.js";

test("graph data has unique node ids and enough visual slots", () => {
  const ids = new Set(graphNodes.map((node) => node.id));

  assert.equal(ids.size, graphNodes.length);
  assert.ok(visualNodeCount >= graphNodes.length);
});

test("graph edges only reference existing nodes", () => {
  const ids = new Set(graphNodes.map((node) => node.id));

  for (const edge of graphEdges) {
    assert.ok(ids.has(edge.source), `missing source node: ${edge.source}`);
    assert.ok(ids.has(edge.target), `missing target node: ${edge.target}`);
  }
});

test("node parent ids are represented by canonical graph edges", () => {
  const edgeKeys = new Set(graphEdges.map((edge) => `${edge.source}->${edge.target}`));

  for (const node of graphNodes) {
    if (!node.parentId) continue;
    assert.ok(edgeKeys.has(`${node.parentId}->${node.id}`), `missing parent edge for ${node.id}`);
  }
});

test("every node type has a card label", () => {
  for (const node of graphNodes) {
    assert.equal(typeof nodeTypeLabels[node.type], "string", `missing type label for ${node.type}`);
  }
});

test("visual node content starts with the center node and cycles through content nodes", () => {
  assert.equal(getNodeContent(0).id, "nexus");
  assert.equal(getNodeContent(1).id, graphNodes[1].id);
  assert.equal(getNodeContent(graphNodes.length).id, graphNodes[1].id);
  assert.equal(getNodeContent(visualNodeCount - 1).id, graphNodes[(visualNodeCount - 2) % (graphNodes.length - 1) + 1].id);
});

test("connection counts are derived from edges", () => {
  for (const node of graphNodes) {
    const expected = graphEdges.filter((edge) => edge.source === node.id || edge.target === node.id).length;
    assert.equal(getConnectionCount(node.id), expected);
  }
});

test("graph performance scale profiles are explicit and bounded", () => {
  assert.deepEqual(Object.keys(graphScaleProfiles), ["baseline", "medium", "stress", "overload"]);
  assert.deepEqual(getGraphScaleProfile("baseline"), { name: "baseline", nodeCount: 54, dustCount: 640 });
  assert.deepEqual(getGraphScaleProfile("medium"), { name: "medium", nodeCount: 150, dustCount: 640 });
  assert.deepEqual(getGraphScaleProfile("stress"), { name: "stress", nodeCount: 300, dustCount: 1000 });
  assert.deepEqual(getGraphScaleProfile("overload"), { name: "overload", nodeCount: 600, dustCount: 1500 });
  assert.equal(getGraphScaleProfile("unknown").name, "baseline");
});
