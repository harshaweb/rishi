import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  root: resolve(import.meta.dirname),
  envDir: resolve(import.meta.dirname, ".."),
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      allow: [
        resolve(import.meta.dirname),
        resolve(import.meta.dirname, "../node_modules"),
        resolve(import.meta.dirname, "../server/shared"),
      ],
    },
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/media": "http://127.0.0.1:3001",
      "/robots.txt": "http://127.0.0.1:3001",
      "/sitemap.xml": "http://127.0.0.1:3001",
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
