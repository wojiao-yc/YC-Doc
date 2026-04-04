<template>
  <div class="workspace-graph-root" :class="{ 'is-dark': isDark }">
    <section class="workspace-graph-shell" :class="{ 'is-dark': isDark }">
      <header class="workspace-graph-header">
        <div class="workspace-graph-heading">
          <p class="workspace-graph-eyebrow">Workspace Link Graph</p>
          <h2 class="workspace-graph-title">Relation Graph</h2>
          <p class="workspace-graph-subtitle">
            {{ graphStats.nodeCount }} notes
            <span class="workspace-graph-dot">·</span>
            {{ graphStats.edgeCount }} links
            <span class="workspace-graph-dot">·</span>
            {{ graphStats.isolatedCount }} isolated
          </p>
        </div>

        <div class="workspace-graph-controls">
          <label class="workspace-graph-control">
            <span>Color</span>
            <select v-model="colorMode" class="workspace-graph-select">
              <option value="folder">Folder</option>
              <option value="tag">Tag</option>
            </select>
          </label>

          <label class="workspace-graph-toggle">
            <input v-model="showArrows" type="checkbox" />
            <span>Arrows</span>
          </label>

          <button type="button" class="workspace-graph-btn" @click="resetLayout">
            Reset Layout
          </button>
          <button type="button" class="workspace-graph-btn is-primary" @click="$emit('close')">
            Close
          </button>
        </div>
      </header>

      <div class="workspace-graph-body">
        <div
          ref="viewportRef"
          class="workspace-graph-viewport"
          :class="{ 'is-panning': dragState.type === 'pan' }"
          @wheel.prevent="handleWheel"
          @pointerdown="handleViewportPointerDown"
          @mouseleave="hoveredNodeId = ''"
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
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="var(--yc-graph-arrow)" />
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
                :x1="edge.source.x"
                :y1="edge.source.y"
                :x2="edge.target.x"
                :y2="edge.target.y"
                :stroke-width="edgeStrokeWidth(edge)"
                :marker-end="showArrows ? 'url(#workspace-graph-arrow)' : null"
              />

              <g
                v-for="node in simNodes"
                :key="node.id"
                class="workspace-graph-node"
                :class="{
                  'is-dimmed': isNodeDimmed(node),
                  'is-active': node.id === activeRelPath,
                  'is-hovered': hoveredNodeId === node.id
                }"
                :transform="`translate(${node.x} ${node.y})`"
                @pointerenter="hoveredNodeId = node.id"
                @pointerdown="handleNodePointerDown($event, node)"
              >
                <circle
                  v-if="node.id === activeRelPath || hoveredNodeId === node.id"
                  class="workspace-graph-node-halo"
                  :r="node.radius + 7"
                />
                <circle
                  class="workspace-graph-node-dot"
                  :r="node.radius"
                  :fill="nodeColor(node)"
                />
                <circle
                  class="workspace-graph-node-ring"
                  :r="node.radius + 1.5"
                />
                <text
                  v-if="shouldShowLabel(node)"
                  class="workspace-graph-node-label"
                  :x="node.radius + 10"
                  :y="4"
                >
                  {{ node.title }}
                </text>
              </g>
            </g>
          </svg>

          <div v-if="legendItems.length" class="workspace-graph-overlay-card workspace-graph-legend-card">
            <div class="workspace-graph-card-title">
              {{ colorMode === "tag" ? "Top tags" : "Top folders" }}
            </div>
            <div class="workspace-graph-legend-list">
              <div
                v-for="item in legendItems"
                :key="item.key"
                class="workspace-graph-legend-item"
              >
                <span class="workspace-graph-legend-swatch" :style="{ backgroundColor: item.color }"></span>
                <span class="workspace-graph-legend-label">{{ item.label }}</span>
                <span class="workspace-graph-legend-count">{{ item.count }}</span>
              </div>
            </div>
          </div>

          <div v-if="inspectorNode" class="workspace-graph-overlay-card workspace-graph-inspector-card">
            <div class="workspace-graph-card-title">Selection</div>
            <div class="workspace-graph-inspector-title">{{ inspectorNode.title }}</div>
            <div class="workspace-graph-inspector-path">{{ inspectorNode.relPath }}</div>
            <div class="workspace-graph-inspector-stats">
              <span>Backlinks {{ inspectorNode.backlinksCount }}</span>
              <span>Outgoing {{ inspectorNode.outgoingCount }}</span>
              <span>{{ colorMode === "tag" ? inspectorNode.primaryTag : inspectorNode.folderKey }}</span>
            </div>
          </div>
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

