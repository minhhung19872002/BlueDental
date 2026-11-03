// TEMPORARY (local e2e only, do not commit): preview on 8170 against the host on 5140.
import { mergeConfig } from "vite";
import base from "./vite.config";

const target = "http://127.0.0.1:5140";

export default mergeConfig(base, {
  build: { outDir: "dist-p291003" },
  preview: {
    port: 8170,
    strictPort: true,
    proxy: {
      "/api": { target },
      "/signalr": { target, ws: true },
    },
  },
});
