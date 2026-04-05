<template>
  <div class="workspace-graph-root" :class="{ 'is-dark': isDark }">
    <section class="workspace-graph-shell" :class="{ 'is-dark': isDark }">
      <div class="workspace-graph-settings">
        <button class="workspace-graph-settings-btn" @click="showSettings = !showSettings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </button>
        <div v-if="showSettings" class="workspace-graph-settings-panel">
          <label class="workspace-graph-setting-item">
            <input v-model="showArrows" type="checkbox" />
            <span>显示箭头</span>
          </label>
          <label class="workspace-graph-setting-item">
            <input v-model="showLabels" type="checkbox" />
            <span>显示文件名</span>
          </label>
        </div>
      </div>

      <div class="workspace-graph-body">
        <div
          ref="viewportRef"
          class="workspace-graph-viewport"
          :class="{ 'is-panning': dragState.type === 'pan' }"
          @wheel.prevent="handleWheel"
          @pointerdown="handleViewportPointerDown"
        >
          <svg
            ref="svgRef"
            class="workspace-graph-svg"
            :viewBox="svgViewBox"
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="workspace-graph-arrow"
                markerWidth="5"
                markerHeight="5"
                refX="2.5"
                refY="1.25"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,2.5 L5,1.25 z" fill="var(--yc-graph-arrow)" />
              </marker>
            </defs>

            <g :transform="graphTransform">
              <line
                v-for="edge in visualEdges"
                :key="edge.id"
                class="workspace-graph-edge"
                :class="{
                  'is-dimmed': isEdgeDimmed(edge),
                  'is-highlighted': isEdgeHighlighted(edge)
                }"
                :x1="edge.edgeX1"
                :y1="edge.edgeY1"
                :x2="edge.edgeX2"
                :y2="edge.edgeY2"
                :stroke-width="hoveredNodeId ? edgeStrokeWidth(edge) * 0.6 : edgeStrokeWidth(edge)"
                :marker-end="showArrows ? 'url(#workspace-graph-arrow)' : null"
              />

              <g
                v-for="node in simNodes"
                :key="node.id"
                class="workspace-graph-node"
                :class="{
                  'is-hovered': hoveredNodeId === node.id,
                  'is-dimmed': hoveredNodeId && hoveredNodeId !== node.id
                }"
                :transform="`translate(${node.x} ${node.y})`"
                @pointerenter="hoveredNodeId = node.id; $emit('hover', node.id)"
                @pointerleave="hoveredNodeId = ''; $emit('hover', '')"
                @pointerdown="handleNodePointerDown($event, node)"
              >
                <circle
                  class="workspace-graph-node-circle"
                  :r="node.radius"
                  :fill="hoveredNodeId === node.id ? '#f97316' : '#94a3b8'"
                />
                <text
                  v-if="showLabels && labelsVisible"
                  class="workspace-graph-node-label"
                  :x="0"
                  :y="node.radius + 14"
                >
                  {{ getFileName(node.relPath) }}
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  graphData: {
    type: Object,
    default: () => ({
      nodes: [],
      edges: [],
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        isolatedCount: 0
      },
      groups: {
        folders: [],
        tags: []
      }
    })
  },
  activeRelPath: {
    type: String,
    default: ""
  },
  isDark: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close", "open-note", "hover"]);

const FORCE_LINK_DISTANCE = 104;
const FORCE_CENTERING = 0.0012;
const FORCE_DAMPING = 0.9;
const FORCE_REPULSION = 4800;
const FORCE_BOUNDARY_PADDING = 72;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.85;

const viewportRef = ref(null);
const svgRef = ref(null);
const simNodes = ref([]);
const simEdges = ref([]);
const hoveredNodeId = ref("");
const showArrows = ref(true);
const showLabels = ref(true);
const showSettings = ref(false);
const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const viewportSize = ref({ width: 1200, height: 760 });
const dragState = ref({
  type: "",
  pointerId: null,
  nodeId: "",
  moved: false,
  startClientX: 0,
  startClientY: 0,
  originPanX: 0,
  originPanY: 0
});

let animationFrame = 0;
let resizeObserver = null;

const nodeMap = computed(() => new Map(simNodes.value.map((node) => [node.id, node])));

const labelsVisible = computed(() => zoom.value >= 0.8);

