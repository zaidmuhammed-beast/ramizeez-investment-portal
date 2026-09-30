import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

/** Makes the web app installable on phones and desktops ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: "RamiZeeZ",
    description: "Verified founders and investors, with RamiZeeZ in the middle.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060914",
    theme_color: "#0a0f24",
    lang: "en",
    dir: "auto",
    categories: ["finance", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Tank sessions", url: "/sessions" },
      { name: "Opportunities", url: "/opportunities" },
    ],
  };
}
