import { createApp } from "vue";
import App from "./App.vue";
import "./styles/main.css";
import "prismjs/themes/prism-okaidia.css";
import "xterm/css/xterm.css";
import { registerSW } from "virtual:pwa-register";

const isDesktopRuntime = typeof window !== "undefined" && Boolean(window.desktopPty?.isDesktop);
if (!isDesktopRuntime) {
  registerSW({ immediate: true });
}

createApp(App).mount("#app");
