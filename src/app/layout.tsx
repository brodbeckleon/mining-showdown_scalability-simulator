import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/lang-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LangToggle } from "@/components/LangToggle";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb",
  display: "swap",
  weight: ["400", "500", "600"],
});

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://mining-showdown.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Mining Showdown",
    template: "%s | Mining Showdown",
  },
  description:
    "Multiplayer and single-player mining-farm scaling competition. Build the most efficient infrastructure under load — vertical scaling, load balancing, and database sharding.",
  keywords: [
    "mining",
    "scalability",
    "load balancing",
    "database sharding",
    "vertical scaling",
    "horizontal scaling",
    "multiplayer",
    "single player",
    "simulation",
    "infrastructure",
  ],
  authors: [{ name: "Léon Brodbeck", url: "https://github.com/brodbeckleon" }],
  creator: "Léon Brodbeck",
  openGraph: {
    type: "website",
    locale: "de_CH",
    alternateLocale: ["en_US"],
    title: "Mining Showdown",
    description:
      "Who builds the most efficient mining infrastructure under load? Multiplayer and solo scalability simulation.",
    siteName: "Mining Showdown",
    url: BASE_URL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Mining Showdown — ASE2 Scalability Lab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mining Showdown",
    description:
      "Multiplayer and solo mining-farm scaling competition. Vertical scaling, load balancing, and DB sharding under live load.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: BASE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${sora.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sora bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 antialiased">
        <ThemeProvider>
          <LangProvider>
            {children}
            <LangToggle />
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
