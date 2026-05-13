import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/lang-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LangToggle } from "@/components/LangToggle";

export const metadata: Metadata = {
  title: "Mining Showdown — ASE2 Scalability Lab",
  description:
    "Multiplayer mining-farm scaling competition. Demonstrates vertical scaling, load balancing, and database sharding under load.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
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
