import type { MetadataRoute } from "next";

// Makes Yarn installable: this is what the phone reads when you tap "Add to Home Screen".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yarn",
    short_name: "Yarn",
    description: "Voice-first admin for tradies. Talk, don't type.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef0ee",
    theme_color: "#eef0ee",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
