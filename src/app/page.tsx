import type { Metadata } from "next";
import HomePageClient from "./_home-client";

export const metadata: Metadata = {
  title: "Mining Showdown",
  description:
    "Multiplayer and single-player mining-farm scaling competition. Build the most efficient infrastructure under load — vertical scaling, load balancing, and database sharding.",
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Mining Showdown",
  description:
    "Multiplayer and single-player mining-farm scaling simulation. Compete to build the most efficient infrastructure under live load — vertical scaling, load balancing, and database sharding.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://mining-showdown.vercel.app",
  author: {
    "@type": "Person",
    name: "Léon Brodbeck",
    url: "https://github.com/brodbeckleon",
  },
  keywords:
    "scalability, load balancing, database sharding, vertical scaling, horizontal scaling, multiplayer, single player, simulation",
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient />
    </>
  );
}
