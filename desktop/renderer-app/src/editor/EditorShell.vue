<template>
  <div ref="shellRef" class="yc-editor-shell" :class="[dark ? 'is-dark' : 'is-light', readOnly ? 'is-readonly' : '']">
    <textarea
      v-if="isSourceMode"
      ref="sourceTextareaRef"
      class="yc-editor-source"
      :class="[dark ? 'is-dark' : 'is-light']"
      :readonly="readOnly"
      :value="sourceValue"
      spellcheck="false"
      @input="onSourceInput"
      @click="emitSourceSelection"
      @keyup="emitSourceSelection"
      @select="emitSourceSelection"
    ></textarea>
    <div v-else ref="editorHostRef" class="yc-editor-host"></div>
    <div v-if="dropCaretStyle" class="yc-editor-drop-caret" :style="dropCaretStyle"></div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
const sourceTextareaRef = ref(null);
const dropCaretStyle = ref(null);
const sourceValue = ref(String(props.modelValue ?? ""));
let editorApi = null;

const isSourceMode = computed(() => !props.presentationEnabled);

const ensureSourceSelection = (selectionStartInput, selectionEndInput = selectionStartInput, { focus = false } = {}) => {
  const textarea = sourceTextareaRef.value;
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }
  const textLength = String(textarea.value || "").length;
  const start = Math.max(0, Math.min(textLength, Number(selectionStartInput) || 0));
  const end = Math.max(start, Math.min(textLength, Number(selectionEndInput) || 0));
  textarea.setSelectionRange(start, end);
  if (focus) {
    textarea.focus();
  }
  emit("selection-change", {
    anchor: textarea.selectionStart,
    head: textarea.selectionEnd
  });
  return true;
};

const syncSourceValue = (nextValueInput = "") => {
  const next = String(nextValueInput ?? "");
  sourceValue.value = next;
  const textarea = sourceTextareaRef.value;
  if (textarea instanceof HTMLTextAreaElement && textarea.value !== next) {
    textarea.value = next;
  }
};

const emitSourceSelection = () => {
  const textarea = sourceTextareaRef.value;
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }
  emit("selection-change", {
    anchor: Number(textarea.selectionStart || 0),
    head: Number(textarea.selectionEnd || 0)
  });
};

const onSourceInput = (event) => {
  const textarea = event?.target instanceof HTMLTextAreaElement
    ? event.target
    : sourceTextareaRef.value;
  const next = String(textarea?.value ?? "");
  sourceValue.value = next;
  emit("update:modelValue", next);
  emitSourceSelection();
};

const insertSourceMarkdown = (markdownInput = "", selectionStart = null, selectionEnd = null) => {
  const textarea = sourceTextareaRef.value;
  if (!(textarea instanceof HTMLTextAreaElement) || props.readOnly) {
    return false;
  }
  const markdown = String(markdownInput ?? "");
  const from = Number.isFinite(selectionStart) ? Number(selectionStart) : Number(textarea.selectionStart || 0);
  const to = Number.isFinite(selectionEnd) ? Number(selectionEnd) : Number(textarea.selectionEnd || from);
  const start = Math.max(0, Math.min(from, to));
  const end = Math.max(start, Math.max(from, to));
  const value = String(textarea.value || "");
  const next = `${value.slice(0, start)}${markdown}${value.slice(end)}`;
  textarea.value = next;
  sourceValue.value = next;
  const cursor = start + markdown.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();
  emit("update:modelValue", next);
  emit("selection-change", {
    anchor: cursor,
    head: cursor
  });
  return true;
};

const openSourceSearch = () => {
  const textarea = sourceTextareaRef.value;
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }
  const query = window.prompt(props.localeText("查找内容", "Find text"), "");
  if (!query) {
    return false;
  }
  const source = String(textarea.value || "");
  const startFrom = Math.max(0, Number(textarea.selectionEnd || 0));
  let index = source.indexOf(query, startFrom);
  if (index < 0 && startFrom > 0) {
    index = source.indexOf(query, 0);
  }
  if (index < 0) {
    return false;
  }
  return ensureSourceSelection(index, index + query.length, { focus: true });
};

