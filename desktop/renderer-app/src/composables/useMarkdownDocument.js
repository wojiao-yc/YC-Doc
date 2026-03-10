import { ref, watch, nextTick, onBeforeUnmount } from "vue";

const MARKDOWN_SAVE_DELAY_MS = 320;
const MAX_MARKDOWN_FILE_BYTES = 20 * 1024 * 1024;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const createBlankStep = (id = 1) => ({
  id,
  title: "",
  subtitle: "",
  content: ""
});
const createBlankSteps = () => [createBlankStep(1)];
const normalizeMarkdownText = (value) => String(value || "").replace(/\r\n/g, "\n");
const trimOuterBlankLines = (value) => String(value || "").replace(/^\n+/, "").replace(/\n+$/, "");
const isBlankStep = (step) =>
  !String(step?.title || "").trim()
  && !String(step?.subtitle || "").trim()
  && !String(step?.content || "").trim();

export const useMarkdownDocument = ({
  steps,
  currentId,
  currentStepIndex,
  isEditMode,
  desktopDataBridge,
  isDesktopStorage,
  canWorkspaceFileIO,
  visualEditorRef,
  showToast,
  syncVisualEditorFromMarkdown,
  focusStepInEditMode
}) => {
  const activeMarkdownRelPath = ref("");
  const documentMarkdown = ref("");
  const markdownHydrating = ref(false);

  let markdownSaveTimer = null;
  let pendingDocumentMarkdownFromSteps = null;
  let pendingStepsFromDocumentMarkdown = false;

  const isSingleBlankStepList = (list) =>
    Array.isArray(list)
    && list.length === 1
    && isBlankStep(list[0]);

  const defaultStepTitle = (index) => `步骤 ${index + 1}`;

  const stepDisplayTitle = (step, index = 0) => {
    const title = String(step?.title || "").trim();
    if (title) {
      return title;
    }
    const content = String(step?.content || "").trim();
    if ((steps.value?.length || 0) <= 1) {
      return content ? "文档" : "空白文档";
    }
    return defaultStepTitle(index);
  };

  const stepPreviewText = (step) => {
    const lines = normalizeMarkdownText(step?.content || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines[0] || "空白内容";
  };

  const extractMarkdownSections = (rawMarkdown) => {
    const text = normalizeMarkdownText(rawMarkdown);
    const lines = text.split("\n");
    const sections = [];
    let fenceChar = "";
    let pendingPrefixLines = [];
    let currentSection = null;
    let offset = 0;

    const pushSection = (endIndex) => {
      if (!currentSection) {
        return;
      }
      sections.push({
        title: currentSection.title,
        content: trimOuterBlankLines(currentSection.lines.join("\n")),
        startIndex: currentSection.startIndex,
        endIndex
      });
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineStart = offset;
      const hasNewline = index < lines.length - 1;
      const lineEnd = lineStart + line.length + (hasNewline ? 1 : 0);
      const fenceMatch = line.match(/^(```|~~~)/);
      if (fenceMatch) {
        const nextFenceChar = fenceMatch[1][0];
        fenceChar = fenceChar === nextFenceChar ? "" : (fenceChar || nextFenceChar);
      }

      const headingMatch = !fenceChar ? line.match(/^#\s*(.*?)\s*$/) : null;
      if (headingMatch) {
        pushSection(lineStart);
        const prefixStart = pendingPrefixLines[0]?.startIndex;
        currentSection = {
          title: String(headingMatch[1] || "").trim(),
          lines: sections.length === 0 ? pendingPrefixLines.map((item) => item.line) : [],
          startIndex: sections.length === 0 && Number.isFinite(prefixStart) ? prefixStart : lineStart
        };
        pendingPrefixLines = [];
        offset = lineEnd;
        continue;
      }

      const lineRecord = { line, startIndex: lineStart };
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        pendingPrefixLines.push(lineRecord);
      }
      offset = lineEnd;
    }

    pushSection(text.length);

    if (!sections.length) {
      return [{
        title: "",
        content: trimOuterBlankLines(text),
        startIndex: 0,
        endIndex: text.length
      }];
    }

    return sections;
  };

  const parseMarkdownToSteps = (rawMarkdown) => {
    const text = normalizeMarkdownText(rawMarkdown);
    const sections = extractMarkdownSections(text);

    if (!sections.length) {
      const single = trimOuterBlankLines(text);
      if (!single) {
        return createBlankSteps();
      }
      return [{
        id: 1,
        title: "",
        subtitle: "",
        content: single
      }];
    }

    return sections.map((section, index) => ({
      id: index + 1,
      title: String(section.title || "").trim(),
      subtitle: "",
      content: String(section.content || "")
    }));
  };

  const formatBytes = (value) => {
    const bytes = Math.max(0, Number(value || 0));
    if (!bytes) {
      return "0 B";
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isMarkdownFileName = (name) => String(name || "").toLowerCase().endsWith(".md");

  const isMarkdownFileTooLarge = (size) => {
    const bytes = Number(size);
    return Number.isFinite(bytes) && bytes > MAX_MARKDOWN_FILE_BYTES;
  };

  const serializeStepsToMarkdown = (sourceSteps) => {
    const normalizedSteps = Array.isArray(sourceSteps) ? sourceSteps : [];
    if (!normalizedSteps.length || isSingleBlankStepList(normalizedSteps)) {
      return "";
    }
    if (normalizedSteps.length === 1 && !String(normalizedSteps[0]?.title || "").trim()) {
      const rawContent = trimOuterBlankLines(normalizeMarkdownText(normalizedSteps[0]?.content || ""));
      return rawContent ? `${rawContent}\n` : "";
    }
    const chunks = normalizedSteps.map((step, index) => {
      const title = String(step?.title || "").trim() || defaultStepTitle(index);
      const content = trimOuterBlankLines(normalizeMarkdownText(step?.content || ""));
      return content ? `#${title}\n\n${content}` : `#${title}`;
    });
    return `${chunks.join("\n\n").trim()}\n`;
  };

  const syncDocumentMarkdownFromSteps = (sourceSteps = steps.value) => {
    const nextMarkdown = serializeStepsToMarkdown(sourceSteps);
    if (documentMarkdown.value === nextMarkdown) {
      return;
    }
    pendingDocumentMarkdownFromSteps = nextMarkdown;
    documentMarkdown.value = nextMarkdown;
  };

  const applyExternalMarkdownChange = async (nextMarkdown, { focusIndex = null } = {}) => {
    documentMarkdown.value = normalizeMarkdownText(nextMarkdown);
    await nextTick();
    await syncVisualEditorFromMarkdown(true);
    if (Number.isFinite(focusIndex)) {
      const safeIndex = clamp(Number(focusIndex) || 0, 0, Math.max(0, steps.value.length - 1));
      currentId.value = steps.value[safeIndex]?.id ?? steps.value[0]?.id ?? 1;
      if (isEditMode.value) {
        await focusStepInEditMode(safeIndex);
      }
    }
  };

  const syncStepsFromDocumentMarkdown = (rawMarkdown, preserveIndex = currentStepIndex.value) => {
    const parsed = parseMarkdownToSteps(rawMarkdown);
    const targetIndex = clamp(Number(preserveIndex) || 0, 0, Math.max(0, parsed.length - 1));
    pendingStepsFromDocumentMarkdown = true;
    steps.value = parsed;
    currentId.value = parsed[targetIndex]?.id ?? parsed[0]?.id ?? 1;
  };

  const writeActiveMarkdownNow = async (targetRelPath = activeMarkdownRelPath.value) => {
    const relPath = String(targetRelPath || "").trim();
    if (!isDesktopStorage || !canWorkspaceFileIO || !relPath || markdownHydrating.value) {
      return;
    }
    try {
      const content = String(documentMarkdown.value || "");
      const result = await desktopDataBridge.writeWorkspaceFile({
        relPath,
        content
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "write_workspace_file_failed"));
      }
    } catch (error) {
      showToast(`保存 Markdown 失败: ${String(error?.message || error || "unknown_error")}`);
    }
  };

  const scheduleActiveMarkdownSave = () => {
    if (!activeMarkdownRelPath.value || markdownHydrating.value) {
      return;
    }
    if (markdownSaveTimer) {
      clearTimeout(markdownSaveTimer);
    }
    markdownSaveTimer = setTimeout(() => {
      markdownSaveTimer = null;
      void writeActiveMarkdownNow();
    }, MARKDOWN_SAVE_DELAY_MS);
  };

  const clearScheduledMarkdownSave = () => {
    if (!markdownSaveTimer) {
      return;
    }
    clearTimeout(markdownSaveTimer);
    markdownSaveTimer = null;
  };

  const flushPendingMarkdownSave = async (targetRelPath = activeMarkdownRelPath.value) => {
    const relPath = String(targetRelPath || "").trim();
    if (!relPath || markdownHydrating.value) {
      return;
    }
    clearScheduledMarkdownSave();
    await writeActiveMarkdownNow(relPath);
  };

  const persistActiveMarkdownBeforeSwitch = async (targetRelPath = "") => {
    const currentRelPath = String(activeMarkdownRelPath.value || "").trim();
    const nextRelPath = String(targetRelPath || "").trim();
    if (!currentRelPath) {
      clearScheduledMarkdownSave();
      return;
    }
    if (!markdownSaveTimer && currentRelPath === nextRelPath) {
      return;
    }
    await flushPendingMarkdownSave(currentRelPath);
  };

  const loadStepsFromMarkdownFile = async (relPath, showSuccessToast = false) => {
    if (!isDesktopStorage || !canWorkspaceFileIO) {
      return;
    }
    const targetRelPath = String(relPath || "").trim();
    if (!targetRelPath) {
      return;
    }
    await persistActiveMarkdownBeforeSwitch(targetRelPath);
    markdownHydrating.value = true;
    pendingDocumentMarkdownFromSteps = null;
    pendingStepsFromDocumentMarkdown = false;
    try {
      const result = await desktopDataBridge.readWorkspaceFile({
        relPath: targetRelPath
      });
      if (!result?.ok) {
        if (result?.error === "workspace_file_too_large") {
          const actual = formatBytes(result?.size);
          const limit = formatBytes(result?.limitBytes || MAX_MARKDOWN_FILE_BYTES);
          showToast(`Markdown 文件过大，已跳过: ${targetRelPath} (${actual} > ${limit})`);
          return;
        }
        throw new Error(String(result?.error || "read_workspace_file_failed"));
      }
      if (isMarkdownFileTooLarge(result?.size) || String(result.content || "").length > MAX_MARKDOWN_FILE_BYTES) {
        showToast(`Markdown 文件过大，已跳过: ${targetRelPath}`);
        return;
      }
      const rawMarkdown = normalizeMarkdownText(result.content || "");
      const parsed = parseMarkdownToSteps(rawMarkdown);
      documentMarkdown.value = rawMarkdown;
      steps.value = parsed;
      currentId.value = parsed[0]?.id ?? 1;
      activeMarkdownRelPath.value = targetRelPath;
      if (showSuccessToast) {
        showToast(`已载入 Markdown: ${targetRelPath}`);
      }
    } catch (error) {
      showToast(`载入 Markdown 失败: ${String(error?.message || error || "unknown_error")}`);
    } finally {
      markdownHydrating.value = false;
    }
  };

  const resetBlankEditorState = ({ preserveActiveFile = false } = {}) => {
    if (!preserveActiveFile) {
      activeMarkdownRelPath.value = "";
    }
    pendingStepsFromDocumentMarkdown = false;
    pendingDocumentMarkdownFromSteps = "";
    documentMarkdown.value = "";
    steps.value = createBlankSteps();
    currentId.value = steps.value[0]?.id ?? 1;
  };

  const appendMarkdownImage = (url) => {
    const safeUrl = String(url || "").trim();
    if (!safeUrl) {
      return;
    }
    if (isEditMode.value && visualEditorRef.value) {
      return false;
    }
    const current = String(documentMarkdown.value || "");
    const suffix = current.endsWith("\n") ? "\n" : "\n\n";
    documentMarkdown.value = `${current}${suffix}![image](${safeUrl})\n`;
    return true;
  };

  const addStep = async () => {
    const list = parseMarkdownToSteps(documentMarkdown.value);
    if (!list.length || isSingleBlankStepList(list)) {
      await applyExternalMarkdownChange(`# ${defaultStepTitle(0)}\n`, { focusIndex: 0 });
      return;
    }

    const insertIndex = clamp(currentStepIndex.value + 1, 0, list.length);
    const nextSteps = list.map((step) => ({ ...step }));
    nextSteps.splice(insertIndex, 0, {
      id: 0,
      title: defaultStepTitle(insertIndex),
      subtitle: "",
      content: ""
    });
    await applyExternalMarkdownChange(serializeStepsToMarkdown(nextSteps), { focusIndex: insertIndex });
  };

  const removeStep = async () => {
    const list = parseMarkdownToSteps(documentMarkdown.value);
    if (!list.length || isSingleBlankStepList(list)) {
      await applyExternalMarkdownChange("", { focusIndex: 0 });
      return;
    }
    const idx = clamp(currentStepIndex.value, 0, Math.max(0, list.length - 1));
    if (list.length === 1) {
      await applyExternalMarkdownChange("", { focusIndex: 0 });
      return;
    }
    const nextSteps = list.map((step) => ({ ...step }));
    nextSteps.splice(idx, 1);
    const nextIndex = Math.max(0, idx - 1);
    await applyExternalMarkdownChange(serializeStepsToMarkdown(nextSteps), { focusIndex: nextIndex });
  };

  documentMarkdown.value = serializeStepsToMarkdown(steps.value);

  watch(documentMarkdown, (value) => {
    if (markdownHydrating.value) {
      void syncVisualEditorFromMarkdown(true);
      return;
    }
    if (pendingDocumentMarkdownFromSteps !== null && value === pendingDocumentMarkdownFromSteps) {
      pendingDocumentMarkdownFromSteps = null;
      void syncVisualEditorFromMarkdown(true);
      return;
    }
    pendingDocumentMarkdownFromSteps = null;
    syncStepsFromDocumentMarkdown(value);
    void syncVisualEditorFromMarkdown();
    if (!activeMarkdownRelPath.value) {
      return;
    }
    scheduleActiveMarkdownSave();
  });

  watch(steps, () => {
    if (pendingStepsFromDocumentMarkdown) {
      pendingStepsFromDocumentMarkdown = false;
    } else {
      syncDocumentMarkdownFromSteps();
    }
    if (!activeMarkdownRelPath.value || markdownHydrating.value) {
      return;
    }
    scheduleActiveMarkdownSave();
  }, { deep: true });

  watch(currentId, () => {
    if (pendingStepsFromDocumentMarkdown) {
      pendingStepsFromDocumentMarkdown = false;
    }
  });

  watch(activeMarkdownRelPath, () => {
    clearScheduledMarkdownSave();
  });

  onBeforeUnmount(() => {
    clearScheduledMarkdownSave();
  });

  return {
    activeMarkdownRelPath,
    appendMarkdownImage,
    clearScheduledMarkdownSave,
    documentMarkdown,
    flushPendingMarkdownSave,
    formatBytes,
    isMarkdownFileName,
    isMarkdownFileTooLarge,
    isSingleBlankStepList,
    loadStepsFromMarkdownFile,
    markdownHydrating,
    parseMarkdownToSteps,
    persistActiveMarkdownBeforeSwitch,
    removeStep,
    resetBlankEditorState,
    serializeStepsToMarkdown,
    stepDisplayTitle,
    stepPreviewText,
    syncDocumentMarkdownFromSteps,
    writeActiveMarkdownNow,
    addStep
  };
};