const visualEdges = computed(() => {
  const nodePosMap = new Map();
  for (const node of simNodes.value) {
    nodePosMap.set(node.id, { x: node.x, y: node.y, r: node.radius });
  }

  return simEdges.value
    .map((edge) => {
      const source = nodePosMap.get(edge.sourceId);
      const target = nodePosMap.get(edge.targetId);
      if (!source || !target) return null;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return { ...edge, edgeX1: source.x, edgeY1: source.y, edgeX2: target.x, edgeY2: target.y };

      const r1 = source.r || 6;
      const r2 = target.r || 6;
      const edgeX1 = source.x + (dx / dist) * r1;
      const edgeY1 = source.y + (dy / dist) * r1;
      const edgeX2 = target.x - (dx / dist) * r2;
      const edgeY2 = target.y - (dy / dist) * r2;

      return { ...edge, edgeX1, edgeY1, edgeX2, edgeY2 };
    })
    .filter(Boolean);
});

const highlightedNodeIds = computed(() => {
  if (!hoveredNodeId.value) {
    return null;
  }
  const output = new Set([hoveredNodeId.value]);
  for (const edge of simEdges.value) {
    if (edge.sourceId === hoveredNodeId.value) {
      output.add(edge.targetId);
    } else if (edge.targetId === hoveredNodeId.value) {
      output.add(edge.sourceId);
    }
  }
  return output;
});

const svgViewBox = computed(() =>
  `0 0 ${Math.max(1, Number(viewportSize.value.width || 0))} ${Math.max(1, Number(viewportSize.value.height || 0))}`
);

const graphTransform = computed(() => `translate(${pan.value.x} ${pan.value.y}) scale(${zoom.value})`);

const getFileName = (relPath) => {
  if (!relPath) return "";
  const parts = relPath.split("/");
  return parts[parts.length - 1] || relPath;
};

const isEdgeHighlighted = (edge) =>
  hoveredNodeId.value
    && (edge.sourceId === hoveredNodeId.value || edge.targetId === hoveredNodeId.value);

const isEdgeDimmed = (edge) =>
  Boolean(hoveredNodeId.value && !isEdgeHighlighted(edge));

const edgeStrokeWidth = (edge) => 1.1 + Math.log2(Number(edge?.count || 1) + 1) * 0.9;

const stopSimulation = () => {
  if (!animationFrame) {
    return;
  }
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
};

const updateViewportSize = () => {
  if (!viewportRef.value) {
    return;
  }
  const rect = viewportRef.value.getBoundingClientRect();
  viewportSize.value = {
    width: Math.max(320, Math.round(rect.width || 0)),
    height: Math.max(320, Math.round(rect.height || 0))
  };
};

const createSpiralPosition = (index, total) => {
  const width = viewportSize.value.width;
  const height = viewportSize.value.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  const orbit = 96 + Math.sqrt(index + 1) * 42;
  return {
    x: centerX + Math.cos(angle) * orbit,
    y: centerY + Math.sin(angle) * orbit
  };
};

const initializeSimulation = (forceReset = false) => {
  const sourceNodes = Array.isArray(props.graphData?.nodes) ? props.graphData.nodes : [];
  const sourceEdges = Array.isArray(props.graphData?.edges) ? props.graphData.edges : [];
  const previous = new Map(simNodes.value.map((node) => [node.id, node]));

  simNodes.value = sourceNodes.map((node, index) => {
    const existing = !forceReset ? previous.get(node.id) : null;
    const position = existing || createSpiralPosition(index, sourceNodes.length);
    return {
      ...node,
      x: Number(existing?.x ?? position.x ?? 0),
      y: Number(existing?.y ?? position.y ?? 0),
      vx: Number(existing?.vx || 0),
      vy: Number(existing?.vy || 0),
      fx: null,
      fy: null
    };
  });

  simEdges.value = sourceEdges.map((edge) => ({
    ...edge,
    strength: Number(edge?.strength || 1)
  }));

  if (forceReset) {
    zoom.value = 1;
    pan.value = { x: 0, y: 0 };
  }

  stopSimulation();
  const tick = () => {
    runSimulationStep();
    animationFrame = window.requestAnimationFrame(tick);
  };
  animationFrame = window.requestAnimationFrame(tick);
};

