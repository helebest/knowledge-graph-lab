import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FiCalendar, FiExternalLink, FiLink, FiMoon, FiPause, FiPlay, FiSun, FiUser, FiX } from "react-icons/fi";
import { FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import {
  beginDrag,
  endDrag,
  findHitNode,
  pointFromEvent,
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
const PROXIMITY_KEY_STRIDE = 4096;
const CAMERA_Z = 900;
const FULL_CIRCLE = Math.PI * 2;

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
    const angle = hash01(index + 2) * FULL_CIRCLE;
    const radius = Math.pow(hash01(index + 11), 1.8);

    return {
      angle,
      angleX: Math.cos(angle),
      angleY: Math.sin(angle),
      radius,
      drift: 0.4 + hash01(index + 23) * 1.8,
      depth: 0.25 + hash01(index + 41) * 0.9,
      size: 0.45 + hash01(index + 53) * 1.35,
      seed: hash01(index + 71) * FULL_CIRCLE,
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
    const spokeAngle = -Math.PI / 2 + spoke * (FULL_CIRCLE / 3);
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
    const angle = hash01(index + 101) * FULL_CIRCLE;
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

function makeProximityEligibility(nodeCount) {
  const eligible = new Uint8Array(nodeCount * nodeCount);

  for (let a = 0; a < nodeCount; a += 1) {
    for (let b = a + 1; b < nodeCount; b += 1) {
      eligible[a * nodeCount + b] = hash01(a * 17 + b * 23) >= 0.72 ? 1 : 0;
    }
  }

  return eligible;
}

function proximityCellKey(cellX, cellY) {
  return cellX * PROXIMITY_KEY_STRIDE + cellY;
}

function buildProximityGrid(nodes) {
  const grid = new Map();
  const cells = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const cellX = Math.floor(node.x / PROXIMITY_RADIUS);
    const cellY = Math.floor(node.y / PROXIMITY_RADIUS);
    const key = proximityCellKey(cellX, cellY);
    const bucket = grid.get(key);

    if (bucket) {
      bucket.push(index);
    } else {
      const nextBucket = [index];
      grid.set(key, nextBucket);
      cells.push({ cellX, cellY, key, bucket: nextBucket });
    }

    node.cellX = cellX;
    node.cellY = cellY;
  }

  return { grid, cells };
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

function targetToLocal(target, width, height) {
  return {
    x: target.x - width / 2,
    y: height / 2 - target.y,
    z: target.z ?? 0,
  };
}

function createLineBuffer(maxSegments, color, opacity) {
  const positions = new Float32Array(maxSegments * 6);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
  });

  return {
    mesh: new THREE.LineSegments(geometry, material),
    positions,
    attribute,
    maxSegments,
    segmentCount: 0,
  };
}

function beginLineBuffer(buffer) {
  buffer.segmentCount = 0;
}

function writeThreeLine(buffer, from, to) {
  if (buffer.segmentCount >= buffer.maxSegments) return;

  const offset = buffer.segmentCount * 6;
  buffer.positions[offset] = from.localX;
  buffer.positions[offset + 1] = from.localY;
  buffer.positions[offset + 2] = from.localZ;
  buffer.positions[offset + 3] = to.localX;
  buffer.positions[offset + 4] = to.localY;
  buffer.positions[offset + 5] = to.localZ;
  buffer.segmentCount += 1;
}

function writeThreeCurve(buffer, from, to, time) {
  const segments = 8;
  const control = {
    localX: (from.localX + to.localX) / 2,
    localY: (from.localY + to.localY) / 2 + 42 * Math.sin((from.x + to.x) * 0.002 + time),
    localZ: (from.localZ + to.localZ) / 2,
  };
  let previous = from;

  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const inv = 1 - t;
    const point = {
      localX: inv * inv * from.localX + 2 * inv * t * control.localX + t * t * to.localX,
      localY: inv * inv * from.localY + 2 * inv * t * control.localY + t * t * to.localY,
      localZ: inv * inv * from.localZ + 2 * inv * t * control.localZ + t * t * to.localZ,
    };
    writeThreeLine(buffer, previous, point);
    previous = point;
  }
}

function commitLineBuffer(buffer) {
  buffer.mesh.geometry.setDrawRange(0, buffer.segmentCount * 2);
  buffer.attribute.needsUpdate = true;
}

