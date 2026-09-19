import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 指引是独立入口，base 必须是 /guide/，不能跟 /match/ 共用一次构建。
export default defineConfig({
  base: "/guide/",
  plugins: [vue()],
  publicDir: fileURLToPath(new URL("./public-guide", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../guide", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./guide.html", import.meta.url)),
    },
  },
  server: {
    port: 8502,
  },
});
