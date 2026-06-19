import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the Node server so there are no CORS surprises.
      "/api": "http://localhost:3001",
    },
  },
});
