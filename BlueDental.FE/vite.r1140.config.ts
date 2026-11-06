// TEMP (R-1140 verification) — delete after use. Preview proxy to the isolated host on :5163.
import { defineConfig } from "vite";

const target = "http://127.0.0.1:5163";

export default defineConfig({
  preview: {
    port: 8163,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/api": { target, changeOrigin: true, secure: false },
      "/signalr": { target, changeOrigin: true, secure: false, ws: true },
    },
  },
});
