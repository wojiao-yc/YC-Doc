const normalizeMarkdown = (value) => String(value ?? "").replace(/\r\n/g, "\n");

export const createEditorStore = ({
  initialMarkdown = "",
  onSave = async () => {},
  debounceMs = 500
} = {}) => {
  let markdown = normalizeMarkdown(initialMarkdown);
  let lastSavedMarkdown = markdown;
  let saving = false;
  let saveTimer = null;

  const clearSaveTimer = () => {
    if (!saveTimer) {
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = null;
  };

  const isDirty = () => markdown !== lastSavedMarkdown;

  const loadMarkdown = (text) => {
    clearSaveTimer();
    markdown = normalizeMarkdown(text);
    lastSavedMarkdown = markdown;
    return markdown;
  };

  const updateMarkdown = (text) => {
    markdown = normalizeMarkdown(text);
    return markdown;
  };

  const saveMarkdown = async () => {
    if (saving || !isDirty()) {
      return false;
    }
    saving = true;
    const snapshot = markdown;
    try {
      await onSave(snapshot);
      lastSavedMarkdown = snapshot;
      return true;
    } finally {
      saving = false;
    }
  };

  const scheduleSave = () => {
    clearSaveTimer();
    if (!isDirty()) {
      return;
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveMarkdown();
    }, Math.max(0, Number(debounceMs || 0)));
  };

  const flushSave = async () => {
    clearSaveTimer();
    return saveMarkdown();
  };

  return {
    clearSaveTimer,
    flushSave,
    isDirty,
    loadMarkdown,
    scheduleSave,
    saveMarkdown,
    updateMarkdown,
    getMarkdown: () => markdown
  };
};
