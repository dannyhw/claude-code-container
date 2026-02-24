import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/agent": { target: "http://localhost:3847", timeout: 0 },
      "/projects": "http://localhost:3847",
      "/logs": "http://localhost:3847",
      "/health": "http://localhost:3847",
    },
  },
});
