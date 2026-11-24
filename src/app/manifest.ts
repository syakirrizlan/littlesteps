import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/** Lets phones install the app to the Home Screen with its own icon and window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LittleSteps",
    short_name: "LittleSteps",
    description: "Private diary of drop-off, pickup and the day at the babysitter's.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5fa",
    theme_color: "#f4f5fa",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
