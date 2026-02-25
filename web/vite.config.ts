import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
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
