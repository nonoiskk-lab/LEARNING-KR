import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fluentia — Speak English with Confidence", template: "%s · Fluentia" },
  description: "Practice real conversations with your personal AI English teacher — anytime, anywhere. Learn from Hindi, Bengali, Tamil, Spanish, Arabic and 15+ languages.",
  applicationName: "Fluentia",
};

export const viewport: Viewport = { themeColor: "#0b1018", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
