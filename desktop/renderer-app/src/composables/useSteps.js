import { computed, ref, watch } from "vue";
import { initialSteps } from "../data/steps";

const STEPS_STORAGE_KEY = "yc-doc.steps.v1";
const STEP_ID_STORAGE_KEY = "yc-doc.current-id.v1";
const DESKTOP_SAVE_DELAY_MS = 260;
const EMPTY_MARKDOWN_STEPS = [{ id: 1, title: "", subtitle: "", content: "" }];

const cloneSteps = (source) =>
  (Array.isArray(source) ? source : [])
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: Number(item.id) || index + 1,
      title: String(item.title || `步骤 ${index + 1}`),
      subtitle: String(item.subtitle || ""),
      content: String(item.content || "")
    }));

const getDesktopDataBridge = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.desktopData || null;
};

const readStoredSteps = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(STEPS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = cloneSteps(parsed);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

const readStoredCurrentId = (items) => {
  if (typeof window === "undefined") {
    return items[0]?.id ?? 1;
  }
  const raw = localStorage.getItem(STEP_ID_STORAGE_KEY);
  const candidate = Number(raw);
  if (Number.isFinite(candidate) && items.some((step) => step.id === candidate)) {
    return candidate;
  }
  return items[0]?.id ?? 1;
};

export const useSteps = (showToast) => {
  const desktopDataBridge = getDesktopDataBridge();
  const useMarkdownStorage = Boolean(
    desktopDataBridge?.readWorkspaceFile
    && desktopDataBridge?.writeWorkspaceFile
  );
  const fallbackSteps = useMarkdownStorage ? cloneSteps(EMPTY_MARKDOWN_STEPS) : cloneSteps(initialSteps);
  const initialStepsValue = useMarkdownStorage ? fallbackSteps : (readStoredSteps() || fallbackSteps);
  const steps = ref(initialStepsValue);
  const currentId = ref(useMarkdownStorage ? (initialStepsValue[0]?.id ?? 1) : readStoredCurrentId(steps.value));
  const draggedIndex = ref(null);

  let desktopHydrated = useMarkdownStorage ? true : !desktopDataBridge?.loadSteps;
  let desktopSaveTimer = null;
  let desktopSaveQueued = false;
  let desktopLoadWarned = false;

  const activeStep = computed(
    () => steps.value.find((step) => step.id === currentId.value) || steps.value[0]
  );
  const currentStepIndex = computed(() =>
    Math.max(0, steps.value.findIndex((step) => step.id === currentId.value))
  );
  const isFirstStep = computed(() => currentStepIndex.value === 0);
  const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);

  const persistLocalSteps = (list) => {
    if (useMarkdownStorage) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(STEPS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore quota/storage errors
    }
  };

  const persistLocalCurrentId = (value) => {
    if (useMarkdownStorage) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(STEP_ID_STORAGE_KEY, String(value));
    } catch {
      // ignore quota/storage errors
    }
  };

  const saveDesktopStepsNow = async () => {
    if (useMarkdownStorage) {
      return;
    }
    if (!desktopDataBridge?.saveSteps || !desktopHydrated) {
      desktopSaveQueued = true;
      return;
    }
    desktopSaveQueued = false;
    try {
      await desktopDataBridge.saveSteps({
        steps: steps.value,
        currentId: currentId.value
      });
    } catch {
      // fallback remains localStorage
    }
  };

  const scheduleDesktopSave = () => {
    if (useMarkdownStorage) {
      return;
    }
    if (!desktopDataBridge?.saveSteps) {
      return;
    }
    desktopSaveQueued = true;
    if (desktopSaveTimer) {
      clearTimeout(desktopSaveTimer);
      desktopSaveTimer = null;
    }
    desktopSaveTimer = setTimeout(() => {
      desktopSaveTimer = null;
      void saveDesktopStepsNow();
    }, DESKTOP_SAVE_DELAY_MS);
  };

  const hydrateDesktopSteps = async () => {
    if (useMarkdownStorage) {
      desktopHydrated = true;
      return;
    }
    if (!desktopDataBridge?.loadSteps) {
      desktopHydrated = true;
      return;
    }
    try {
      const loaded = await desktopDataBridge.loadSteps();
      if (loaded?.ok && Array.isArray(loaded.steps) && loaded.steps.length > 0) {
        const normalized = cloneSteps(loaded.steps);
        if (normalized.length > 0) {
          steps.value = normalized;
          const remoteCurrent = Number(loaded.currentId);
          if (Number.isFinite(remoteCurrent) && normalized.some((step) => step.id === remoteCurrent)) {
            currentId.value = remoteCurrent;
          } else {
            currentId.value = readStoredCurrentId(normalized);
          }
          persistLocalSteps(steps.value);
          persistLocalCurrentId(currentId.value);
        }
      }
    } catch {
      if (!desktopLoadWarned && typeof showToast === "function") {
        showToast("读取桌面数据失败，已回退到本地缓存");
      }
      desktopLoadWarned = true;
    } finally {
      desktopHydrated = true;
      if (desktopSaveQueued) {
        scheduleDesktopSave();
      }
    }
  };

  void hydrateDesktopSteps();

  const next = () => {
    const idx = steps.value.findIndex((step) => step.id === currentId.value);
    if (idx < steps.value.length - 1) {
      currentId.value = steps.value[idx + 1].id;
    }
  };

  const prev = () => {
    const idx = steps.value.findIndex((step) => step.id === currentId.value);
    if (idx > 0) {
      currentId.value = steps.value[idx - 1].id;
    }
  };

  const addStep = () => {
    const newId = steps.value.length
      ? Math.max(...steps.value.map((step) => step.id)) + 1
      : 1;
    steps.value.push({
      id: newId,
      title: `新步骤 ${newId}`,
      subtitle: "编辑描述",
      content: "# 新内容\n\n```python\nprint(\"hello\")\n```"
    });
    currentId.value = newId;
  };

  const removeStep = () => {
    if (steps.value.length <= 1) {
      if (showToast) {
        showToast("至少保留一个步骤");
      }
      return;
    }
    const idx = steps.value.findIndex((step) => step.id === currentId.value);
    if (idx === -1) {
      return;
    }
    steps.value.splice(idx, 1);
    currentId.value = steps.value[Math.max(0, idx - 1)].id;
  };

  const onDragStart = (event, index, editable) => {
    if (!editable) {
      return;
    }
    draggedIndex.value = index;
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  };

  const onDragOver = (event, editable) => {
    if (!editable) {
      return;
    }
    event.preventDefault();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const onDrop = (event, targetIndex, editable) => {
    if (!editable) {
      return;
    }
    event.preventDefault();
    if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
      return;
    }
    const arr = steps.value;
    const dragged = arr[draggedIndex.value];
    arr.splice(draggedIndex.value, 1);
    arr.splice(targetIndex, 0, dragged);
    draggedIndex.value = null;
  };

  watch(steps, (list) => {
    persistLocalSteps(list);
    if (!list.some((step) => step.id === currentId.value)) {
      currentId.value = list[0]?.id ?? 1;
    }
    scheduleDesktopSave();
  }, { deep: true });

  watch(currentId, (value) => {
    persistLocalCurrentId(value);
    scheduleDesktopSave();
  });

  return {
    steps,
    currentId,
    activeStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
    next,
    prev,
    addStep,
    removeStep,
    onDragStart,
    onDragOver,
    onDrop
  };
};