function writeProximityLineBuffer(buffer, nodes, proximityEligibility) {
  const { grid, cells } = buildProximityGrid(nodes);
  let proximityChecks = 0;
  let proximityEdgesDrawn = 0;

  beginLineBuffer(buffer);
  for (const cell of cells) {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const neighborKey = proximityCellKey(cell.cellX + offsetX, cell.cellY + offsetY);
        if (neighborKey < cell.key) continue;

        const bucket = grid.get(neighborKey);
        if (!bucket) continue;

        const sameCell = neighborKey === cell.key;
        for (let leftIndex = 0; leftIndex < cell.bucket.length; leftIndex += 1) {
          const one = nodes[cell.bucket[leftIndex]];
          const rightStart = sameCell ? leftIndex + 1 : 0;

          for (let rightIndex = rightStart; rightIndex < bucket.length; rightIndex += 1) {
            const two = nodes[bucket[rightIndex]];
            proximityChecks += 1;

            const first = one.index < two.index ? one : two;
            const second = one.index < two.index ? two : one;
            if (!proximityEligibility[first.index * nodes.length + second.index]) continue;

            const dx = one.x - two.x;
            if (Math.abs(dx) > PROXIMITY_RADIUS) continue;
            const dy = one.y - two.y;
            if (Math.abs(dy) > PROXIMITY_RADIUS) continue;
            if (dx * dx + dy * dy > PROXIMITY_RADIUS_SQ) continue;

            proximityEdgesDrawn += 1;
            writeThreeLine(buffer, one, two);
          }
        }
      }
    }
  }
  commitLineBuffer(buffer);

  return { proximityChecks, proximityEdgesDrawn };
}

function makeLabelSprite(label, light) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const font = "20px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.font = font;
  const textWidth = Math.ceil(context.measureText(label).width);
  const width = textWidth + 18;
  const height = 32;
  const ratio = 2;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.font = font;
  context.textBaseline = "middle";
  context.textAlign = "center";
  context.fillStyle = light ? "rgba(18, 18, 18, 0.62)" : "rgba(235, 235, 235, 0.68)";
  context.fillText(label, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width * 0.34, height * 0.34, 1);
  sprite.userData.baseScale = { width: width * 0.34, height: height * 0.34 };

  return sprite;
}

