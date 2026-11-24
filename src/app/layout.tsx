import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Nunito({ variable: "--font-display", subsets: ["latin"], weight: ["700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "LittleSteps",
  description: "A private diary of drop-off, pickup and the day at the babysitter's, encrypted on your own phone.",
  applicationName: "LittleSteps",
  appleWebApp: { capable: true, title: "LittleSteps", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#16151d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-MY" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        {/* Catches the browser's install offer before the app has started (see public/install-capture.js). */}
        <Script src="/install-capture.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
