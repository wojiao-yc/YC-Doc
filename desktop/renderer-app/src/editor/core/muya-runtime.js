import {
  CodeBlockLanguageSelector,
  EmojiSelector,
  ImageResizeBar,
  ImageToolBar,
  InlineFormatToolbar,
  Muya,
  ParagraphFrontButton,
  ParagraphFrontMenu,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  TableColumnToolbar,
  TableDragBar,
  TableRowColumMenu,
  zh
} from "@muyajs/core";
import "@muyajs/core/lib/core.css";
import "../../styles/muya-overrides.css";

const RUNTIME_KEY = "__YC_DOC_MUYA_RUNTIME__";

const getRuntimeState = () => {
  const globalTarget = globalThis;
  if (!globalTarget[RUNTIME_KEY]) {
    globalTarget[RUNTIME_KEY] = {
      registered: false
    };
  }
  return globalTarget[RUNTIME_KEY];
};

export const ensureMuyaRuntimeRegistered = () => {
  const runtime = getRuntimeState();
  if (runtime.registered) {
    return;
  }

  Muya.use(EmojiSelector);
  Muya.use(InlineFormatToolbar);
  Muya.use(ImageToolBar);
  Muya.use(ImageResizeBar);
  Muya.use(CodeBlockLanguageSelector);

  Muya.use(ParagraphFrontButton);
  Muya.use(ParagraphFrontMenu);
  Muya.use(TableColumnToolbar);
  Muya.use(ParagraphQuickInsertMenu);
  Muya.use(TableDragBar);
  Muya.use(TableRowColumMenu);
  Muya.use(PreviewToolBar);

  runtime.registered = true;
};

export const createMuyaInstance = (container, {
  markdown = "",
  presentationEnabled = true
} = {}) => {
  ensureMuyaRuntimeRegistered();
  const muya = new Muya(container, {
    markdown,
    hideQuickInsertHint: !presentationEnabled,
    spellcheckEnabled: false
  });
  muya.locale(zh);
  muya.init();
  return muya;
};
