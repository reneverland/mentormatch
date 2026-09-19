import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 平台入口独立构建。outDir 打到 home/，不能清空站点根目录。
export default defineConfig({
  base: "/",
  plugins: [vue()],
  publicDir: fileURLToPath(new URL("./public-home", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../home", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./home.html", import.meta.url)),
    },
  },
  server: {
    port: 8503,
  },
});
