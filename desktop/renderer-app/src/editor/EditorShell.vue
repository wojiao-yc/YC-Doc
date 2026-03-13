<template>
  <div class="yc-editor-shell" :class="dark ? 'is-dark' : 'is-light'">
    <div ref="editorHostRef" class="yc-editor-host"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createMarkdownEditor } from "./core/create-editor";
import { parseMarkdownToSemanticSnapshot } from "./parser/parse-markdown";

const props = defineProps({
  dark: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: String,
    default: ""
  },
  presentationBlocks: {
    type: Array,
    default: () => []
  },
  currentBlockId: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "selection-change"]);
const editorHostRef = ref(null);
let editorApi = null;
let latestPresentationBlocks = Array.isArray(props.presentationBlocks) ? props.presentationBlocks : [];

const focus = () => {
  editorApi?.focus();
};

const openSearch = () => {
  editorApi?.openSearch();
};

defineExpose({ focus, openSearch });

const syncPresentationData = () => {
  editorApi?.setPresentationData({
    blocks: latestPresentationBlocks,
    currentBlockId: props.currentBlockId
  });
};

onMounted(() => {
  const host = editorHostRef.value;
  if (!host) {
    return;
  }
  editorApi = createMarkdownEditor({
    parent: host,
    doc: props.modelValue,
    dark: props.dark,
    onSelectionChange: (selection) => {
      emit("selection-change", selection);
    },
    onChange: (nextMarkdown) => {
      emit("update:modelValue", nextMarkdown);
    }
  });
  syncPresentationData();
});

watch(
  () => props.modelValue,
  (nextValue) => {
    const nextDoc = String(nextValue ?? "");
    if (!editorApi || editorApi.getDoc() === nextDoc) {
      return;
    }
    const snapshot = parseMarkdownToSemanticSnapshot(nextDoc);
    latestPresentationBlocks = snapshot.blocks;
    editorApi.setDoc(nextDoc, {
      presentationData: {
        blocks: latestPresentationBlocks,
        currentBlockId: props.currentBlockId
      }
    });
  }
);

watch(
  () => props.dark,
  (nextDark) => {
    editorApi?.setDark(nextDark);
  }
);

watch(
  () => props.presentationBlocks,
  (nextBlocks) => {
    latestPresentationBlocks = Array.isArray(nextBlocks) ? nextBlocks : [];
    syncPresentationData();
  }
);

watch(
  () => props.currentBlockId,
  () => {
    syncPresentationData();
  }
);

onBeforeUnmount(() => {
  editorApi?.destroy();
  editorApi = null;
});
</script>