const runSimulationStep = () => {
  const nodes = simNodes.value;
  const edges = simEdges.value;
  if (!nodes.length) {
    return;
  }

  const width = viewportSize.value.width;
  const height = viewportSize.value.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const nodeCount = nodes.length;

  for (let index = 0; index < nodeCount; index += 1) {
    const node = nodes[index];
    if (node.fx != null && node.fy != null) {
      node.x = Number(node.fx);
      node.y = Number(node.fy);
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx += (centerX - node.x) * FORCE_CENTERING;
    node.vy += (centerY - node.y) * FORCE_CENTERING;

    if (node.isolated) {
      node.vx += (node.x - centerX) * 0.0004;
      node.vy += (node.y - centerY) * 0.0004;
    }
  }

  for (let leftIndex = 0; leftIndex < nodeCount; leftIndex += 1) {
    const left = nodes[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < nodeCount; rightIndex += 1) {
      if (nodeCount > 180 && ((leftIndex + rightIndex) % 2 === 1)) {
        continue;
      }

      const right = nodes[rightIndex];
      let dx = right.x - left.x;
      let dy = right.y - left.y;
      let distanceSquared = (dx * dx) + (dy * dy);
      if (distanceSquared < 1) {
        dx = (Math.random() - 0.5) * 0.5;
        dy = (Math.random() - 0.5) * 0.5;
        distanceSquared = (dx * dx) + (dy * dy) + 0.01;
      }

      const distance = Math.sqrt(distanceSquared);
      const force = FORCE_REPULSION / distanceSquared;
      const pushX = (dx / distance) * force;
      const pushY = (dy / distance) * force;

      left.vx -= pushX;
      left.vy -= pushY;
      right.vx += pushX;
      right.vy += pushY;
    }
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    if (!source || !target) {
      continue;
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired = FORCE_LINK_DISTANCE + (source.radius + target.radius) * 1.4 + (Number(edge.count || 1) - 1) * 10;
    const pull = (distance - desired) * 0.0023 * Number(edge.strength || 1);
    const pullX = (dx / distance) * pull;
    const pullY = (dy / distance) * pull;

    source.vx += pullX;
    source.vy += pullY;
    target.vx -= pullX;
    target.vy -= pullY;
  }

  for (const node of nodes) {
    if (node.fx != null && node.fy != null) {
      node.x = Number(node.fx);
      node.y = Number(node.fy);
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx *= FORCE_DAMPING;
    node.vy *= FORCE_DAMPING;
    node.x += node.vx;
    node.y += node.vy;

    const padding = FORCE_BOUNDARY_PADDING;
    if (node.x < padding) {
      node.x = padding;
      node.vx *= -0.38;
    } else if (node.x > width - padding) {
      node.x = width - padding;
      node.vx *= -0.38;
    }

    if (node.y < padding) {
      node.y = padding;
      node.vy *= -0.38;
    } else if (node.y > height - padding) {
      node.y = height - padding;
      node.vy *= -0.38;
    }
  };
};

const toGraphPoint = (clientX, clientY) => {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) {
    return { x: 0, y: 0 };
  }

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: (localX - pan.value.x) / zoom.value,
    y: (localY - pan.value.y) / zoom.value
  };
};

const resetLayout = () => {
  initializeSimulation(true);
};

const handleWheel = (event) => {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) {
    return;
  }

  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const graphPoint = toGraphPoint(event.clientX, event.clientY);
  const nextZoom = Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, zoom.value * (event.deltaY > 0 ? 0.92 : 1.08))
  );

  pan.value = {
    x: localX - graphPoint.x * nextZoom,
    y: localY - graphPoint.y * nextZoom
  };
  zoom.value = nextZoom;
};

const handleViewportPointerDown = (event) => {
  if (event.button !== 0) {
    return;
  }

  dragState.value = {
    type: "pan",
    pointerId: event.pointerId,
    nodeId: "",
    moved: false,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originPanX: pan.value.x,
    originPanY: pan.value.y
  };
};

const handleNodePointerDown = (event, node) => {
  if (event.button !== 0) {
    return;
  }

  event.stopPropagation();
  const point = toGraphPoint(event.clientX, event.clientY);
  node.fx = point.x;
  node.fy = point.y;
  dragState.value = {
    type: "node",
    pointerId: event.pointerId,
    nodeId: node.id,
    moved: false,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originPanX: pan.value.x,
    originPanY: pan.value.y
  };
};

