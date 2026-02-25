import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/agent": { target: "http://localhost:3847", timeout: 0 },
      "/projects": "http://localhost:3847",
      "/logs": "http://localhost:3847",
      "/threads": "http://localhost:3847",
      "/health": "http://localhost:3847",
      "/devserver": { target: "http://localhost:3847", timeout: 0 },
    },
  },
});
