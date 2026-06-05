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
  project: "Solo Project",
  studio: "Studio",
  "studio-project": "Project",
};

export const graphNodes = [
  {
    id: "cozy",
    label: "Cozy",
    type: "center",
    description: "One must imagine oneself cozy",
    fullDescription:
      "Builder across design, engineering, and product. Focused on agent infrastructure, decentralized protocols, and creative tooling.",
    role: "Builder",
    period: "2017 - Present",
    image: "https://github.com/vxcozy.png",
    connections: 21,
    tags: ["Design", "Engineering", "Product"],
  },
  {
    id: "hd2runs",
    label: "HD2Runs",
    type: "project",
    description: "Helldivers 2 challenges & analytics",
    fullDescription:
      "Community-driven challenge tracker and analytics dashboard for Helldivers 2 gameplay data.",
    role: "Creator",
    period: "2024",
    url: "https://hd2run.vercel.app/",
    github: "https://github.com/vxcozy/hd2runs",
    image: "https://www.google.com/s2/favicons?domain=hd2run.vercel.app&sz=64",
    parentId: "cozy",
    tags: ["Gaming", "Analytics"],
  },
  {
    id: "coziest-tools",
    label: "Coziest Tools",
    type: "project",
    description: "Collection of developer utilities",
    fullDescription:
      "A curated set of developer utilities for everyday workflows, built for speed and simplicity.",
    role: "Creator",
    period: "2026",
    url: "https://coziest.tools/",
    github: "https://github.com/vxcozy/coziest.tools",
    image: "https://www.google.com/s2/favicons?domain=coziest.tools&sz=64",
    parentId: "cozy",
    tags: ["DevTools", "Utilities"],
  },
  {
    id: "aitelier",
    label: "Aitelier",
    type: "project",
    description: "Agent powered creative studio",
    fullDescription:
      "Creative studio powered by AI agents for generative design, content production, and artistic collaboration.",
    role: "Creator",
    period: "2026",
    url: "https://aitelier.design/",
    github: "https://github.com/vxcozy/aitelier",
    image: "https://www.google.com/s2/favicons?domain=aitelier.design&sz=64",
    parentId: "cozy",
    tags: ["AI", "Creative Tools"],
  },
  {
    id: "bridge-ws",
    label: "Bridge-WS",
    type: "project",
    description: "WebSocket bridge for local LLM development",
    fullDescription:
      "WebSocket bridge layer enabling real-time communication between local LLM instances and frontend clients.",
    role: "Creator",
    period: "2026",
    github: "https://github.com/vxcozy/bridge-ws",
    parentId: "cozy",
    tags: ["LLM", "WebSocket", "Infrastructure"],
  },
  {
    id: "local-llm-proxy",
    label: "Local LLM Proxy",
    type: "project",
    description: "Local proxy for LLM API routing",
    fullDescription:
      "Lightweight proxy server for routing and managing LLM API calls across multiple local and remote model providers.",
    role: "Creator",
    period: "2026",
    github: "https://github.com/vxcozy/local-llm-proxy",
    parentId: "cozy",
    tags: ["LLM", "Proxy", "API"],
  },
  {
    id: "flappyboards",
    label: "FlappyBoards",
    type: "project",
    description: "Turn any TV into a retro split-flap display",
    fullDescription:
      "Free and open source split-flap display simulator. Turn any TV or monitor into a retro mechanical departure board with customizable messages.",
    role: "Creator",
    period: "2026",
    url: "https://flappyboards.xyz",
    github: "https://github.com/vxcozy/flappyboards",
    image: "https://www.google.com/s2/favicons?domain=flappyboards.xyz&sz=64",
    parentId: "cozy",
    tags: ["Open Source", "Display", "Retro"],
  },
  {
    id: "clitunes",
    label: "CLITunes",
    type: "project",
    description: "TUI music visualizer",
    fullDescription:
      "A terminal music visualizer and player built in Rust, focused on making command-line interfaces feel expressive.",
    role: "Creator",
    period: "2026",
    github: "https://github.com/vxcozy/clitunes",
    parentId: "cozy",
    tags: ["Rust", "TUI", "Music"],
  },
  {
    id: "constellation",
    label: "Constellation",
    type: "project",
    description: "Interactive 3D portfolio template",
    fullDescription:
      "Open source template for an interactive 3D portfolio constellation: a hub-and-spoke graph built with Next.js, React Three Fiber, and Three.js.",
    role: "Creator",
    period: "2026",
    github: "https://github.com/vxcozy/constellation",
    parentId: "cozy",
    tags: ["Three.js", "Next.js", "Template"],
  },
  {
    id: "contribution-constellation",
    label: "Contribution Constellation",
    type: "project",
    description: "3D GitHub contribution graph",
    fullDescription:
      "Interactive 3D GitHub contribution graph built with Three.js that turns commit history into a navigable spatial constellation.",
    role: "Creator",
    period: "2026",
    github: "https://github.com/vxcozy/contribution-constellation",
    parentId: "cozy",
    tags: ["Three.js", "GitHub", "Visualization"],
  },
  {
    id: "games",
    label: "Games",
    type: "studio",
    description: "Multiplayer game development",
    fullDescription:
      "Personal game studio building multiplayer experiences, from card games to puzzle mechanics.",
    role: "Creator",
    period: "2025 - Present",
    parentId: "cozy",
    tags: ["Gaming", "Multiplayer"],
  },
  {
    id: "blockz",
    label: "Blockz",
    type: "studio-project",
    description: "Block-based puzzle game",
    fullDescription:
      "Minimalist block-stacking puzzle game with competitive scoring and clean visual design.",
    role: "Creator",
    period: "2025",
    url: "https://blockz.tech",
    github: "https://github.com/vxcozy/blocker",
    image: "https://www.google.com/s2/favicons?domain=blockz.tech&sz=64",
    parentId: "games",
    tags: ["Puzzle", "Game"],
  },
  {
    id: "tien-len",
    label: "Tien Len",
    type: "studio-project",
    description: "Vietnamese card game",
    fullDescription:
      "Multiplayer implementation of the Vietnamese card game Tien Len with real-time matchmaking and lobby system.",
    role: "Creator",
    period: "2026",
    url: "https://tien-len-ruby.vercel.app/",
    github: "https://github.com/vxcozy/tien-len",
    image: "https://www.google.com/s2/favicons?domain=tien-len-ruby.vercel.app&sz=64",
    parentId: "games",
    tags: ["Cards", "Multiplayer"],
  },
  {
    id: "21e8",
    label: "21e8",
    type: "studio",
    description: "Product studio of tomorrow",
    fullDescription:
      "Forward-thinking product studio building at the intersection of cryptography, identity, and decentralized infrastructure.",
    role: "Contributor",
    period: "2019 - Present",
    url: "https://21e8.nz",
    image: "https://github.com/21e8.png",
    parentId: "cozy",
    tags: ["Crypto", "Product Studio"],
  },
  {
    id: "ch4p-labs",
    label: "Ch4p Labs",
    type: "studio",
    description: "Protocol research & development",
    fullDescription:
      "Research lab focused on secure agentic runtimes and protocol-level standards for autonomous systems.",
    role: "Creator",
    period: "2026",
    github: "https://github.com/ch4p-labs",
    image: "https://github.com/ch4p-labs.png",
    parentId: "cozy",
    tags: ["Agents", "Protocols", "Research"],
  },
  {
    id: "tome",
    label: "Tome",
    type: "studio-project",
    description: "Beautiful docs engine",
    fullDescription:
      "Opinionated documentation engine that prioritizes readability, typography, and developer experience.",
    role: "Creator",
    period: "2026",
    url: "https://tome.center",
    github: "https://github.com/tomehq/tome",
    image: "https://www.google.com/s2/favicons?domain=tome.center&sz=64",
    parentId: "cozy",
    tags: ["Docs", "SSG"],
  },
  {
    id: "ouroborai-labs",
    label: "Ouroborai Labs",
    type: "studio",
    description: "AI research lab",
    fullDescription:
      "Research lab exploring recursive self-improvement, autonomous agent architectures, and decentralized AI infrastructure.",
    role: "Creator",
    period: "2026 - Present",
    github: "https://github.com/ouroborai-labs",
    image: "https://github.com/ouroborai-labs.png",
    parentId: "cozy",
    tags: ["AI", "Research", "Agents"],
  },
  {
    id: "premia",
    label: "Premia",
    type: "studio-project",
    description: "Decentralized options protocol",
    fullDescription:
      "Peer-to-pool options protocol with dynamic pricing powered by concentrated liquidity and volatility oracles.",
    role: "Contributor",
    period: "2021 - 2025",
    url: "https://premia.blue",
    image: "https://www.google.com/s2/favicons?domain=premia.blue&sz=64",
    parentId: "cozy",
    tags: ["Options", "AMM"],
  },
];

export const graphEdges = graphNodes
  .filter((node) => node.parentId)
  .map((node) => ({
    source: node.parentId,
    target: node.id,
  }));

export function getNodeContent(index) {
  return index === 0 ? graphNodes[0] : graphNodes[((index - 1) % (graphNodes.length - 1)) + 1];
}

export function getConnectionCount(nodeId) {
  return graphEdges.filter((edge) => edge.source === nodeId || edge.target === nodeId).length;
}

export function getGraphScaleProfile(name) {
  return graphScaleProfiles[name] ? { name, ...graphScaleProfiles[name] } : { name: "baseline", ...graphScaleProfiles.baseline };
}
