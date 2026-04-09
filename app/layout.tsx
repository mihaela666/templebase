import type { Metadata, Viewport } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Temple Base",
  description:
    "An endless runner game inspired by Temple Run, built as a mini app for the Base ecosystem. Dodge, jump, and collect coins!",
  applicationName: "Temple Base",
  manifest: "/manifest.json",
  openGraph: {
    title: "Temple Base",
    description: "Play Temple Base — the endless runner game, onchain.",
    type: "website",
    url: "https://templebase.vercel.app",
    siteName: "Temple Base",
    images: [
      {
        url: "https://templebase.vercel.app/app-thumbnail.jpg",
        width: 1200,
        height: 628,
        alt: "Temple Base",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Temple Base",
    description: "Play Temple Base — the endless runner game, onchain.",
    images: ["https://templebase.vercel.app/app-thumbnail.jpg"],
  },
  other: {
    "apple-mobile-web-app-title": "Temple Base",
    "base:app_id": "69d5155791c13596e8962147",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0d0a1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