function disposeObject3d(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      for (const material of child.material) {
        material.map?.dispose();
        material.dispose();
      }
    } else {
      child.material?.map?.dispose();
      child.material?.dispose();
    }
  });
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
  const proximityEligibility = useMemo(() => makeProximityEligibility(graphScale.nodeCount), [graphScale.nodeCount]);
  const nodesRef = useRef([]);
  const selectedIndexRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    selectedIndexRef.current = selectedNode?.index ?? null;
  }, [selectedNode]);

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
    const light = theme === "light";
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(light ? 0xf5f5f5 : 0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    camera.position.set(0, 0, CAMERA_Z);

    const graphGroup = new THREE.Group();
    graphGroup.rotation.order = "YXZ";
    scene.add(graphGroup);

    const nodeGeometry = new THREE.SphereGeometry(1, 8, 6);
    const haloGeometry = new THREE.SphereGeometry(1, 8, 6);
    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: light ? 0x161616 : 0xe2e2e2,
      transparent: true,
      opacity: light ? 0.68 : 0.78,
    });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: light ? 0x000000 : 0xffffff,
      transparent: true,
      opacity: light ? 0.055 : 0.07,
      depthWrite: false,
    });
    const innerHaloMaterial = new THREE.MeshBasicMaterial({
      color: light ? 0x000000 : 0xffffff,
      transparent: true,
      opacity: light ? 0.075 : 0.09,
      depthWrite: false,
    });
    const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, graphScale.nodeCount);
    const haloMesh = new THREE.InstancedMesh(haloGeometry, haloMaterial, graphScale.nodeCount);
    const innerHaloMesh = new THREE.InstancedMesh(haloGeometry, innerHaloMaterial, graphScale.nodeCount);
    nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    haloMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    innerHaloMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    graphGroup.add(haloMesh, innerHaloMesh, nodeMesh);

    const explicitLines = createLineBuffer(Math.max(graphEdges.length, 1), light ? 0x141414 : 0xebebeb, light ? 0.2 : 0.14);
    const anchorLines = createLineBuffer(graphScale.nodeCount + Math.ceil(graphScale.nodeCount / 5) * 8, light ? 0x141414 : 0xebebeb, light ? 0.1 : 0.075);
    const proximityLines = createLineBuffer(graphScale.nodeCount * 40, light ? 0x141414 : 0xebebeb, light ? 0.06 : 0.045);
    graphGroup.add(explicitLines.mesh, anchorLines.mesh, proximityLines.mesh);

    const dustPositions = new Float32Array(graphScale.dustCount * 3);
    const dustGeometry = new THREE.BufferGeometry();
    const dustAttribute = new THREE.BufferAttribute(dustPositions, 3);
    dustAttribute.setUsage(THREE.DynamicDrawUsage);
    dustGeometry.setAttribute("position", dustAttribute);
    const dustMaterial = new THREE.PointsMaterial({
      color: light ? 0x000000 : 0xffffff,
      opacity: light ? 0.16 : 0.22,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      size: 1.25,
      sizeAttenuation: false,
    });
    const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustPoints);

    const labelSprites = Array.from({ length: graphScale.nodeCount }, (_, index) => {
      if (index >= graphNodes.length) return null;
      const sprite = makeLabelSprite(getNodeContent(index).label.toUpperCase(), light);
      graphGroup.add(sprite);
      return sprite;
    });

    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    const tempProjected = new THREE.Vector3();
    const zeroScale = new THREE.Vector3(0.001, 0.001, 0.001);
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
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * CAMERA_Z)));
      camera.updateProjectionMatrix();
      perfCollector?.updateMetadata({
        scale: graphScale.name,
        nodeCount: graphScale.nodeCount,
        dustCount: graphScale.dustCount,
        viewport: { width, height, dpr },
      });

      const nextNodes = Array.from({ length: graphScale.nodeCount }, (_, index) => {
        const target = makeNode(index, width, height, formation, graphScale.nodeCount);
        const localTarget = targetToLocal(target, width, height);
        const current = nodesRef.current[index];
        return {
          ...target,
          x: current?.x ?? target.x,
          y: current?.y ?? target.y,
          localX: current?.localX ?? localTarget.x + (hash01(index + 201) - 0.5) * 180,
          localY: current?.localY ?? localTarget.y + (hash01(index + 211) - 0.5) * 110,
          localZ: current?.localZ ?? localTarget.z,
          targetZ: target.z,
          targetX: target.x,
          targetY: target.y,
          targetLocalX: localTarget.x,
          targetLocalY: localTarget.y,
          targetLocalZ: localTarget.z,
        };
      });
      nodesRef.current = nextNodes;
    }

    function retarget() {
      nodesRef.current = Array.from({ length: graphScale.nodeCount }, (_, index) => {
        const target = makeNode(index, width, height, formation, graphScale.nodeCount);
        const localTarget = targetToLocal(target, width, height);
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
          targetLocalX: localTarget.x,
          targetLocalY: localTarget.y,
          targetLocalZ: localTarget.z,
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

      const mouse = mouseRef.current;
      const parallaxX = mouse.active ? (mouse.x - width / 2) * 0.012 : 0;
      const parallaxY = mouse.active ? (mouse.y - height / 2) * 0.012 : 0;
      const centerX = width / 2 + parallaxX;
      const centerY = height * 0.52 + parallaxY;
      const dustRadiusX = width * 0.49;
      const dustRadiusY = height * 0.48;

      rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.12;
      rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.12;
      graphGroup.rotation.x = rotationRef.current.x;
      graphGroup.rotation.y = rotationRef.current.y;
      graphGroup.position.set(parallaxX, -parallaxY, 0);

      for (let index = 0; index < dust.length; index += 1) {
        const speck = dust[index];
        const drift = Math.sin(time * speck.drift + speck.seed) * 18;
        const x = centerX + speck.angleX * dustRadiusX * speck.radius + drift;
        const y = centerY + speck.angleY * dustRadiusY * speck.radius + drift * 0.18;
        const offset = index * 3;
        dustPositions[offset] = x - width / 2;
        dustPositions[offset + 1] = height / 2 - y;
        dustPositions[offset + 2] = -260 + speck.depth * 120;
      }
      dustAttribute.needsUpdate = true;
      frameRecorder?.stage("backgroundDust");

      const nodes = nodesRef.current;
      camera.updateMatrixWorld();
      graphGroup.updateMatrixWorld();
      for (const node of nodes) {
        node.localX += ((node.targetLocalX ?? 0) - node.localX) * 0.045;
        node.localY += ((node.targetLocalY ?? 0) - node.localY) * 0.045;
        node.localZ += ((node.targetLocalZ ?? 0) - node.localZ) * 0.045;

        tempProjected.set(node.localX, node.localY, node.localZ).applyMatrix4(graphGroup.matrixWorld);
        node.projectedZ = tempProjected.z;
        node.visualScale = Math.max(0.68, Math.min(1.34, CAMERA_Z / (CAMERA_Z - tempProjected.z)));
        tempProjected.project(camera);
        node.x = (tempProjected.x + 1) * width * 0.5;
        node.y = (1 - tempProjected.y) * height * 0.5;
      }
      getGraphPerfCollector()?.markRotationFrame();
      exposeGraphTestState(nodes, rotationRef.current, targetRotationRef.current);
      frameRecorder?.stage("projection");

      const contentNodeById = new Map();
      for (const node of nodes) {
        if (node.labelVisible) contentNodeById.set(node.card.id, node);
      }

      beginLineBuffer(explicitLines);
      for (const edge of graphEdges) {
        const source = contentNodeById.get(edge.source);
        const target = contentNodeById.get(edge.target);
        if (source && target) {
          writeThreeLine(explicitLines, source, target);
        }
      }
      commitLineBuffer(explicitLines);
      frameRecorder?.stage("explicitEdges");

      beginLineBuffer(anchorLines);
      for (let index = 1; index < nodes.length; index += 1) {
        const node = nodes[index];
        const anchor = nodes[Math.floor(hash01(index + 307) * index)];
        writeThreeLine(anchorLines, node, anchor);

        if (index % 5 === 0) {
          writeThreeCurve(anchorLines, nodes[0], node, time);
        }
      }
      commitLineBuffer(anchorLines);
      frameRecorder?.stage("anchorEdges");

      const { proximityChecks, proximityEdgesDrawn } = writeProximityLineBuffer(proximityLines, nodes, proximityEligibility);
      frameRecorder?.stage("proximityEdges");

      frameRecorder?.stage("depthSort");
      for (const node of nodes) {
        const selected = selectedIndexRef.current === node.index;
        const pulse = 1 + Math.sin(time * 1.4 + node.radius) * 0.04;
        const radius = node.radius * pulse * (selected ? 1.35 : 1);
        const haloVisible = node.isHub || radius > 6 || selected;
        const halo = radius * (selected ? 4.8 : node.isHub ? 3.2 : 2);

        tempPosition.set(node.localX, node.localY, node.localZ);
        tempScale.set(radius, radius, radius);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        nodeMesh.setMatrixAt(node.index, tempMatrix);

        if (haloVisible) {
          tempScale.set(halo, halo, halo);
        } else {
          tempScale.copy(zeroScale);
        }
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        haloMesh.setMatrixAt(node.index, tempMatrix);

        const innerHalo = haloVisible ? halo * 0.45 : 0.001;
        tempScale.set(innerHalo, innerHalo, innerHalo);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        innerHaloMesh.setMatrixAt(node.index, tempMatrix);

        const label = labelSprites[node.index];
        if (label) {
          const side = node.x > width * 0.52 ? -1 : 1;
          const yOffset = node.index === 0 ? Math.max(38, node.radius * node.visualScale * 4.6) : Math.max(16, node.radius * node.visualScale * 2.5);
          const xOffset = node.index === 0 ? 0 : side * Math.max(12, node.radius * node.visualScale * 1.5);
          const baseScale = label.userData.baseScale;
          label.visible = node.labelVisible && (width > 520 || node.index === 0 || node.isHub);
          label.position.set(node.localX + xOffset, node.localY + yOffset, node.localZ);
          label.scale.set(baseScale.width * node.visualScale, baseScale.height * node.visualScale, 1);
        }
      }
      nodeMesh.instanceMatrix.needsUpdate = true;
      haloMesh.instanceMatrix.needsUpdate = true;
      innerHaloMesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
      frameRecorder?.stage("nodeDraw");

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
      disposeObject3d(scene);
      renderer.dispose();
    };
  }, [dust, formation, graphScale, perfCollector, proximityEligibility, theme]);

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
