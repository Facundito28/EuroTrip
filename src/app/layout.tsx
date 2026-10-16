import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa";
import "./globals.css";
export const metadata: Metadata = {
  title: "EuroTrip 2027 — Travel HQ",
  description:
    "El presupuesto, los gastos compartidos y el itinerario de tu viaje, en un solo lugar.",
  applicationName: "Travel HQ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Travel HQ",
  },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101512",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
