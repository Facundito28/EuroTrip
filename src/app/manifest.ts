import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EuroTrip 2027 — Travel HQ",
    short_name: "Travel HQ",
    description: "Tu viaje y tus cuentas, en orden.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101512",
    theme_color: "#c5f277",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