const focus = () => {
  if (isSourceMode.value) {
    sourceTextareaRef.value?.focus();
    return;
  }
  editorApi?.focus();
};

const focusPosition = (position) => {
  if (isSourceMode.value) {
    return ensureSourceSelection(position, position, { focus: true });
  }
  return editorApi?.setCursor(position);
};

const openSearch = () => {
  if (isSourceMode.value) {
    openSourceSearch();
    return;
  }
  editorApi?.openSearch();
};

const refreshWikiLinks = () => {
  if (isSourceMode.value) {
    return;
  }
  editorApi?.refreshWikiLinks?.();
};

const insertMarkdown = (markdown) => {
  dropCaretStyle.value = null;
  if (isSourceMode.value) {
    insertSourceMarkdown(markdown);
    return;
  }
  editorApi?.insertText?.(markdown);
};

const clearPointPreview = () => {
  dropCaretStyle.value = null;
};

const moveCursorToPoint = (x, y) => {
  if (isSourceMode.value) {
    return false;
  }
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
  if (isSourceMode.value) {
    return insertSourceMarkdown(markdown);
  }
  return editorApi?.insertTextAtCoords?.(markdown, x, y);
};

const focusHeading = (payload = null) => {
  if (isSourceMode.value) {
    if (payload && typeof payload === "object" && Number.isFinite(payload.pos)) {
      return ensureSourceSelection(payload.pos, payload.pos, { focus: true });
    }
    return false;
  }
  return editorApi?.focusHeading?.(payload);
};

defineExpose({
  focus,
  focusPosition,
  focusHeading,
  openSearch,
  refreshWikiLinks,
  insertMarkdown,
  moveCursorToPoint,
  insertMarkdownAtPoint,
  clearPointPreview
});

const initRichEditor = () => {
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
};

const destroyRichEditor = () => {
  editorApi?.destroy?.();
  editorApi = null;
};

onMounted(() => {
  syncSourceValue(props.modelValue);
  if (!isSourceMode.value) {
    initRichEditor();
  }
});

watch(
  () => props.modelValue,
  (nextValue) => {
    const nextDoc = String(nextValue ?? "");
    if (isSourceMode.value) {
      syncSourceValue(nextDoc);
      return;
    }
    if (!editorApi || editorApi.getDoc() === nextDoc) {
      return;
    }
    editorApi.setDoc(nextDoc);
  }
);

watch(
  () => props.dark,
  (nextDark) => {
    if (isSourceMode.value) {
      return;
    }
    editorApi?.setDark(nextDark);
  }
);

watch(
  () => props.readOnly,
  (nextReadOnly) => {
    if (isSourceMode.value) {
      if (nextReadOnly) {
        dropCaretStyle.value = null;
      }
      return;
    }
    editorApi?.setReadOnly?.(nextReadOnly);
    if (nextReadOnly) {
      dropCaretStyle.value = null;
    }
  }
);

watch(
  () => props.presentationEnabled,
  async (nextEnabled) => {
    if (!nextEnabled) {
      destroyRichEditor();
      dropCaretStyle.value = null;
      await nextTick();
      syncSourceValue(props.modelValue);
      emitSourceSelection();
      return;
    }
    await nextTick();
    initRichEditor();
    editorApi?.setPresentationEnabled?.(nextEnabled);
  }
);

watch(
  () => sourceValue.value,
  () => {
    if (!isSourceMode.value) {
      return;
    }
    emitSourceSelection();
  }
);

watch(
  () => [props.currentRelPath, props.wikiLinkFiles],
  () => {
    if (isSourceMode.value) {
      return;
    }
    editorApi?.refreshWikiLinks?.();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  dropCaretStyle.value = null;
  destroyRichEditor();
});
</script>
