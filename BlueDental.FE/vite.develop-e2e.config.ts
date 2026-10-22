// TEMPORARY (local e2e only, do not commit): preview on 8130 against the develop host on 5100.
import { mergeConfig } from "vite";
import base from "./vite.config";

const target = "http://127.0.0.1:5100";

export default mergeConfig(base, {
  preview: {
    port: 8130,
    proxy: {
      "/api": { target },
      "/signalr": { target },
    },
  },
});
