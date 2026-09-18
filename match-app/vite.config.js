import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 构建产物直接落到 intendCoding/match/，由 8500 的静态服务托管。
export default defineConfig({
  base: "/match/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../match", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 8501,
    proxy: {
      "/api": "http://127.0.0.1:8500",
    },
  },
});
