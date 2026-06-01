import type { Metadata } from "next";
import HomePageClient from "./_home-client";

export const metadata: Metadata = {
  title: "Mining Showdown — ASE2 Scalability Lab",
  description:
    "Multiplayer mining-farm scaling competition. Demonstrates vertical scaling, load balancing, and database sharding under load. Built for the ZHAW ASE2 Scalability Lab.",
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Mining Showdown",
  description:
    "Multiplayer mining-farm scaling competition that demonstrates vertical scaling, load balancing, and database sharding under load.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://mining-showdown.vercel.app",
  author: {
    "@type": "Person",
    name: "Léon Brodbeck",
    url: "https://github.com/brodbeckleon",
  },
  educationalUse: "Assignment",
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "Student",
  },
  keywords:
    "scalability, load balancing, database sharding, vertical scaling, horizontal scaling, multiplayer, education",
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
