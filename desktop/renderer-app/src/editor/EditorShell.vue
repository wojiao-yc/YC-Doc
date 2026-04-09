<template>
  <div ref="shellRef" class="yc-editor-shell" :class="[dark ? 'is-dark' : 'is-light', readOnly ? 'is-readonly' : '']">
    <div ref="editorHostRef" class="yc-editor-host"></div>
    <div v-if="dropCaretStyle" class="yc-editor-drop-caret" :style="dropCaretStyle"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createMarkdownEditor, setWikilinkLocaleText } from "./core/create-editor";

const props = defineProps({
  dark: {
    type: Boolean,
    default: false
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  presentationEnabled: {
    type: Boolean,
    default: true
  },
  modelValue: {
    type: String,
    default: ""
  },
  currentRelPath: {
    type: String,
    default: ""
  },
  wikiLinkFiles: {
    type: Array,
    default: () => []
  },
  wikiLinkSuggestions: {
    type: Function,
    default: null
  },
  wikiLinkSuggestionSelect: {
    type: Function,
    default: null
  },
  localeText: {
    type: Function,
    default: (zh, en) => zh
  }
});

const emit = defineEmits(["update:modelValue", "selection-change", "wiki-link-activate", "external-link-activate"]);
const shellRef = ref(null);
const editorHostRef = ref(null);
const dropCaretStyle = ref(null);
let editorApi = null;

const focus = () => {
  editorApi?.focus();
};

const focusPosition = (position) => {
  editorApi?.setCursor(position);
};

const openSearch = () => {
  editorApi?.openSearch();
};

const refreshWikiLinks = () => {
  editorApi?.refreshWikiLinks?.();
};

const insertMarkdown = (markdown) => {
  dropCaretStyle.value = null;
  editorApi?.insertText?.(markdown);
};

const clearPointPreview = () => {
  dropCaretStyle.value = null;
};

const moveCursorToPoint = (x, y) => {
  const caret = editorApi?.describeTextInsertAtCoords?.(x, y);
  const shell = shellRef.value;
  if (!caret || !(shell instanceof HTMLElement)) {
    dropCaretStyle.value = null;
    return false;
  }
  const shellRect = shell.getBoundingClientRect();
  const left = Math.max(0, Math.round(Number(caret.left || 0) - shellRect.left));
  const top = Math.max(0, Math.round(Number(caret.top || 0) - shellRect.top));
  const height = Math.max(16, Math.round(Number(caret.height || 0) || 22));
  dropCaretStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    height: `${height}px`
  };
  return true;
};

const insertMarkdownAtPoint = (markdown, x, y) => {
  dropCaretStyle.value = null;
  return editorApi?.insertTextAtCoords?.(markdown, x, y);
};

defineExpose({
  focus,
  focusPosition,
  openSearch,
  refreshWikiLinks,
  insertMarkdown,
  moveCursorToPoint,
  insertMarkdownAtPoint,
  clearPointPreview
});

onMounted(() => {
  const host = editorHostRef.value;
  if (!host) {
    return;
  }
  setWikilinkLocaleText(props.localeText);
  editorApi = createMarkdownEditor({
    parent: host,
    doc: props.modelValue,
    dark: props.dark,
    readOnly: props.readOnly,
    presentationEnabled: props.presentationEnabled,
    onSelectionChange: (selection) => {
      emit("selection-change", selection);
    },
    onChange: (nextMarkdown) => {
      emit("update:modelValue", nextMarkdown);
    },
    onWikiLinkActivate: (payload) => {
      emit("wiki-link-activate", payload);
    },
    onExternalLinkActivate: (payload) => {
      emit("external-link-activate", payload);
    },
    onWikiLinkSuggestionSelect: (payload) => {
      if (typeof props.wikiLinkSuggestionSelect === "function") {
        return props.wikiLinkSuggestionSelect(payload);
      }
      return null;
    },
    getWikiLinkCurrentRelPath: () => props.currentRelPath,
    getWikiLinkMarkdownFiles: () => props.wikiLinkFiles,
    getWikiLinkSuggestions: (context) => {
      if (typeof props.wikiLinkSuggestions !== "function") {
        return [];
      }
      return props.wikiLinkSuggestions(context);
    }
  });
});

watch(
  () => props.modelValue,
  (nextValue) => {
    const nextDoc = String(nextValue ?? "");
    if (!editorApi || editorApi.getDoc() === nextDoc) {
      return;
    }
    editorApi.setDoc(nextDoc);
  }
);

watch(
  () => props.dark,
  (nextDark) => {
    editorApi?.setDark(nextDark);
  }
);

watch(
  () => props.readOnly,
  (nextReadOnly) => {
    editorApi?.setReadOnly?.(nextReadOnly);
    if (nextReadOnly) {
      dropCaretStyle.value = null;
    }
  }
);

watch(
  () => props.presentationEnabled,
  (nextEnabled) => {
    editorApi?.setPresentationEnabled?.(nextEnabled);
    if (!nextEnabled) {
      dropCaretStyle.value = null;
    }
  }
);

watch(
  () => [props.currentRelPath, props.wikiLinkFiles],
  () => {
    editorApi?.refreshWikiLinks?.();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  dropCaretStyle.value = null;
  editorApi?.destroy();
  editorApi = null;
});
</script>
