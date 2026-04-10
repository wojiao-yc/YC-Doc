import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  },
  optimizeDeps: {
    include: ["katex"]
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "MarkVein",
        short_name: "MarkVein",
        description: "MarkVein Markdown Workspace",
        theme_color: "#f97316",
        background_color: "#0f172a",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      }
    })
  ]
});
