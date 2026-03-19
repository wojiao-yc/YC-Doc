import { EditorView, ViewPlugin } from "@codemirror/view";

const MENU_GAP = 8;
const SUBMENU_GAP = 2;
const DEFAULT_LINK_URL = "https://";

const safeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const selectionRangeOf = (view) => {
  const main = view.state.selection.main;
  return {
    from: Math.min(main.from, main.to),
    to: Math.max(main.from, main.to),
    empty: main.empty
  };
};

const replaceSelection = (view, insert, selection = null) => {
  const range = selectionRangeOf(view);
  const text = String(insert ?? "");
  const fallbackCursor = range.from + text.length;
  const anchor = safeNumber(selection?.anchor, fallbackCursor);
  const head = safeNumber(selection?.head, anchor);
  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: text
    },
    selection: { anchor, head },
    scrollIntoView: true,
    userEvent: "input"
  });
  view.focus();
  return true;
};

const surroundSelection = (view, { prefix = "", suffix = "", placeholder = "" } = {}) => {
  const range = selectionRangeOf(view);
  const selectedText = view.state.sliceDoc(range.from, range.to);
  const inner = range.empty ? String(placeholder || "") : selectedText;
  const insert = `${prefix}${inner}${suffix}`;
  const innerFrom = range.from + String(prefix).length;
  const innerTo = innerFrom + inner.length;
  return replaceSelection(view, insert, { anchor: innerFrom, head: innerTo });
};

const selectedLinesRangeOf = (view) => {
  const doc = view.state.doc;
  const range = selectionRangeOf(view);
  const startLine = doc.lineAt(range.from);
  const endPos = range.empty ? range.from : Math.max(range.from, range.to - 1);
  const endLine = doc.lineAt(endPos);
  return {
    from: startLine.from,
    to: endLine.to
  };
};

const replaceSelectedLines = (view, transformLine) => {
  const doc = view.state.doc;
  const range = selectedLinesRangeOf(view);
  const raw = doc.sliceString(range.from, range.to);
  const lines = raw.split("\n");
  const next = lines.map((line, index) => transformLine(String(line || ""), index, lines)).join("\n");
  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: next
    },
    selection: {
      anchor: range.from,
      head: range.from + next.length
    },
    scrollIntoView: true,
    userEvent: "input"
  });
  view.focus();
  return true;
};

