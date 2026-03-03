import { computed, ref } from "vue";
import { initialSteps } from "../data/steps";

export const useSteps = (showToast) => {
  const steps = ref(initialSteps.map((step) => ({ ...step })));
  const currentId = ref(steps.value[0]?.id ?? 1);
  const draggedIndex = ref(null);

  const activeStep = computed(
    () => steps.value.find((step) => step.id === currentId.value) || steps.value[0]
  );
  const currentStepIndex = computed(() =>
    Math.max(0, steps.value.findIndex((step) => step.id === currentId.value))
  );
  const isFirstStep = computed(() => currentStepIndex.value === 0);
  const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);

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
