import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Permanent_Marker } from "next/font/google";
import { publicBaseUrl } from "@/shared/lib/site";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const marker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marker-face",
  display: "swap",
});

// Every page reads runtime configuration (PUBLIC_BASE_URL, API_BASE_URL) and
// live catalog data, so nothing is prerendered at build time and one image
// works in any environment.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef1f3",
};

export function generateMetadata(): Metadata {
  return { metadataBase: new URL(publicBaseUrl()) };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${marker.variable}`}>
      <body>{children}</body>
    </html>
  );
}