const BLOCK_PREFIX_PATTERN = /^(\s{0,3})(?:>\s*|#{1,6}[ \t]+|[-+*][ \t]+\[(?: |x|X)\][ \t]+|[-+*][ \t]+|\d+[.)][ \t]+)/;

const stripParagraphPrefix = (lineInput) => {
  let line = String(lineInput || "");
  for (let index = 0; index < 4; index += 1) {
    const next = line.replace(BLOCK_PREFIX_PATTERN, "$1");
    if (next === line) {
      break;
    }
    line = next;
  }
  return line;
};

const applyParagraphStyle = (view, style) => {
  let orderedIndex = 1;
  const headingMatch = String(style || "").match(/^h([1-6])$/);
  const headingLevel = headingMatch ? Number(headingMatch[1]) : 0;

  return replaceSelectedLines(view, (line) => {
    const normalized = stripParagraphPrefix(line);
    const content = normalized.trimStart();
    const hasContent = Boolean(content);

    if (style === "paragraph") {
      return normalized;
    }
    if (style === "bullet") {
      return hasContent ? `- ${content}` : "- ";
    }
    if (style === "ordered") {
      const text = hasContent ? `${orderedIndex}. ${content}` : `${orderedIndex}. `;
      orderedIndex += 1;
      return text;
    }
    if (style === "task") {
      return hasContent ? `- [ ] ${content}` : "- [ ] ";
    }
    if (style === "quote") {
      return hasContent ? `> ${content}` : "> ";
    }
    if (headingLevel >= 1 && headingLevel <= 6) {
      return hasContent ? `${"#".repeat(headingLevel)} ${content}` : `${"#".repeat(headingLevel)} `;
    }
    return line;
  });
};

const clearInlineMarkdownSyntax = (sourceInput) => {
  let source = String(sourceInput || "");
  const patterns = [
    [/\[([^\]]+)\]\(([^)]+)\)/g, "$1"],
    [/%%([\s\S]+?)%%/g, "$1"],
    [/==([\s\S]+?)==/g, "$1"],
    [/~~([\s\S]+?)~~/g, "$1"],
    [/`([^`\n]+)`/g, "$1"],
    [/\$([^$\n]+)\$/g, "$1"],
    [/\*\*([\s\S]+?)\*\*/g, "$1"],
    [/__([\s\S]+?)__/g, "$1"],
    [/\*([^*\n]+)\*/g, "$1"],
    [/_([^_\n]+)_/g, "$1"]
  ];
  for (const [pattern, replacement] of patterns) {
    source = source.replace(pattern, replacement);
  }
  return source;
};

const commandClearFormat = (view) => {
  const range = selectionRangeOf(view);
  if (range.empty) {
    return false;
  }
  const selectedText = view.state.sliceDoc(range.from, range.to);
  const cleaned = clearInlineMarkdownSyntax(selectedText);
  return replaceSelection(view, cleaned, {
    anchor: range.from,
    head: range.from + cleaned.length
  });
};

const promptLinkUrl = (defaultValue = DEFAULT_LINK_URL) => {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    return defaultValue;
  }
  return window.prompt("请输入链接地址", defaultValue);
};

const commandInsertLink = (view) => {
  const range = selectionRangeOf(view);
  const selectedText = view.state.sliceDoc(range.from, range.to).trim();
  const linkText = selectedText || "";
  const suggestedUrl = /^https?:\/\//i.test(selectedText) ? selectedText : DEFAULT_LINK_URL;
  const prompted = promptLinkUrl(suggestedUrl);
  if (prompted == null) {
    return false;
  }
  const url = String(prompted || "").trim() || DEFAULT_LINK_URL;
  const markdown = `[${linkText}](${url})`;
  return replaceSelection(view, markdown, {
    anchor: range.from + 1,
    head: range.from + 1 + linkText.length
  });
};

const insertBlockTemplate = (view, { prefixLine = "", suffixLine = "", placeholder = "" } = {}) => {
  const range = selectionRangeOf(view);
  const selectedText = view.state.sliceDoc(range.from, range.to);
  const inner = range.empty ? String(placeholder || "") : selectedText;
  const insert = `${prefixLine}\n${inner}\n${suffixLine}`;
  const innerFrom = range.from + String(prefixLine).length + 1;
  const innerTo = innerFrom + inner.length;
  return replaceSelection(view, insert, { anchor: innerFrom, head: innerTo });
};

const commandInsertFootnote = (view) => {
  const docText = view.state.doc.toString();
  const matches = [...docText.matchAll(/\[\^(\d+)\]:/g)];
  const nextNumber = matches.reduce((max, match) => Math.max(max, Number(match[1] || 0)), 0) + 1;
  const ref = `[^${nextNumber}]`;
  const definition = `\n\n[^${nextNumber}]: `;
  const insert = `${ref}${definition}`;
  const range = selectionRangeOf(view);
  return replaceSelection(view, insert, {
    anchor: range.from + insert.length,
    head: range.from + insert.length
  });
};

const commandInsertTable = (view) =>
  replaceSelection(
    view,
    "|  |  |\n| --- | --- |\n|  |  |"
  );

const commandInsertCallout = (view) =>
  replaceSelection(view, "> [!NOTE]\n> ");

const commandInsertDivider = (view) =>
  replaceSelection(view, "\n---\n");

const commandInsertCodeBlock = (view) =>
  insertBlockTemplate(view, {
    prefixLine: "```",
    suffixLine: "```"
  });