const emit = defineEmits(["close", "open-note"]);

const FORCE_LINK_DISTANCE = 104;
const FORCE_CENTERING = 0.0012;
const FORCE_DAMPING = 0.9;
const FORCE_REPULSION = 4800;
const FORCE_BOUNDARY_PADDING = 72;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.85;
const PALETTE = [
  "#f97316",
  "#2563eb",
  "#059669",
  "#dc2626",
  "#0ea5e9",
  "#ca8a04",
  "#14b8a6",
  "#7c3aed",
  "#db2777",
  "#84cc16"
];

const viewportRef = ref(null);
const svgRef = ref(null);
const simNodes = ref([]);
const simEdges = ref([]);
const hoveredNodeId = ref("");
const colorMode = ref("folder");
const showArrows = ref(true);
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

const graphStats = computed(() => props.graphData?.stats || {
  nodeCount: 0,
  edgeCount: 0,
  isolatedCount: 0
});

const nodeMap = computed(() => new Map(simNodes.value.map((node) => [node.id, node])));

const visualEdges = computed(() =>
  simEdges.value
    .map((edge) => ({
      ...edge,
      source: nodeMap.value.get(edge.sourceId),
      target: nodeMap.value.get(edge.targetId)
    }))
    .filter((edge) => edge.source && edge.target)
);

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

const legendItems = computed(() => {
  const groups = colorMode.value === "tag"
    ? props.graphData?.groups?.tags
    : props.graphData?.groups?.folders;

  return (Array.isArray(groups) ? groups : [])
    .slice(0, 6)
    .map((item) => ({
      ...item,
      color: colorForKey(item?.key || "")
    }));
});

const inspectorNode = computed(() =>
  nodeMap.value.get(hoveredNodeId.value)
  || nodeMap.value.get(String(props.activeRelPath || ""))
  || simNodes.value[0]
  || null
);

const svgViewBox = computed(() =>
  `0 0 ${Math.max(1, Number(viewportSize.value.width || 0))} ${Math.max(1, Number(viewportSize.value.height || 0))}`
);

const graphTransform = computed(() => `translate(${pan.value.x} ${pan.value.y}) scale(${zoom.value})`);

const hashIndexOf = (valueInput = "") => {
  const value = String(valueInput || "");
  if (!value) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const colorForKey = (keyInput = "") => {
  const key = String(keyInput || "").trim();
  if (!key || key === "Root" || key === "No tag") {
    return "var(--yc-graph-root-node)";
  }
  return PALETTE[hashIndexOf(key) % PALETTE.length];
};

const nodeColor = (node) => colorForKey(
  colorMode.value === "tag"
    ? node?.primaryTag
    : node?.folderKey
);

const shouldShowLabel = (node) =>
  hoveredNodeId.value === node.id
  || String(props.activeRelPath || "") === node.id
  || Number(node?.radius || 0) >= 14;

const isNodeDimmed = (node) =>
  Boolean(highlightedNodeIds.value && !highlightedNodeIds.value.has(node.id));

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
  }
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
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--yc-accent) 10%, transparent), transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--yc-bg-panel) 98%, transparent), color-mix(in srgb, var(--yc-bg-panel-alt) 98%, transparent));
}

.workspace-graph-root.is-dark {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--yc-accent) 16%, transparent), transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--yc-bg-panel-muted) 98%, transparent), color-mix(in srgb, var(--yc-bg-panel) 98%, transparent));
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
}