const handleWindowPointerMove = (event) => {
  if (!dragState.value.type || dragState.value.pointerId !== event.pointerId) {
    return;
  }

  const movedEnough = Math.abs(event.clientX - dragState.value.startClientX) > 3
    || Math.abs(event.clientY - dragState.value.startClientY) > 3;
  if (movedEnough) {
    dragState.value = {
      ...dragState.value,
      moved: true
    };
  }

  if (dragState.value.type === "pan") {
    pan.value = {
      x: dragState.value.originPanX + (event.clientX - dragState.value.startClientX),
      y: dragState.value.originPanY + (event.clientY - dragState.value.startClientY)
    };
    return;
  }

  if (dragState.value.type === "node") {
    const node = nodeMap.value.get(dragState.value.nodeId);
    if (!node) {
      return;
    }
    const point = toGraphPoint(event.clientX, event.clientY);
    node.fx = point.x;
    node.fy = point.y;
    node.x = point.x;
    node.y = point.y;
  }
};

const handleWindowPointerUp = (event) => {
  if (!dragState.value.type || dragState.value.pointerId !== event.pointerId) {
    return;
  }

  if (dragState.value.type === "node") {
    const node = nodeMap.value.get(dragState.value.nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
      if (!dragState.value.moved) {
        emit("open-note", node.relPath);
      }
    }
  }

  dragState.value = {
    type: "",
    pointerId: null,
    nodeId: "",
    moved: false,
    startClientX: 0,
    startClientY: 0,
    originPanX: 0,
    originPanY: 0
  };
};

const handleWindowKeydown = (event) => {
  if (event.key === "Escape") {
    emit("close");
  }
};

watch(
  () => [props.graphData, viewportSize.value.width, viewportSize.value.height],
  () => {
    initializeSimulation(simNodes.value.length === 0);
  },
  { immediate: true }
);

onMounted(() => {
  updateViewportSize();
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      updateViewportSize();
    });
    if (viewportRef.value) {
      resizeObserver.observe(viewportRef.value);
    }
  } else {
    window.addEventListener("resize", updateViewportSize);
  }
  window.addEventListener("pointermove", handleWindowPointerMove);
  window.addEventListener("pointerup", handleWindowPointerUp);
  window.addEventListener("keydown", handleWindowKeydown);
});

onBeforeUnmount(() => {
  stopSimulation();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", updateViewportSize);
  window.removeEventListener("pointermove", handleWindowPointerMove);
  window.removeEventListener("pointerup", handleWindowPointerUp);
  window.removeEventListener("keydown", handleWindowKeydown);
});
</script>

<style scoped>
.workspace-graph-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--yc-bg-panel);
}

.workspace-graph-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  box-shadow: none;
  position: relative;
}

.workspace-graph-settings {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.workspace-graph-settings-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--yc-bg-overlay);
  border-radius: 8px;
  color: var(--yc-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.workspace-graph-settings-btn:hover {
  background: var(--yc-bg-subtle-hover);
  color: var(--yc-text-primary);
}

.workspace-graph-settings-panel {
  position: absolute;
  top: 40px;
  right: 0;
  background: var(--yc-bg-overlay);
  border: 1px solid var(--yc-border-strong);
  border-radius: 10px;
  padding: 8px;
  min-width: 140px;
  box-shadow: var(--yc-shadow-panel);
}

.workspace-graph-setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  font-size: 13px;
  color: var(--yc-text-secondary);
  cursor: pointer;
  border-radius: 6px;
}

.workspace-graph-setting-item:hover {
  background: var(--yc-bg-subtle-hover);
}

.workspace-graph-setting-item input {
  width: 14px;
  height: 14px;
}

.workspace-graph-body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.workspace-graph-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
}

.workspace-graph-viewport.is-panning {
  cursor: grabbing;
}

.workspace-graph-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.workspace-graph-edge {
  stroke: var(--yc-graph-edge);
  transition: stroke-opacity 0.15s ease;
}

.workspace-graph-edge.is-highlighted {
  stroke: #f97316;
}

.workspace-graph-edge.is-dimmed {
  stroke-opacity: 0.15;
}

.workspace-graph-node {
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.workspace-graph-node.is-dimmed {
  opacity: 0.25;
}

.workspace-graph-node-circle {
  stroke: none;
}

.workspace-graph-node-label {
  font-size: 11px;
  fill: var(--yc-text-secondary);
  text-anchor: middle;
}
</style>