export const formations = ["Design", "Engineering", "Product"];
export const visualNodeCount = 54;
export const dustCount = 640;
export const graphScaleProfiles = {
  baseline: { nodeCount: visualNodeCount, dustCount },
  medium: { nodeCount: 150, dustCount: 640 },
  stress: { nodeCount: 300, dustCount: 1000 },
  overload: { nodeCount: 600, dustCount: 1500 },
};

export const nodeTypeLabels = {
  center: "Hub",
  domain: "Domain",
  capability: "Capability",
  service: "Service",
  workflow: "Workflow",
};

export const graphNodes = [
  {
    id: "nexus",
    label: "Nexus",
    type: "center",
    description: "Composable intelligence graph",
    fullDescription:
      "A generic graph dataset for exploring connected product, engineering, and research workflows without tying the interface to a personal portfolio.",
    role: "System Hub",
    period: "Reference Model",
    connections: 18,
    tags: ["Graph", "Workflow", "Knowledge"],
  },
  {
    id: "research",
    label: "Research",
    type: "domain",
    description: "Exploration and evidence gathering",
    fullDescription:
      "Collects questions, source material, constraints, and working assumptions before a plan or implementation starts.",
    role: "Discovery Layer",
    period: "Always On",
    parentId: "nexus",
    tags: ["Research", "Sources"],
  },
  {
    id: "signal-map",
    label: "Signal Map",
    type: "capability",
    description: "Prioritized evidence and weak signals",
    fullDescription:
      "Turns raw research into a compact map of useful signals, unknowns, conflicts, and decision points.",
    role: "Research Output",
    period: "Pre-Planning",
    parentId: "research",
    tags: ["Signals", "Synthesis"],
  },
  {
    id: "ingestion",
    label: "Ingestion",
    type: "service",
    description: "Structured intake for files and events",
    fullDescription:
      "Normalizes documents, events, records, and external updates into data structures that downstream workflows can consume.",
    role: "Input Service",
    period: "Runtime",
    parentId: "nexus",
    tags: ["Input", "Normalization"],
  },
  {
    id: "data-layer",
    label: "Data Layer",
    type: "service",
    description: "Versioned storage and typed records",
    fullDescription:
      "Stores graph records, source metadata, run artifacts, and derived state in a reusable form.",
    role: "Storage Service",
    period: "Runtime",
    parentId: "ingestion",
    tags: ["Storage", "Schema"],
  },
  {
    id: "semantic-index",
    label: "Semantic Index",
    type: "service",
    description: "Searchable meaning layer",
    fullDescription:
      "Builds embeddings, facets, and lightweight graph references so retrieval can combine semantic and structural context.",
    role: "Index Service",
    period: "Runtime",
    parentId: "ingestion",
    tags: ["Search", "Embedding"],
  },
  {
    id: "retrieval",
    label: "Retrieval",
    type: "capability",
    description: "Context assembly for tasks",
    fullDescription:
      "Selects relevant records, neighboring nodes, constraints, and recent changes before a workflow acts.",
    role: "Context Builder",
    period: "Per Task",
    parentId: "semantic-index",
    tags: ["Context", "Search"],
  },
  {
    id: "memory",
    label: "Memory",
    type: "service",
    description: "Persistent project context",
    fullDescription:
      "Keeps durable decisions, validated assumptions, known pitfalls, and handoff notes available across sessions.",
    role: "Context Store",
    period: "Long-Lived",
    parentId: "nexus",
    tags: ["Memory", "Continuity"],
  },
  {
    id: "planning",
    label: "Planning",
    type: "workflow",
    description: "Turns goals into executable steps",
    fullDescription:
      "Breaks ambiguous goals into scoped work, assumptions, success criteria, and verification checkpoints.",
    role: "Planner",
    period: "Before Execution",
    parentId: "nexus",
    tags: ["Plan", "Scope"],
  },
  {
    id: "execution",
    label: "Execution",
    type: "workflow",
    description: "Applies changes and produces artifacts",
    fullDescription:
      "Runs the concrete implementation loop: modify, inspect, verify, and preserve a reviewable audit trail.",
    role: "Work Runner",
    period: "Per Task",
    parentId: "planning",
    tags: ["Build", "Change"],
  },
  {
    id: "automation",
    label: "Automation",
    type: "service",
    description: "Scheduled and event-driven actions",
    fullDescription:
      "Coordinates recurring jobs, monitors, alerts, and follow-up actions that do not require a human to remain present.",
    role: "Orchestrator",
    period: "Runtime",
    parentId: "execution",
    tags: ["Automation", "Events"],
  },
  {
    id: "evaluation",
    label: "Evaluation",
    type: "workflow",
    description: "Measures correctness and quality",
    fullDescription:
      "Checks outputs against tests, policies, metrics, screenshots, traces, and user-facing acceptance criteria.",
    role: "Verifier",
    period: "After Execution",
    parentId: "nexus",
    tags: ["Testing", "Quality"],
  },
  {
    id: "observability",
    label: "Observability",
    type: "service",
    description: "Metrics, traces, and run insight",
    fullDescription:
      "Surfaces system health, performance regression, long tasks, and anomalies so failures can be located quickly.",
    role: "Telemetry",
    period: "Runtime",
    parentId: "evaluation",
    tags: ["Metrics", "Tracing"],
  },
  {
    id: "governance",
    label: "Governance",
    type: "domain",
    description: "Policy and risk boundaries",
    fullDescription:
      "Defines access, safety limits, review gates, and audit requirements for work that changes shared systems.",
    role: "Control Plane",
    period: "Always On",
    parentId: "nexus",
    tags: ["Policy", "Risk"],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    type: "workflow",
    description: "Human and agent coordination",
    fullDescription:
      "Keeps decisions, requests, reviews, and status updates synchronized across people, tools, and agents.",
    role: "Coordination Layer",
    period: "Per Project",
    parentId: "nexus",
    tags: ["Review", "Handoff"],
  },
  {
    id: "design-system",
    label: "Design System",
    type: "service",
    description: "Reusable interface language",
    fullDescription:
      "Provides components, spacing, visual tokens, and interaction conventions for consistent user-facing work.",
    role: "Interface System",
    period: "Shared",
    parentId: "collaboration",
    tags: ["UI", "Consistency"],
  },
  {
    id: "simulation",
    label: "Simulation",
    type: "capability",
    description: "Scenario modeling before action",
    fullDescription:
      "Explores expected outcomes, edge cases, and failure modes before committing work to the main execution path.",
    role: "Modeling Layer",
    period: "Pre-Execution",
    parentId: "research",
    tags: ["Scenario", "Forecast"],
  },
  {
    id: "knowledge-base",
    label: "Knowledge Base",
    type: "service",
    description: "Curated references and decisions",
    fullDescription:
      "Holds source-backed notes, architecture references, lessons learned, and reusable operating procedures.",
    role: "Reference Library",
    period: "Long-Lived",
    parentId: "research",
    tags: ["Docs", "Decisions"],
  },
];

