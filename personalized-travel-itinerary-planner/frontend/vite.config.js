import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// strictPort: if 5173 is busy, Vite stops with a clear error instead of silently
// picking another port (the backend only allows http://localhost:5173 by default).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
});
