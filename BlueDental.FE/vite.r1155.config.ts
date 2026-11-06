// TEMP (R-1155 verification) — delete after use. Preview of the scratchpad build, proxied to the isolated host on :5155.
import { defineConfig } from "vite";

const target = "http://127.0.0.1:5155";

export default defineConfig({
  build: {
    outDir: "C:/Users/ADMIN/AppData/Local/Temp/claude/c--Users-ADMIN-workspace-Free-BlueDental/5c59970b-e3eb-4e3d-a267-15e6c0b6749e/scratchpad/fe-dist",
  },
  preview: {
    port: 8175,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/api": { target, changeOrigin: true, secure: false },
      "/signalr": { target, changeOrigin: true, secure: false, ws: true },
    },
  },
});
