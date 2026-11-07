import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// VITE_BASE asetetaan, kun peli julkaistaan alihakemistoon (esim. GitHub Pages: /game-with-child/).
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  build: { target: "es2022" },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Pakohuone",
        short_name: "Pakohuone",
        description: "Pieni 3D-pakohuonepeli selaimessa",
        lang: "fi",
        start_url: ".",
        scope: ".",
        display: "fullscreen",
        orientation: "any",
        background_color: "#1b2a33",
        theme_color: "#1b2a33",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Babylonin paketit ovat isoja; Workboxin oletusraja (2 MB) ei riitä.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // glb on pelaajan hahmon 3D-malli; se otetaan mukaan, jotta peli toimii myös ilman verkkoa.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2,glb}"],
      },
    }),
  ],
});