const commandInsertMathBlock = (view) =>
  insertBlockTemplate(view, {
    prefixLine: "$$",
    suffixLine: "$$"
  });

const commandInsertDatabase = (view) =>
  replaceSelection(
    view,
    "|  |  |  |  |\n| --- | --- | --- | --- |\n|  |  |  |  |"
  );

const writeClipboardText = async (text) => {
  const clipboard = globalThis?.navigator?.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") {
    return false;
  }
  await clipboard.writeText(String(text || ""));
  return true;
};

const readClipboardText = async () => {
  const clipboard = globalThis?.navigator?.clipboard;
  if (!clipboard || typeof clipboard.readText !== "function") {
    return null;
  }
  return clipboard.readText();
};

const commandCopy = async (view) => {
  const range = selectionRangeOf(view);
  if (range.empty) {
    return false;
  }
  const text = view.state.sliceDoc(range.from, range.to);
  await writeClipboardText(text);
  view.focus();
  return true;
};

const commandCut = async (view) => {
  const range = selectionRangeOf(view);
  if (range.empty) {
    return false;
  }
  const text = view.state.sliceDoc(range.from, range.to);
  await writeClipboardText(text);
  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: ""
    },
    selection: {
      anchor: range.from,
      head: range.from
    },
    scrollIntoView: true,
    userEvent: "delete.cut"
  });
  view.focus();
  return true;
};

const commandPaste = async (view, { plain = false } = {}) => {
  const raw = await readClipboardText();
  if (raw == null) {
    return false;
  }
  const text = plain ? String(raw).replace(/\r\n/g, "\n") : String(raw);
  return replaceSelection(view, text);
};

const commandSelectAll = (view) => {
  view.dispatch({
    selection: {
      anchor: 0,
      head: view.state.doc.length
    },
    scrollIntoView: true,
    userEvent: "select.all"
  });
  view.focus();
  return true;
};

const executeCommand = async (view, commandId) => {
  try {
    switch (String(commandId || "")) {
      case "add-link":
        return commandInsertLink(view);
      case "add-external-link":
        return commandInsertLink(view);
      case "format-bold":
        return surroundSelection(view, { prefix: "**", suffix: "**" });
      case "format-italic":
        return surroundSelection(view, { prefix: "*", suffix: "*" });
      case "format-strike":
        return surroundSelection(view, { prefix: "~~", suffix: "~~" });
      case "format-highlight":
        return surroundSelection(view, { prefix: "==", suffix: "==" });
      case "format-code":
        return surroundSelection(view, { prefix: "`", suffix: "`" });
      case "format-math":
        return surroundSelection(view, { prefix: "$", suffix: "$" });
      case "format-comment":
        return surroundSelection(view, { prefix: "%%", suffix: "%%" });
      case "format-clear":
        return commandClearFormat(view);
      case "paragraph-bullet":
        return applyParagraphStyle(view, "bullet");
      case "paragraph-ordered":
        return applyParagraphStyle(view, "ordered");
      case "paragraph-task":
        return applyParagraphStyle(view, "task");
      case "paragraph-h1":
        return applyParagraphStyle(view, "h1");
      case "paragraph-h2":
        return applyParagraphStyle(view, "h2");
      case "paragraph-h3":
        return applyParagraphStyle(view, "h3");
      case "paragraph-h4":
        return applyParagraphStyle(view, "h4");
      case "paragraph-h5":
        return applyParagraphStyle(view, "h5");
      case "paragraph-h6":
        return applyParagraphStyle(view, "h6");
      case "paragraph-text":
        return applyParagraphStyle(view, "paragraph");
      case "paragraph-quote":
        return applyParagraphStyle(view, "quote");
      case "insert-footnote":
        return commandInsertFootnote(view);
      case "insert-table":
        return commandInsertTable(view);
      case "insert-callout":
        return commandInsertCallout(view);
      case "insert-divider":
        return commandInsertDivider(view);
      case "insert-code-block":
        return commandInsertCodeBlock(view);
      case "insert-math-block":
        return commandInsertMathBlock(view);
      case "insert-database":
        return commandInsertDatabase(view);
      case "clipboard-cut":
        return commandCut(view);
      case "clipboard-copy":
        return commandCopy(view);
      case "clipboard-paste":
        return commandPaste(view);
      case "clipboard-paste-plain":
        return commandPaste(view, { plain: true });
      case "select-all":
        return commandSelectAll(view);
      default:
        return false;
    }
  } catch (error) {
    console.error("[yc-editor] context menu command failed:", commandId, error);
    return false;
  }
};