.workspace-graph-shell.is-dark {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.workspace-graph-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--yc-border-strong) 42%, transparent);
  background: color-mix(in srgb, var(--yc-bg-overlay) 84%, transparent);
  backdrop-filter: blur(12px);
}

.workspace-graph-shell.is-dark .workspace-graph-header {
  background: color-mix(in srgb, var(--yc-bg-overlay) 78%, transparent);
}

.workspace-graph-heading {
  min-width: 0;
}

.workspace-graph-eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--yc-accent);
}

.workspace-graph-title {
  margin: 6px 0 0;
  font-size: 24px;
  line-height: 1.1;
  font-weight: 700;
  color: var(--yc-text-primary);
}

.workspace-graph-shell.is-dark .workspace-graph-title {
  color: var(--yc-text-primary);
}

.workspace-graph-subtitle {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--yc-text-muted);
}

.workspace-graph-shell.is-dark .workspace-graph-subtitle {
  color: var(--yc-text-muted);
}

.workspace-graph-dot {
  margin: 0 6px;
}

.workspace-graph-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.workspace-graph-control,
.workspace-graph-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--yc-text-secondary);
}

.workspace-graph-shell.is-dark .workspace-graph-control,
.workspace-graph-shell.is-dark .workspace-graph-toggle {
  color: var(--yc-text-secondary);
}

.workspace-graph-select,
.workspace-graph-btn {
  border: 1px solid color-mix(in srgb, var(--yc-border-strong) 62%, transparent);
  background: color-mix(in srgb, var(--yc-bg-panel) 88%, transparent);
  color: var(--yc-text-primary);
  border-radius: 12px;
  padding: 9px 12px;
  font-size: 12px;
  line-height: 1;
  transition: background-color 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
}

.workspace-graph-shell.is-dark .workspace-graph-select,
.workspace-graph-shell.is-dark .workspace-graph-btn {
  border-color: color-mix(in srgb, var(--yc-border-strong) 80%, transparent);
  background: color-mix(in srgb, var(--yc-bg-panel) 84%, transparent);
  color: var(--yc-text-primary);
}

.workspace-graph-btn:hover,
.workspace-graph-select:hover {
  border-color: color-mix(in srgb, var(--yc-accent) 56%, transparent);
  transform: translateY(-1px);
}

.workspace-graph-btn.is-primary {
  border-color: color-mix(in srgb, var(--yc-accent) 42%, transparent);
  background: var(--yc-accent-soft);
  color: var(--yc-text-on-accent);
}

.workspace-graph-shell.is-dark .workspace-graph-btn.is-primary {
  color: var(--yc-text-on-accent);
  background: var(--yc-accent-soft);
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
  background:
    radial-gradient(circle at center, color-mix(in srgb, var(--yc-bg-panel) 50%, transparent), transparent 62%),
    linear-gradient(180deg, color-mix(in srgb, var(--yc-bg-panel-alt) 90%, transparent), color-mix(in srgb, var(--yc-bg-panel-muted) 92%, transparent));
}

.workspace-graph-shell.is-dark .workspace-graph-viewport {
  background:
    radial-gradient(circle at center, color-mix(in srgb, var(--yc-bg-panel-alt) 55%, transparent), transparent 62%),
    linear-gradient(180deg, color-mix(in srgb, var(--yc-bg-panel-muted) 88%, transparent), color-mix(in srgb, var(--yc-bg-panel) 92%, transparent));
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
  transition: stroke-opacity 0.12s ease, stroke 0.12s ease;
}

.workspace-graph-shell.is-dark .workspace-graph-edge {
  stroke: var(--yc-graph-edge);
}

.workspace-graph-edge.is-highlighted {
  stroke: var(--yc-graph-edge-active);
}

.workspace-graph-edge.is-dimmed {
  stroke-opacity: 0.12;
}

.workspace-graph-node {
  cursor: pointer;
  transition: opacity 0.12s ease;
}

