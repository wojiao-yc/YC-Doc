<template>
  <div class="yc-editor-shell" :class="dark ? 'is-dark' : 'is-light'">
    <div ref="editorHostRef" class="yc-editor-host"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createMarkdownEditor } from "./core/create-editor";

const props = defineProps({
  dark: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "selection-change"]);
const editorHostRef = ref(null);
let editorApi = null;

const focus = () => {
  editorApi?.focus();
};

const openSearch = () => {
  editorApi?.openSearch();
};

defineExpose({ focus, openSearch });

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
});

watch(
  () => props.modelValue,
  (nextValue) => {
    editorApi?.setDoc(nextValue);
  }
);

watch(
  () => props.dark,
  (nextDark) => {
    editorApi?.setDark(nextDark);
  }
);

onBeforeUnmount(() => {
  editorApi?.destroy();
  editorApi = null;
});
</script>