const MENU_DEFINITION = [
  { id: "add-link", icon: "⛓", label: "新增链接" },
  { id: "add-external-link", icon: "↗", label: "新增外部链接" },
  { type: "separator" },
  {
    id: "format",
    icon: "✎",
    label: "文本格式",
    children: [
      { id: "format-bold", icon: "B", label: "加粗" },
      { id: "format-italic", icon: "I", label: "倾斜" },
      { id: "format-strike", icon: "S", label: "删除线" },
      { id: "format-highlight", icon: "H", label: "高亮" },
      { type: "separator" },
      { id: "format-code", icon: "</>", label: "代码" },
      { id: "format-math", icon: "Σ", label: "数学" },
      { id: "format-comment", icon: "%", label: "注释" },
      { type: "separator" },
      { id: "format-clear", icon: "⌫", label: "清除格式" }
    ]
  },
  {
    id: "paragraph",
    icon: "¶",
    label: "段落设置",
    children: [
      { id: "paragraph-bullet", icon: "•", label: "无序列表" },
      { id: "paragraph-ordered", icon: "1.", label: "有序列表" },
      { id: "paragraph-task", icon: "☑", label: "任务列表" },
      { type: "separator" },
      { id: "paragraph-h1", icon: "H1", label: "1级标题" },
      { id: "paragraph-h2", icon: "H2", label: "2级标题" },
      { id: "paragraph-h3", icon: "H3", label: "3级标题" },
      { id: "paragraph-h4", icon: "H4", label: "4级标题" },
      { id: "paragraph-h5", icon: "H5", label: "5级标题" },
      { id: "paragraph-h6", icon: "H6", label: "6级标题" },
      { id: "paragraph-text", icon: "T", label: "正文" },
      { type: "separator" },
      { id: "paragraph-quote", icon: "❝", label: "引用" }
    ]
  },
  {
    id: "insert",
    icon: "⊕",
    label: "插入",
    children: [
      { id: "insert-footnote", icon: "¤", label: "脚注" },
      { id: "insert-table", icon: "▦", label: "表格" },
      { id: "insert-callout", icon: "❞", label: "标注" },
      { id: "insert-divider", icon: "—", label: "分隔线" },
      { type: "separator" },
      { id: "insert-code-block", icon: "<>", label: "代码块" },
      { id: "insert-math-block", icon: "∑", label: "数学块" },
      { id: "insert-database", icon: "☷", label: "新建数据库" }
    ]
  },
  { type: "separator" },
  { id: "clipboard-cut", icon: "✂", label: "剪切" },
  { id: "clipboard-copy", icon: "⧉", label: "复制" },
  { id: "clipboard-paste", icon: "⎘", label: "粘贴" },
  { id: "clipboard-paste-plain", icon: "T", label: "以纯文本形式粘贴" },
  { id: "select-all", icon: "□", label: "全选" }
];

const withDisabledState = (items, view) => {
  const selection = selectionRangeOf(view);
  const canReadClipboard = Boolean(globalThis?.navigator?.clipboard?.readText);
  const canWriteClipboard = Boolean(globalThis?.navigator?.clipboard?.writeText);
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.type === "separator") {
      return item;
    }
    const id = String(item?.id || "");
    const disabled = id === "clipboard-cut" || id === "clipboard-copy"
      ? selection.empty || !canWriteClipboard
      : (id === "clipboard-paste" || id === "clipboard-paste-plain")
        ? !canReadClipboard
        : false;
    return {
      ...item,
      disabled,
      children: item?.children ? withDisabledState(item.children, view) : undefined
    };
  });
};

