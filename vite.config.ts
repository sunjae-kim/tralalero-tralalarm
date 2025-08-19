import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Font files get a stable hash for better caching
          if (assetInfo.name && /\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name)) {
            return 'fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    headers: {
      // Cache font files for 1 year in development
      'Cache-Control': 'public, max-age=31536000',
    },
  },
  preview: {
    headers: {
      // Cache font files for 1 year in preview mode
      'Cache-Control': 'public, max-age=31536000',
    },
  },
});
