import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/lang-context";
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
      <body className="font-sora bg-zinc-950 text-zinc-200 antialiased">
        <LangProvider>
          {children}
          <LangToggle />
        </LangProvider>
      </body>
    </html>
  );
}
