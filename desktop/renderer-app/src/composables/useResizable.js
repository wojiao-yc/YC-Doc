import { computed, ref } from "vue";

export const useResizable = () => {
  const sidebarWidth = ref(320);
  const editorPaneWidth = ref(560);
  const displayWidth = ref(980);
  const editSplitRef = ref(null);

  const DEFAULT_DISPLAY_W = 980;
  const MAX_DOCUMENT_WIDTH = 1160;

  const displayStyle = computed(() => ({
    width: "100%",
    maxWidth: `${displayWidth.value}px`
  }));

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const startSidebarResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startW = sidebarWidth.value;

    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      sidebarWidth.value = clamp(startW + dx, 240, 560);
    };
    const onUp = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startEditorResize = (event) => {
    event.preventDefault();
    const box = editSplitRef.value?.getBoundingClientRect();
    if (!box) {
      return;
    }

    const startX = event.clientX;
    const startW = editorPaneWidth.value;
    const total = box.width;

    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const minW = 320;
      const maxW = Math.max(minW, total - 320);
      editorPaneWidth.value = clamp(startW + dx, minW, maxW);
    };
    const onUp = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startDisplayResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startW = displayWidth.value;

    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const maxW = Math.min(MAX_DOCUMENT_WIDTH, window.innerWidth - 80);
      const newW = startW + dx * 2;
      displayWidth.value = clamp(Math.round(newW), 520, Math.max(520, maxW));
    };
    const onUp = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const resetDisplayWidth = () => {
    displayWidth.value = DEFAULT_DISPLAY_W;
  };

  return {
    sidebarWidth,
    editorPaneWidth,
    displayWidth,
    displayStyle,
    editSplitRef,
    startSidebarResize,
    startEditorResize,
    startDisplayResize,
    resetDisplayWidth
  };
};
