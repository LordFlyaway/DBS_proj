import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// envDir: read the project-root .env (only VITE_* variables reach the browser)
export default defineConfig({
  plugins: [react()],
  envDir: "..",
  build: { chunkSizeWarningLimit: 800 },
});
