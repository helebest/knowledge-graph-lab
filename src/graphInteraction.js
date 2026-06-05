export const DRAG_THRESHOLD = 6;
export const ROTATE_SPEED = 0.0045;
export const MAX_ROTATION_X = 0.95;

export function pointFromEvent(event, rect = { left: 0, top: 0 }) {
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function beginDrag(point, rotation) {
  return {
    active: true,
    moved: false,
    startX: point.x,
    startY: point.y,
    originX: rotation.x,
    originY: rotation.y,
  };
}

export function updateDragRotation(drag, point, threshold = DRAG_THRESHOLD) {
  const dx = point.x - drag.startX;
  const dy = point.y - drag.startY;
  const moved = drag.moved || Math.hypot(dx, dy) >= threshold;

  return {
    drag: {
      ...drag,
      moved,
    },
    rotation: moved
      ? {
          x: clamp(drag.originX + dy * ROTATE_SPEED, -MAX_ROTATION_X, MAX_ROTATION_X),
          y: drag.originY + dx * ROTATE_SPEED,
        }
      : {
          x: drag.originX,
          y: drag.originY,
        },
  };
}

export function endDrag(drag) {
  return {
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    suppressClick: Boolean(drag?.moved),
  };
}

export function rotatePoint3d(point, rotation) {
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  const cosY = Math.cos(rotation.y);
  const sinY = Math.sin(rotation.y);

  const y1 = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;
  const x2 = point.x * cosY + z1 * sinY;
  const z2 = -point.x * sinY + z1 * cosY;

  return {
    x: x2,
    y: y1,
    z: z2,
  };
}

export function projectNode(node, center, rotation, parallax = { x: 0, y: 0 }) {
  const rotated = rotatePoint3d(
    {
      x: node.targetX - center.x,
      y: node.targetY - center.y,
      z: node.targetZ ?? 0,
    },
    rotation,
  );
  const perspective = 900 / (900 - rotated.z);
  const scale = clamp(perspective, 0.68, 1.34);

  return {
    x: center.x + rotated.x * scale + parallax.x * node.depth,
    y: center.y + rotated.y * scale + parallax.y * node.depth,
    z: rotated.z,
    scale,
  };
}

export function advanceNodePosition(node, projected, ease = 0.045) {
  return {
    x: node.x + (projected.x - node.x) * ease,
    y: node.y + (projected.y - node.y) * ease,
  };
}

export function hitRadiusForNode(node) {
  const scale = node.visualScale ?? 1;
  return Math.max(node.isHub ? 42 : 28, node.radius * scale * 4.4);
}

export function findHitNode(nodes, point) {
  let best = null;
  let bestDistance = Infinity;
  let bestZ = -Infinity;

  for (const node of nodes) {
    const distance = Math.hypot(node.x - point.x, node.y - point.y);
    if (distance > hitRadiusForNode(node)) continue;

    if (distance < bestDistance || (Math.abs(distance - bestDistance) < 0.001 && (node.projectedZ ?? 0) > bestZ)) {
      best = node;
      bestDistance = distance;
      bestZ = node.projectedZ ?? 0;
    }
  }

  return best;
}
