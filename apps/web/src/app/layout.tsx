import type { Metadata, Viewport } from "next";
import { ClientShell } from "@/components/ClientShell";
import { pageTitle, siteConfig } from "@/lib/site";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#070b12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: pageTitle(),
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: pageTitle(),
    description: siteConfig.description,
    images: [
      {
        url: "/logo.svg",
        width: 512,
        height: 512,
        alt: `${siteConfig.name} logo`,
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: pageTitle(),
    description: siteConfig.description,
    images: ["/logo.svg"],
  },
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo.svg", type: "image/svg+xml" }],
  },
  alternates: {
    canonical: siteConfig.url,
  },
  category: "finance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
