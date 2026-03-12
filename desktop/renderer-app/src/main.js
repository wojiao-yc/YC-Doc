import { createApp } from "vue";
import App from "./App.vue";
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
import "xterm/css/xterm.css";
import { registerSW } from "virtual:pwa-register";

const isDesktopRuntime = typeof window !== "undefined" && Boolean(window.desktopPty?.isDesktop);
if (!isDesktopRuntime) {
  registerSW({ immediate: true });
}

createApp(App).mount("#app");
