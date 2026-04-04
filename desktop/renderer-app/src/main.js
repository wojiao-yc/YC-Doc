import { createApp } from "vue";
import App from "./App.vue";
import "./themes/base/index.css";
import "./themes/default-light/index.css";
import "./themes/default-dark/index.css";
import "./themes/paper-amber/index.css";
import "./styles/main.css";
import "./styles/editor.css";
import "./styles/document-layout.css";
import "./styles/typography.css";
import "./styles/headings.css";
import "./styles/lists.css";
import "./styles/blockquote.css";
import "./styles/code-block.css";
import "./styles/special-blocks.css";
import "./styles/editor-theme.css";
import "./styles/editor-context-menu.css";
import "./styles/editor-context-menu-icons.css";
import "katex/dist/katex.min.css";
import "xterm/css/xterm.css";
import { registerSW } from "virtual:pwa-register";

const isDesktopRuntime = typeof window !== "undefined" && Boolean(window.desktopPty?.isDesktop);
if (!isDesktopRuntime) {
  registerSW({ immediate: true });
}

createApp(App).mount("#app");