const shouldKeepSelectionOnContextMenu = (view, pos) => {
  const selection = selectionRangeOf(view);
  if (selection.empty) {
    return false;
  }
  return pos >= selection.from && pos <= selection.to;
};

class EditorContextMenuController {
  constructor(view) {
    this.view = view;
    this.rootMenuEl = null;
    this.subMenuEl = null;
    this.activeSubmenuItemEl = null;

    this.onOutsideMouseDown = this.onOutsideMouseDown.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onDocumentKeyDown = this.onDocumentKeyDown.bind(this);
  }

  update(update) {
    if (update.docChanged && this.rootMenuEl) {
      this.closeMenu();
    }
  }

  destroy() {
    this.closeMenu();
  }

  isDarkMode() {
    return Boolean(this.view.dom.closest(".yc-editor-shell.is-dark"));
  }

  handleContextMenu(event) {
    if (!(event instanceof MouseEvent)) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();

    const pos = this.view.posAtCoords({
      x: safeNumber(event.clientX, 0),
      y: safeNumber(event.clientY, 0)
    });
    if (Number.isFinite(pos) && !shouldKeepSelectionOnContextMenu(this.view, pos)) {
      this.view.dispatch({
        selection: {
          anchor: pos,
          head: pos
        },
        scrollIntoView: true
      });
    }

    this.openMenu(event.clientX, event.clientY);
    return true;
  }

  openMenu(clientX, clientY) {
    this.closeMenu();
    const items = withDisabledState(MENU_DEFINITION, this.view);
    this.rootMenuEl = this.buildMenuElement(items, false);
    if (!this.rootMenuEl) {
      return;
    }
    document.body.appendChild(this.rootMenuEl);
    this.positionMenuElement(this.rootMenuEl, safeNumber(clientX, 0), safeNumber(clientY, 0));
    this.bindGlobalCloseEvents();
  }

  closeMenu() {
    if (this.subMenuEl) {
      this.subMenuEl.remove();
      this.subMenuEl = null;
    }
    if (this.rootMenuEl) {
      this.rootMenuEl.remove();
      this.rootMenuEl = null;
    }
    this.activeSubmenuItemEl = null;
    this.unbindGlobalCloseEvents();
  }

  bindGlobalCloseEvents() {
    document.addEventListener("mousedown", this.onOutsideMouseDown, true);
    document.addEventListener("keydown", this.onDocumentKeyDown, true);
    window.addEventListener("resize", this.onWindowResize, true);
    window.addEventListener("blur", this.onWindowBlur, true);
  }

  unbindGlobalCloseEvents() {
    document.removeEventListener("mousedown", this.onOutsideMouseDown, true);
    document.removeEventListener("keydown", this.onDocumentKeyDown, true);
    window.removeEventListener("resize", this.onWindowResize, true);
    window.removeEventListener("blur", this.onWindowBlur, true);
  }

  onOutsideMouseDown(event) {
    const target = event?.target;
    if (!(target instanceof Node)) {
      this.closeMenu();
      return;
    }
    if (this.rootMenuEl?.contains(target) || this.subMenuEl?.contains(target)) {
      return;
    }
    this.closeMenu();
  }

  onWindowResize() {
    this.closeMenu();
  }

  onWindowBlur() {
    this.closeMenu();
  }

  onDocumentKeyDown(event) {
    if (event?.key === "Escape") {
      event.preventDefault();
      this.closeMenu();
    }
  }

  closeSubMenu() {
    if (this.subMenuEl) {
      this.subMenuEl.remove();
      this.subMenuEl = null;
    }
    if (this.activeSubmenuItemEl) {
      this.activeSubmenuItemEl.classList.remove("is-open");
      this.activeSubmenuItemEl = null;
    }
  }

