import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { parseMarkdownToSemanticSnapshot } from "../parser/parse-markdown.js";
import { findCurrentBlockFromSelection } from "../runtime/current-block.js";

const normalizeSelection = (selection) => ({
  anchor: Number(selection?.anchor || 0),
  head: Number(selection?.head || 0)
});

export const useSemanticStore = ({
  markdownRef,
  selectionRef,
  parseDelayMs = 70,
  currentBlockStrategy = "anchor"
}) => {
  const snapshot = shallowRef(parseMarkdownToSemanticSnapshot(markdownRef?.value || ""));
  const currentBlock = shallowRef(
    findCurrentBlockFromSelection(snapshot.value.blocks, normalizeSelection(selectionRef?.value), currentBlockStrategy)
  );
  const parsing = ref(false);
  let parseTimer = null;

  const parseNow = () => {
    parsing.value = true;
    try {
      snapshot.value = parseMarkdownToSemanticSnapshot(markdownRef?.value || "");
    } finally {
      parsing.value = false;
      currentBlock.value = findCurrentBlockFromSelection(
        snapshot.value.blocks,
        normalizeSelection(selectionRef?.value),
        currentBlockStrategy
      );
    }
  };

  const scheduleParse = () => {
    if (parseTimer) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }
    const delay = Math.max(0, Number(parseDelayMs || 0));
    if (delay <= 0) {
      parseNow();
      return;
    }
    parseTimer = setTimeout(() => {
      parseTimer = null;
      parseNow();
    }, delay);
  };

  watch(markdownRef, () => {
    scheduleParse();
  }, { immediate: true });

  watch(selectionRef, (selection) => {
    currentBlock.value = findCurrentBlockFromSelection(
      snapshot.value.blocks,
      normalizeSelection(selection),
      currentBlockStrategy
    );
  }, { immediate: true, deep: true });

  onBeforeUnmount(() => {
    if (!parseTimer) {
      return;
    }
    clearTimeout(parseTimer);
    parseTimer = null;
  });

  return {
    snapshot,
    parsing,
    blocks: computed(() => snapshot.value.blocks || []),
    outline: computed(() => snapshot.value.outline || []),
    currentBlock,
    refreshSemanticSnapshot: parseNow
  };
};