export const graphEdges = [
  { source: "nexus", target: "research" },
  { source: "research", target: "signal-map" },
  { source: "research", target: "simulation" },
  { source: "research", target: "knowledge-base" },
  { source: "nexus", target: "ingestion" },
  { source: "ingestion", target: "data-layer" },
  { source: "ingestion", target: "semantic-index" },
  { source: "semantic-index", target: "retrieval" },
  { source: "semantic-index", target: "memory" },
  { source: "nexus", target: "memory" },
  { source: "nexus", target: "planning" },
  { source: "planning", target: "execution" },
  { source: "execution", target: "automation" },
  { source: "execution", target: "observability" },
  { source: "nexus", target: "evaluation" },
  { source: "evaluation", target: "observability" },
  { source: "evaluation", target: "governance" },
  { source: "nexus", target: "governance" },
  { source: "nexus", target: "collaboration" },
  { source: "collaboration", target: "design-system" },
  { source: "collaboration", target: "automation" },
  { source: "retrieval", target: "planning" },
  { source: "knowledge-base", target: "retrieval" },
  { source: "observability", target: "memory" },
];

export function getNodeContent(index) {
  return index === 0 ? graphNodes[0] : graphNodes[((index - 1) % (graphNodes.length - 1)) + 1];
}

export function getConnectionCount(nodeId) {
  return graphEdges.filter((edge) => edge.source === nodeId || edge.target === nodeId).length;
}

export function getGraphScaleProfile(name) {
  return graphScaleProfiles[name] ? { name, ...graphScaleProfiles[name] } : { name: "baseline", ...graphScaleProfiles.baseline };
}