  async runItemCommand(item) {
    if (!item || item.disabled || !item.id) {
      return;
    }
    const done = await executeCommand(this.view, item.id);
    if (done !== false) {
      this.closeMenu();
    }
  }

  openSubmenuForItem(item, itemEl) {
    if (!item?.children?.length || !(itemEl instanceof HTMLElement) || !this.rootMenuEl) {
      return;
    }

    if (this.activeSubmenuItemEl === itemEl && this.subMenuEl) {
      return;
    }

    this.closeSubMenu();
    const submenuItems = withDisabledState(item.children, this.view);
    const submenuEl = this.buildMenuElement(submenuItems, true);
    if (!submenuEl) {
      return;
    }
    document.body.appendChild(submenuEl);
    this.subMenuEl = submenuEl;
    this.activeSubmenuItemEl = itemEl;
    itemEl.classList.add("is-open");

    const itemRect = itemEl.getBoundingClientRect();
    const menuRect = submenuEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = itemRect.right + SUBMENU_GAP;
    if (left + menuRect.width > viewportWidth - MENU_GAP) {
      left = itemRect.left - menuRect.width - SUBMENU_GAP;
    }
    left = Math.max(MENU_GAP, Math.min(left, viewportWidth - menuRect.width - MENU_GAP));

    let top = itemRect.top;
    if (top + menuRect.height > viewportHeight - MENU_GAP) {
      top = viewportHeight - menuRect.height - MENU_GAP;
    }
    top = Math.max(MENU_GAP, top);

    submenuEl.style.left = `${Math.round(left)}px`;
    submenuEl.style.top = `${Math.round(top)}px`;
  }

  buildMenuElement(items, isSubmenu = false) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return null;
    }

    const menu = document.createElement("div");
    menu.className = `yc-editor-context-menu${isSubmenu ? " yc-editor-context-submenu" : ""}`;
    if (this.isDarkMode()) {
      menu.classList.add("is-dark");
    }
    menu.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    for (const item of list) {
      if (item?.type === "separator") {
        const separator = document.createElement("div");
        separator.className = "yc-editor-context-separator";
        menu.appendChild(separator);
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "yc-editor-context-item";
      if (item?.disabled) {
        button.classList.add("is-disabled");
        button.disabled = true;
      }
      if (Array.isArray(item?.children) && item.children.length) {
        button.classList.add("has-submenu");
      }

      const icon = document.createElement("span");
      icon.className = "yc-editor-context-icon";
      icon.textContent = String(item?.icon || "");

      const label = document.createElement("span");
      label.className = "yc-editor-context-label";
      label.textContent = String(item?.label || "");

      button.appendChild(icon);
      button.appendChild(label);

      if (Array.isArray(item?.children) && item.children.length) {
        const arrow = document.createElement("span");
        arrow.className = "yc-editor-context-arrow";
        arrow.textContent = "›";
        button.appendChild(arrow);

        button.addEventListener("mouseenter", () => {
          this.openSubmenuForItem(item, button);
        });
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.openSubmenuForItem(item, button);
        });
      } else {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await this.runItemCommand(item);
        });
      }

      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });

      menu.appendChild(button);
    }

    return menu;
  }

  positionMenuElement(menu, clientX, clientY) {
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = safeNumber(clientX, 0);
    let top = safeNumber(clientY, 0);

    if (left + rect.width > viewportWidth - MENU_GAP) {
      left = viewportWidth - rect.width - MENU_GAP;
    }
    if (top + rect.height > viewportHeight - MENU_GAP) {
      top = viewportHeight - rect.height - MENU_GAP;
    }

    left = Math.max(MENU_GAP, left);
    top = Math.max(MENU_GAP, top);

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }
}

const editorContextMenuPlugin = ViewPlugin.fromClass(EditorContextMenuController, {
  eventHandlers: {
    contextmenu(event) {
      return this.handleContextMenu(event);
    }
  }
});

export const contextMenuExtensions = [editorContextMenuPlugin];
