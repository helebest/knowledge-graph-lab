import { useEffect, useMemo, useRef, useState } from "react";
import { FiCalendar, FiExternalLink, FiLink, FiMoon, FiPause, FiPlay, FiSun, FiUser, FiX } from "react-icons/fi";
import { FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import {
  advanceNodePosition,
  beginDrag,
  endDrag,
  findHitNode,
  pointFromEvent,
  projectNode,
  updateDragRotation,
} from "./graphInteraction.js";
import {
  formations,
  getNodeContent,
  getGraphScaleProfile,
  graphEdges,
  graphNodes,
  nodeTypeLabels,
} from "./graphData.js";
import {
  createFrameRecorder,
  ensureGraphPerfCollector,
  getGraphPerfCollector,
  getPerfScaleName,
  isGraphPerfEnabled,
} from "./graphPerf.js";

const PROXIMITY_RADIUS = 118;
const PROXIMITY_RADIUS_SQ = PROXIMITY_RADIUS * PROXIMITY_RADIUS;

function initials(label) {
  const parts = label.split(/[\s-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function displayUrl(card) {
  const target = card.url || card.github;
  if (!target) return null;
  return card.url ? target.replace(/^https?:\/\/(www\.)?/, "") : target.replace("https://github.com/", "");
}

function hash01(seed) {
  const value = Math.sin(seed * 999.137) * 43758.5453;
  return value - Math.floor(value);
}

function makeDust(count) {
  return Array.from({ length: count }, (_, index) => {
    const angle = hash01(index + 2) * Math.PI * 2;
    const radius = Math.pow(hash01(index + 11), 1.8);

    return {
      angle,
      angleX: Math.cos(angle),
      angleY: Math.sin(angle),
      radius,
      drift: 0.4 + hash01(index + 23) * 1.8,
      depth: 0.25 + hash01(index + 41) * 0.9,
      size: 0.45 + hash01(index + 53) * 1.35,
      seed: hash01(index + 71) * Math.PI * 2,
    };
  });
}

function makeNode(index, width, height, formation, nodeCount) {
  const shortSide = Math.min(width, height);
  const centerX = width * 0.5;
  const centerY = height * 0.53;
  const isHub = index === 0 || index % 11 === 0 || index === 17 || index === 31;
  const radius = index === 0 ? 16 : isHub ? 7 + hash01(index + 4) * 7 : 2 + hash01(index + 7) * 4.2;
  const depth = 0.55 + hash01(index + 17) * 0.55;
  let x;
  let y;
  let z = index === 0 ? 0 : (hash01(index + 61) - 0.5) * shortSide * 0.52;

  if (formation === "Engineering") {
    const t = index / (nodeCount - 1);
    const trackWidth = Math.min(width * 0.55, 850);
    const startX = centerX - trackWidth * 0.45;
    const wave = Math.sin(t * Math.PI * 5.2) * shortSide * 0.04;

    x = startX + trackWidth * t;
    y = centerY + wave + (hash01(index + 33) - 0.5) * shortSide * 0.08;

    if (index < 9) {
      x = startX + shortSide * 0.05 + hash01(index + 46) * 20;
      y = centerY - shortSide * 0.14 + index * shortSide * 0.035;
      z = (index - 4) * shortSide * 0.045;
    }
  } else if (formation === "Product") {
    const spoke = index % 3;
    const spokeAngle = -Math.PI / 2 + spoke * ((Math.PI * 2) / 3);
    const t = Math.floor(index / 3) / Math.ceil(nodeCount / 3);
    const distance = shortSide * (0.08 + t * 0.35);
    const wobble = (hash01(index + 91) - 0.5) * shortSide * 0.09;

    x = centerX + Math.cos(spokeAngle) * distance + Math.cos(spokeAngle + Math.PI / 2) * wobble;
    y = centerY + Math.sin(spokeAngle) * distance * 0.68 + Math.sin(spokeAngle + Math.PI / 2) * wobble * 0.48;
    z = Math.sin(spokeAngle) * distance * 0.5 + (hash01(index + 143) - 0.5) * shortSide * 0.18;
  } else {
    const hubTargets = [
      [0, 0],
      [-0.33, -0.24],
      [-0.2, 0.31],
      [0.2, -0.31],
      [0.36, -0.03],
      [0.19, 0.32],
      [-0.44, 0.1],
    ];
    const hubIndex = [0, 11, 17, 22, 31, 33, 44].indexOf(index);
    const angle = hash01(index + 101) * Math.PI * 2;
    const ring = Math.pow(hash01(index + 109), 0.68);
    const spreadX = Math.min(width * 0.27, 520);
    const spreadY = Math.min(height * 0.32, 260);

    x = centerX + Math.cos(angle) * spreadX * ring + (hash01(index + 131) - 0.5) * 110;
    y = centerY + Math.sin(angle) * spreadY * ring + (hash01(index + 137) - 0.5) * 70;

    if (hubIndex >= 0) {
      x = centerX + hubTargets[hubIndex][0] * spreadX * 1.45;
      y = centerY + hubTargets[hubIndex][1] * spreadY * 1.55;
      z = index === 0 ? 0 : (hubIndex - 3) * shortSide * 0.08;
    }
  }

  const card = getNodeContent(index);

  return { x, y, z, radius, depth, isHub, index, card, labelText: card.label.toUpperCase(), labelVisible: index < graphNodes.length };
}

function drawLine(ctx, from, to, theme, alpha, time, dashed = false) {
  const light = theme === "light";
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = light ? "rgba(20, 20, 20, 0.42)" : "rgba(235, 235, 235, 0.45)";
  ctx.lineWidth = 0.7;
  if (dashed && !ctx.__cozyDashed) {
    ctx.setLineDash([5, 8]);
    ctx.__cozyDashed = true;
  } else if (!dashed && ctx.__cozyDashed) {
    ctx.setLineDash([]);
    ctx.__cozyDashed = false;
  }
  if (dashed) {
    ctx.lineDashOffset = -time * 10;
  } else if (ctx.lineDashOffset !== 0) {
    ctx.lineDashOffset = 0;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawCurve(ctx, from, to, theme, alpha, time) {
  const light = theme === "light";
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - 42 * Math.sin((from.x + to.x) * 0.002 + time);

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = light ? "rgba(18, 18, 18, 0.26)" : "rgba(230, 230, 230, 0.25)";
  ctx.lineWidth = 0.55;
  if (ctx.__cozyDashed) {
    ctx.setLineDash([]);
    ctx.__cozyDashed = false;
  }
  if (ctx.lineDashOffset !== 0) ctx.lineDashOffset = 0;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);
  ctx.stroke();
}

function resetCanvasLineState(ctx) {
  ctx.globalAlpha = 1;
  if (ctx.__cozyDashed) {
    ctx.setLineDash([]);
    ctx.__cozyDashed = false;
  }
  if (ctx.lineDashOffset !== 0) ctx.lineDashOffset = 0;
}

function buildProximityGrid(nodes) {
  const grid = new Map();

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const cellX = Math.floor(node.x / PROXIMITY_RADIUS);
    const cellY = Math.floor(node.y / PROXIMITY_RADIUS);
    const key = `${cellX}:${cellY}`;
    const bucket = grid.get(key);

    if (bucket) {
      bucket.push(index);
    } else {
      grid.set(key, [index]);
    }

    node.cellX = cellX;
    node.cellY = cellY;
  }

  return grid;
}

function drawProximityEdges(ctx, nodes, light) {
  const grid = buildProximityGrid(nodes);
  let proximityChecks = 0;
  let proximityEdgesDrawn = 0;
  const alpha = light ? 0.06 : 0.045;

  resetCanvasLineState(ctx);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = light ? "rgba(20, 20, 20, 0.42)" : "rgba(235, 235, 235, 0.45)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();

  for (const one of nodes) {
    const cellX = one.cellX;
    const cellY = one.cellY;

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const bucket = grid.get(`${cellX + offsetX}:${cellY + offsetY}`);
        if (!bucket) continue;

        for (const index of bucket) {
          const two = nodes[index];
          if (two.index <= one.index) continue;
          proximityChecks += 1;

          const dx = one.x - two.x;
          if (Math.abs(dx) > PROXIMITY_RADIUS) continue;
          const dy = one.y - two.y;
          if (Math.abs(dy) > PROXIMITY_RADIUS) continue;
          if (dx * dx + dy * dy > PROXIMITY_RADIUS_SQ || hash01(one.index * 17 + two.index * 23) < 0.72) continue;

          proximityEdgesDrawn += 1;
          ctx.moveTo(one.x, one.y);
          ctx.lineTo(two.x, two.y);
        }
      }
    }
  }

  if (proximityEdgesDrawn > 0) ctx.stroke();
  ctx.globalAlpha = 1;

  return { proximityChecks, proximityEdgesDrawn };
}

function drawLabels(ctx, nodes, theme, width) {
  const light = theme === "light";
  ctx.textBaseline = "middle";
  ctx.fillStyle = light ? "rgba(18, 18, 18, 0.58)" : "rgba(235, 235, 235, 0.62)";

  let currentFont = "";
  let currentAlign = "";
  for (const node of nodes) {
    if (!node.labelVisible) continue;

    const scale = node.visualScale ?? 1;
    const side = node.x > width * 0.52 ? -1 : 1;
    const y = node.index === 0 ? node.y - Math.max(38, node.radius * scale * 4.6) : node.y - Math.max(16, node.radius * scale * 2.5);
    const x = node.index === 0 ? node.x : node.x + side * Math.max(12, node.radius * scale * 1.5);
    const fontSize = Math.max(7, Math.round(9 * scale * 10) / 10);
    const font = `${fontSize}px "GeistMono", ui-monospace, monospace`;
    const align = node.index === 0 ? "center" : side > 0 ? "left" : "right";

    if (font !== currentFont) {
      ctx.font = font;
      currentFont = font;
    }
    if (align !== currentAlign) {
      ctx.textAlign = align;
      currentAlign = align;
    }
    ctx.fillText(node.labelText, x, y);
  }
}

function drawNodeShape(ctx, node, theme, selected, time) {
  const light = theme === "light";
  const scale = node.visualScale ?? 1;
  const depthFade = Math.max(0.38, Math.min(1, 0.72 + (node.projectedZ ?? 0) / 700));
  const pulse = 1 + Math.sin(time * 1.4 + node.radius) * 0.04;
  const radius = node.radius * scale * pulse * (selected ? 1.35 : 1);
  const halo = radius * (selected ? 4.8 : node.isHub ? 3.2 : 2);

  if (node.isHub || radius > 6 || selected) {
    ctx.fillStyle = light
      ? `rgba(0, 0, 0, ${(selected ? 0.11 : 0.045) * depthFade})`
      : `rgba(255, 255, 255, ${(selected ? 0.13 : 0.055) * depthFade})`;
    ctx.beginPath();
    ctx.arc(node.x, node.y, halo, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = light
      ? `rgba(0, 0, 0, ${(selected ? 0.18 : 0.06) * depthFade})`
      : `rgba(255, 255, 255, ${(selected ? 0.18 : 0.07) * depthFade})`;
    ctx.beginPath();
    ctx.arc(node.x, node.y, halo * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = light
    ? `rgba(22, 22, 22, ${(selected ? 0.82 : 0.58) * depthFade})`
    : `rgba(226, 226, 226, ${(selected ? 0.92 : 0.68) * depthFade})`;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = light ? "rgba(255, 255, 255, 0.34)" : "rgba(255, 255, 255, 0.36)";
  ctx.beginPath();
  ctx.arc(node.x - radius * 0.25, node.y - radius * 0.22, Math.max(1, radius * 0.34), 0, Math.PI * 2);
  ctx.fill();
}

function exposeGraphTestState(nodes, rotation, targetRotation) {
  if ((!import.meta.env.DEV && !isGraphPerfEnabled()) || typeof window === "undefined") return;

  window.__COZY_GRAPH_TEST_STATE__ = {
    rotation: { ...rotation },
    targetRotation: { ...targetRotation },
    nodes: nodes.map((node) => ({
      id: node.card.id,
      index: node.index,
      x: node.x,
      y: node.y,
      z: node.projectedZ ?? 0,
    })),
  };
}

function CozyGraph({ formation, theme, selectedNode, onNodeSelect }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const rotationRef = useRef({ x: -0.14, y: 0.22 });
  const targetRotationRef = useRef({ x: -0.14, y: 0.22 });
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const suppressClickRef = useRef(false);
  const graphScale = useMemo(() => getGraphScaleProfile(getPerfScaleName()), []);
  const perfCollector = useMemo(
    () => ensureGraphPerfCollector({
      scale: graphScale.name,
      nodeCount: graphScale.nodeCount,
      dustCount: graphScale.dustCount,
    }),
    [graphScale],
  );
  const dust = useMemo(() => makeDust(graphScale.dustCount), [graphScale.dustCount]);
  const nodesRef = useRef([]);
  const [dragging, setDragging] = useState(false);

  function handleCanvasClick(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    event.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const point = pointFromEvent(event, rect);

    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    const best = findHitNode(nodesRef.current, point);
    const nextNode = best ? (selectedNode?.index === best.index ? null : { ...best.card, index: best.index }) : null;
    if (nextNode) getGraphPerfCollector()?.markClickStart();
    onNodeSelect(nextNode);
  }

  function handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    suppressClickRef.current = false;
    dragRef.current = beginDrag(pointFromEvent(event), targetRotationRef.current);
    mouseRef.current = { x: event.clientX, y: event.clientY, active: true };
    canvas.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    mouseRef.current = { x: event.clientX, y: event.clientY, active: true };
    if (!dragRef.current.active) return;

    const next = updateDragRotation(dragRef.current, pointFromEvent(event));
    dragRef.current = next.drag;
    targetRotationRef.current = next.rotation;
    if (next.drag.moved) getGraphPerfCollector()?.markDragInput();
    if (next.drag.moved && !dragging) setDragging(true);
  }

  function finishPointerDrag(event) {
    if (!dragRef.current.active) return;

    const finished = endDrag(dragRef.current);
    suppressClickRef.current = finished.suppressClick;
    dragRef.current = finished;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      const nextWidth = window.innerWidth;
      const nextHeight = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      perfCollector?.updateMetadata({
        scale: graphScale.name,
        nodeCount: graphScale.nodeCount,
        dustCount: graphScale.dustCount,
        viewport: { width, height, dpr },
      });

      const nextNodes = Array.from({ length: graphScale.nodeCount }, (_, index) => {
        const target = makeNode(index, width, height, formation, graphScale.nodeCount);
        const current = nodesRef.current[index];
        return {
          ...target,
          x: current?.x ?? target.x + (hash01(index + 201) - 0.5) * 180,
          y: current?.y ?? target.y + (hash01(index + 211) - 0.5) * 110,
          targetZ: target.z,
          targetX: target.x,
          targetY: target.y,
        };
      });
      nodesRef.current = nextNodes;
    }

    function retarget() {
      nodesRef.current = Array.from({ length: graphScale.nodeCount }, (_, index) => {
        const target = makeNode(index, width, height, formation, graphScale.nodeCount);
        const current = nodesRef.current[index] || target;
        return {
          ...current,
          radius: target.radius,
          depth: target.depth,
          isHub: target.isHub,
          card: target.card,
          labelText: target.labelText,
          labelVisible: target.labelVisible,
          targetX: target.x,
          targetY: target.y,
          targetZ: target.z,
        };
      });
    }

    function onMove(event) {
      mouseRef.current = { x: event.clientX, y: event.clientY, active: true };
    }

    function onLeave() {
      mouseRef.current.active = false;
    }

    function render(now) {
      const frameRecorder = createFrameRecorder(perfCollector, now);
      const time = now * 0.001;
      const light = theme === "light";
      context.fillStyle = light ? "#f5f5f5" : "#000";
      context.fillRect(0, 0, width, height);

      const mouse = mouseRef.current;
      const parallaxX = mouse.active ? (mouse.x - width / 2) * 0.012 : 0;
      const parallaxY = mouse.active ? (mouse.y - height / 2) * 0.012 : 0;
      const centerX = width / 2 + parallaxX;
      const centerY = height * 0.52 + parallaxY;
      const graphCenter = { x: width / 2, y: height * 0.53 };

      rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.12;
      rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.12;

      context.fillStyle = light ? "#000" : "#fff";
      for (const speck of dust) {
        const drift = Math.sin(time * speck.drift + speck.seed) * 18;
        const x = centerX + speck.angleX * (width * 0.49) * speck.radius + drift;
        const y = centerY + speck.angleY * (height * 0.48) * speck.radius + drift * 0.18;
        const alpha = light ? 0.08 * speck.depth : 0.11 * speck.depth;

        context.globalAlpha = alpha;
        context.beginPath();
        context.arc(x, y, speck.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      frameRecorder?.stage("backgroundDust");

      const nodes = nodesRef.current;
      const parallax = { x: parallaxX, y: parallaxY };
      for (const node of nodes) {
        const projected = projectNode(node, graphCenter, rotationRef.current, parallax);
        node.projectedZ = projected.z;
        node.visualScale = projected.scale;
        const next = advanceNodePosition(node, projected);
        node.x = next.x;
        node.y = next.y;
      }
      getGraphPerfCollector()?.markRotationFrame();
      exposeGraphTestState(nodes, rotationRef.current, targetRotationRef.current);
      frameRecorder?.stage("projection");

      const contentNodeById = new Map();
      for (const node of nodes) {
        if (node.labelVisible) contentNodeById.set(node.card.id, node);
      }

      for (const edge of graphEdges) {
        const source = contentNodeById.get(edge.source);
        const target = contentNodeById.get(edge.target);
        if (source && target) {
          drawLine(context, source, target, theme, light ? 0.2 : 0.14, time, true);
        }
      }
      frameRecorder?.stage("explicitEdges");

      for (let index = 1; index < nodes.length; index += 1) {
        const node = nodes[index];
        const anchor = nodes[Math.floor(hash01(index + 307) * index)];
        drawLine(context, node, anchor, theme, light ? 0.1 : 0.075, time, index % 3 === 0);

        if (index % 5 === 0) {
          drawCurve(context, nodes[0], node, theme, light ? 0.085 : 0.055, time);
        }
      }
      frameRecorder?.stage("anchorEdges");

      const { proximityChecks, proximityEdgesDrawn } = drawProximityEdges(context, nodes, light);
      resetCanvasLineState(context);
      frameRecorder?.stage("proximityEdges");

      const sortedNodes = [...nodes].sort((a, b) => (a.projectedZ ?? 0) - (b.projectedZ ?? 0));
      const selectedRenderNode = sortedNodes.find((node) => selectedNode?.index === node.index);
      frameRecorder?.stage("depthSort");
      for (const node of sortedNodes) {
        if (selectedRenderNode?.index === node.index) continue;
        drawNodeShape(context, node, theme, false, time);
      }

      if (selectedRenderNode) {
        drawNodeShape(context, selectedRenderNode, theme, true, time);
      }
      frameRecorder?.stage("nodeDraw");

      drawLabels(context, sortedNodes, theme, width);
      frameRecorder?.stage("labelDraw");
      frameRecorder?.end({ proximityChecks, proximityEdgesDrawn });

      frame = requestAnimationFrame(render);
    }

    resize();
    retarget();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [dust, formation, graphScale, perfCollector, selectedNode, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="graph-canvas"
      data-dragging={dragging}
      aria-hidden="true"
      onClick={handleCanvasClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
    />
  );
}

function Waveform({ playing, theme }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let frame = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 120;
    const height = 18;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    function render(now) {
      const time = now * 0.004;
      const light = theme === "light";
      context.clearRect(0, 0, width, height);

      for (let index = 0; index < 24; index += 1) {
        const x = 5 + index * 4.6;
        const lift = playing ? Math.sin(time + index * 0.72) * 4.5 : Math.sin(index * 0.8) * 1.3;
        const y = height / 2 + lift;
        const size = playing ? 1.2 + Math.abs(Math.sin(time + index)) * 1.2 : 1;
        context.fillStyle = light ? "rgba(18, 18, 18, 0.5)" : "rgba(255, 255, 255, 0.48)";
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
      }

      frame = requestAnimationFrame(render);
    }

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [playing, theme]);

  return <canvas ref={canvasRef} className="music-waveform" aria-hidden="true" />;
}

function NodeCard({ node, onClose }) {
  const [imageFailed, setImageFailed] = useState(false);
  const card = node || graphNodes[0];
  const active = Boolean(node);
  const cardIndex = node?.index ?? 0;

  useEffect(() => {
    setImageFailed(false);
  }, [card.id]);

  const target = card.url || card.github;
  const linkLabel = card.url ? "site" : "repo";
  const connections = card.connections ?? 2 + (cardIndex % 7);

  return (
    <aside
      className="node-card"
      data-node-card={active ? "true" : undefined}
      aria-hidden={active ? undefined : "true"}
      aria-label={`${card.label} details`}
      hidden={!active}
    >
      <div className="node-card-inner">
        <button className="node-card-close" type="button" aria-label="Close card" onClick={onClose}>
          <FiX aria-hidden="true" />
        </button>

        <div className="node-card-head">
          <div className="node-card-avatar">
            {card.image && !imageFailed ? (
              <img src={card.image} alt={card.label} onError={() => setImageFailed(true)} />
            ) : (
              <span>{initials(card.label)}</span>
            )}
          </div>
          <div className="node-card-title-group">
            <span className="node-card-type">{nodeTypeLabels[card.type] || card.type}</span>
            <h2>{card.label}</h2>
          </div>
        </div>

        <p className="node-card-description">{card.description}</p>

        <div className="node-card-meta">
          {card.role ? (
            <div>
              <FiUser aria-hidden="true" />
              <span>{card.role}</span>
            </div>
          ) : null}
          {card.period ? (
            <div>
              <FiCalendar aria-hidden="true" />
              <span>{card.period}</span>
            </div>
          ) : null}
          {target ? (
            <div>
              <FiLink aria-hidden="true" />
              <span>{displayUrl(card)}</span>
            </div>
          ) : null}
        </div>

        {card.tags?.length ? (
          <div className="node-card-tags">
            {card.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}

        <div className="node-card-rule" />

        <div className="node-card-section">
          <span>Connections</span>
          <p>{connections} linked nodes in constellation</p>
        </div>

        {card.fullDescription ? (
          <>
            <div className="node-card-rule" />
            <div className="node-card-section">
              <span>About</span>
              <p>{card.fullDescription}</p>
            </div>
          </>
        ) : null}

        {target ? (
          <>
            <div className="node-card-rule" />
            <a className="node-card-link" href={target} target="_blank" rel="noreferrer">
              Visit {linkLabel} <FiExternalLink aria-hidden="true" />
            </a>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function App() {
  const [formation, setFormation] = useState("Design");
  const [theme, setTheme] = useState(getInitialTheme);
  const [playing, setPlaying] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const nextTheme = theme === "dark" ? "light" : "dark";

  useEffect(() => {
    if (selectedNode) getGraphPerfCollector()?.markCardVisible();
  }, [selectedNode]);

  return (
    <main className="cozy-page" data-theme={theme}>
      <CozyGraph
        formation={formation}
        theme={theme}
        selectedNode={selectedNode}
        onNodeSelect={setSelectedNode}
      />

      <header className="header-corner" aria-label="Cozy">
        <div className="header-title-row">
          <h1 className="header-title">Cozy</h1>
          <div className="music-player">
            <button
              className="icon-button play-button"
              type="button"
              aria-label={playing ? "Pause music" : "Play music"}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
            </button>
            <Waveform playing={playing} theme={theme} />
          </div>
        </div>

        <nav className="header-subtitle" aria-label="Formation">
          {formations.map((item, index) => (
            <span className="formation-item" key={item}>
              <button
                className="formation-btn"
                type="button"
                data-active={formation === item}
                onClick={() => setFormation(item)}
              >
                {item}
              </button>
              {index < formations.length - 1 ? <span className="divider">/</span> : null}
            </span>
          ))}
        </nav>
      </header>

      <footer className="bottom-bar" aria-label="Links">
        <div className="bottom-actions">
          <a
            className="icon-button"
            href="https://x.com/vec0zy"
            aria-label="Follow on X (formerly Twitter)"
            target="_blank"
            rel="noreferrer"
          >
            <FaXTwitter aria-hidden="true" />
          </a>
          <a
            className="icon-button"
            href="https://github.com/vxcozy"
            aria-label="View GitHub profile"
            target="_blank"
            rel="noreferrer"
          >
            <FaGithub aria-hidden="true" />
          </a>
          <button
            className="icon-button"
            type="button"
            aria-label={`Switch to ${nextTheme} mode`}
            onClick={() => setTheme(nextTheme)}
          >
            {theme === "dark" ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
          </button>
        </div>
      </footer>

      <NodeCard node={selectedNode} onClose={() => setSelectedNode(null)} />
    </main>
  );
}
