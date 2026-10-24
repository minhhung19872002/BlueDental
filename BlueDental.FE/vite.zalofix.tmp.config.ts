// TEMPORARY (local e2e only, do not commit): preview on 8150 against the isolated host on 5120.
import { mergeConfig } from "vite";
import base from "./vite.config";

const target = "http://127.0.0.1:5120";

export default mergeConfig(base, {
  preview: {
    host: "127.0.0.1",
    port: 8150,
    strictPort: true,
    proxy: {
      "/api": { target },
      "/signalr": { target },
    },
  },
});
