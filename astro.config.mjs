import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import sanity from "@sanity/astro";
import node from "@astrojs/node";

export default defineConfig({
  site: "https://bloc-leopards.example",
  output: "server",
  adapter: node({
    mode: "standalone"
  }),
  integrations: [
    react(),
    tailwind(),
    sanity({
      projectId: process.env.PUBLIC_SANITY_PROJECT_ID || "blocleopards",
      dataset: process.env.PUBLIC_SANITY_DATASET || "production",
      useCdn: true,
      apiVersion: "2026-05-25"
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  vite: {
    server: {
      allowedHosts: true,
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-dev-runtime",
        "framer-motion",
      ],
    },
  },
});