.workspace-graph-node.is-dimmed {
  opacity: 0.18;
}

.workspace-graph-node-halo {
  fill: color-mix(in srgb, var(--yc-accent) 16%, transparent);
}

.workspace-graph-node-dot {
  stroke: color-mix(in srgb, var(--yc-bg-panel) 88%, transparent);
  stroke-width: 1.5;
}

.workspace-graph-shell.is-dark .workspace-graph-node-dot {
  stroke: color-mix(in srgb, var(--yc-bg-panel) 95%, transparent);
}

.workspace-graph-node-ring {
  fill: none;
  stroke: color-mix(in srgb, var(--yc-text-primary) 8%, transparent);
  stroke-width: 1.1;
}

.workspace-graph-shell.is-dark .workspace-graph-node-ring {
  stroke: color-mix(in srgb, var(--yc-text-primary) 15%, transparent);
}

.workspace-graph-node.is-active .workspace-graph-node-ring,
.workspace-graph-node.is-hovered .workspace-graph-node-ring {
  stroke: color-mix(in srgb, var(--yc-accent) 68%, transparent);
  stroke-width: 1.8;
}

.workspace-graph-node-label {
  font-size: 13px;
  font-weight: 600;
  fill: var(--yc-graph-label-fill);
  paint-order: stroke;
  stroke: var(--yc-graph-label-stroke);
  stroke-width: 4px;
  stroke-linejoin: round;
  pointer-events: none;
}

.workspace-graph-shell.is-dark .workspace-graph-node-label {
  fill: var(--yc-graph-label-fill);
  stroke: var(--yc-graph-label-stroke);
}

.workspace-graph-overlay-card {
  position: absolute;
  border-radius: 18px;
  border: 1px solid var(--yc-graph-overlay-border);
  background: var(--yc-graph-overlay-bg);
  box-shadow: var(--yc-shadow-panel);
  backdrop-filter: blur(12px);
}

.workspace-graph-shell.is-dark .workspace-graph-overlay-card {
  border-color: var(--yc-graph-overlay-border);
  background: var(--yc-graph-overlay-bg);
  box-shadow: var(--yc-shadow-panel);
}

.workspace-graph-legend-card {
  top: 18px;
  right: 18px;
  width: 220px;
  padding: 14px;
}

.workspace-graph-inspector-card {
  left: 18px;
  bottom: 18px;
  min-width: 280px;
  max-width: 360px;
  padding: 14px;
}

.workspace-graph-card-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--yc-accent);
}

.workspace-graph-legend-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace-graph-legend-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--yc-text-secondary);
}

.workspace-graph-shell.is-dark .workspace-graph-legend-item {
  color: var(--yc-text-secondary);
}

.workspace-graph-legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.workspace-graph-legend-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-graph-legend-count {
  color: var(--yc-text-muted);
}

.workspace-graph-shell.is-dark .workspace-graph-legend-count {
  color: var(--yc-text-muted);
}

.workspace-graph-inspector-title {
  margin-top: 8px;
  font-size: 16px;
  line-height: 1.35;
  font-weight: 700;
  color: var(--yc-text-primary);
}

.workspace-graph-shell.is-dark .workspace-graph-inspector-title {
  color: var(--yc-text-primary);
}

.workspace-graph-inspector-path {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--yc-text-muted);
  word-break: break-word;
}

.workspace-graph-shell.is-dark .workspace-graph-inspector-path {
  color: var(--yc-text-muted);
}

.workspace-graph-inspector-stats {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-graph-inspector-stats span {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  color: var(--yc-text-secondary);
  background: var(--yc-bg-subtle-hover);
}

.workspace-graph-shell.is-dark .workspace-graph-inspector-stats span {
  color: var(--yc-text-secondary);
  background: var(--yc-bg-subtle-hover);
}

@media (max-width: 1080px) {
  .workspace-graph-header {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-graph-controls {
    justify-content: flex-start;
  }

  .workspace-graph-legend-card {
    display: none;
  }
}
</style>
